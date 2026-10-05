import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { GET, HEAD } from "./route";
import { handleVisitorCompany } from "@/lib/visitor-company";

const SAVED_KEYS = ["IPINFO_TOKEN", "IPAPI_KEY"] as const;
const saved: Partial<Record<(typeof SAVED_KEYS)[number], string | undefined>> = {};

before(() => {
  for (const key of SAVED_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

after(() => {
  for (const key of SAVED_KEYS) {
    const previous = saved[key];
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});

function visitorRequest(
  cf: Record<string, unknown>,
  headers?: HeadersInit,
  method = "GET",
): Request {
  const request = new Request("https://refreshqueue.com/app/api/visitor-company", {
    method,
    headers: {
      "CF-Connecting-IP": "203.0.113.10",
      "User-Agent": "Mozilla/5.0",
      ...headers,
    },
  });
  Object.defineProperty(request, "cf", { value: cf });
  return request;
}

const COMPANY_CF = {
  asn: 424242,
  asOrganization: "Ford Motor Company",
  country: "US",
  isEUCountry: false,
};

async function jsonBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("visitor company route", () => {
  it("identifies a company network and does not return the IP", async () => {
    const response = await GET(visitorRequest(COMPANY_CF));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    const body = await jsonBody(response);
    assert.equal(body.status, "identified");
    assert.equal(body.company_name, "Ford Motor Company");
    assert.equal(body.country, "US");
    assert.equal(body.source, "asn");
    assert.equal(JSON.stringify(body).includes("203.0.113.10"), false);
    assert.equal(JSON.stringify([...response.headers]).includes("203.0.113.10"), false);

    const head = await HEAD(visitorRequest(COMPANY_CF, undefined, "HEAD"));
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("cache-control"), "no-store");
    assert.equal(await head.text(), "");
  });

  it("skips a residential network and a privacy signal", async () => {
    const residential = await GET(
      visitorRequest({
        asn: 7922,
        asOrganization: "Comcast Cable Communications, LLC",
        country: "US",
        isEUCountry: false,
      }),
    );
    const residentialBody = await jsonBody(residential);
    assert.equal(residentialBody.status, "skipped");
    assert.equal(residentialBody.reason, "residential_isp");
    assert.equal(residentialBody.company_name, null);
    assert.equal(residentialBody.company_domain, null);
    assert.equal(JSON.stringify(residentialBody).includes("203.0.113.10"), false);

    const dnt = await GET(visitorRequest(COMPANY_CF, { DNT: "1" }));
    const dntBody = await jsonBody(dnt);
    assert.equal(dntBody.status, "skipped");
    assert.equal(dntBody.reason, "privacy_signal");
    assert.equal(dntBody.company_name, null);

    const gpc = await GET(visitorRequest(COMPANY_CF, { "Sec-GPC": "1" }));
    const gpcBody = await jsonBody(gpc);
    assert.equal(gpcBody.status, "skipped");
    assert.equal(gpcBody.reason, "privacy_signal");
    assert.equal(gpcBody.company_name, null);
  });

  it("returns country only for EU, UK, and EEA visitors", async () => {
    for (const country of ["DE", "FR", "GB", "NO"]) {
      const response = await GET(
        visitorRequest({
          asn: 424242,
          asOrganization: "Ford Motor Company",
          country,
          isEUCountry: country !== "GB" && country !== "NO",
        }),
      );
      const body = await jsonBody(response);
      assert.equal(body.status, "skipped", country);
      assert.equal(body.reason, "eu_privacy", country);
      assert.equal(body.country, country);
      assert.equal(body.company_name, null);
      assert.equal(body.company_domain, null);
      assert.equal(body.asn, null);
      assert.equal(JSON.stringify(body).includes("Ford"), false);
      assert.equal(JSON.stringify(body).includes("203.0.113.10"), false);
    }

    const flagged = await GET(
      visitorRequest({
        asn: 424242,
        asOrganization: "Ford Motor Company",
        isEUCountry: true,
      }),
    );
    const flaggedBody = await jsonBody(flagged);
    assert.equal(flaggedBody.status, "skipped");
    assert.equal(flaggedBody.reason, "eu_privacy");
    assert.equal(flaggedBody.company_name, null);
    assert.equal(JSON.stringify(flaggedBody).includes("Ford"), false);
  });

  it("keeps working when the KV binding is absent and uses it when present", async () => {
    const absent = await handleVisitorCompany(visitorRequest(COMPANY_CF), {
      env: { VISITOR_COMPANY_KV: "not-a-binding" },
    });
    const absentBody = await jsonBody(absent);
    assert.equal(absent.status, 200);
    assert.equal(absentBody.status, "identified");
    assert.equal(absentBody.company_name, "Ford Motor Company");

    const missing = await handleVisitorCompany(visitorRequest(COMPANY_CF), { env: {} });
    assert.equal((await jsonBody(missing)).company_name, "Ford Motor Company");

    let reads = 0;
    const present = await handleVisitorCompany(visitorRequest(COMPANY_CF), {
      env: {
        VISITOR_COMPANY_KV: {
          async get() {
            reads += 1;
            return null;
          },
          async put() {},
        },
      },
    });
    assert.equal(reads, 1);
    assert.equal((await jsonBody(present)).company_name, "Ford Motor Company");
  });

  it("reads Cloudflare cf from the Worker context when the route request has none", async () => {
    const request = new Request("https://refreshqueue.com/app/api/visitor-company", {
      headers: {
        "CF-Connecting-IP": "203.0.113.10",
        "User-Agent": "Mozilla/5.0",
      },
    });
    const response = await handleVisitorCompany(request, {
      env: { IPINFO_TOKEN: "", IPAPI_KEY: "" },
      cf: COMPANY_CF,
    });
    const body = await jsonBody(response);
    assert.equal(body.status, "identified");
    assert.equal(body.company_name, "Ford Motor Company");
    assert.equal(body.source, "asn");
    assert.equal(JSON.stringify(body).includes("203.0.113.10"), false);
  });
});
