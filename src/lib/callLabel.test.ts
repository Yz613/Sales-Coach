import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  callPartyLabel,
  callPartySubtitle,
  formatProspectContext,
  hasKnownCompany,
  normalizeProspectCompany,
} from "./callLabel";

describe("hasKnownCompany", () => {
  it("treats blank and placeholder companies as unknown", () => {
    assert.equal(hasKnownCompany(""), false);
    assert.equal(hasKnownCompany("   "), false);
    assert.equal(hasKnownCompany("Unknown Co"), false);
    assert.equal(hasKnownCompany("unknown company"), false);
    assert.equal(hasKnownCompany("Enterprise Prospect"), false);
    assert.equal(hasKnownCompany("Company from recording"), false);
    assert.equal(hasKnownCompany("Company 3"), false);
    assert.equal(hasKnownCompany("N/A"), false);
  });

  it("keeps a real company name", () => {
    assert.equal(hasKnownCompany("Apex Logistics"), true);
    assert.equal(normalizeProspectCompany("  Acme  "), "Acme");
  });
});

describe("call labels", () => {
  it("falls back to the prospect name when company is missing", () => {
    assert.equal(callPartyLabel({ prospectName: "Greg Miller" }), "Greg Miller");
    assert.equal(callPartyLabel({ prospectCompany: "", prospectName: "Jane Doe" }), "Jane Doe");
    assert.equal(
      callPartyLabel({ prospectCompany: "Unknown Co", prospectName: "Jane Doe" }),
      "Jane Doe"
    );
  });

  it("prefers the real company when present", () => {
    assert.equal(
      callPartyLabel({ prospectCompany: "Apex Logistics", prospectName: "Greg Miller" }),
      "Apex Logistics"
    );
  });

  it("omits company from table subtitles when it is unknown", () => {
    assert.equal(
      callPartySubtitle({ prospectCompany: "Apex Logistics", prospectName: "Greg Miller" }),
      "Apex Logistics • Greg Miller"
    );
    assert.equal(
      callPartySubtitle({ prospectCompany: "", prospectName: "Greg Miller" }),
      "Greg Miller"
    );
    assert.equal(callPartySubtitle({}), "Unnamed prospect");
  });

  it("writes coaching context without inventing a company", () => {
    assert.equal(
      formatProspectContext({ prospectCompany: "Apex Logistics", prospectName: "Greg Miller" }),
      "Greg Miller at Apex Logistics"
    );
    assert.equal(
      formatProspectContext({ prospectCompany: "", prospectName: "Greg Miller" }),
      "Greg Miller"
    );
    assert.equal(formatProspectContext({}), "the prospect");
  });
});
