import assert from "node:assert/strict";
import { test } from "node:test";
import { downloadFetch, publicDownloadAddress, resolvePublicDownload } from "./download-fetch";

test("recording downloads reject private, metadata, reserved and IPv6 transition addresses", () => {
  for (const address of ["0.0.0.0", "10.1.2.3", "127.0.0.1", "100.100.100.200", "169.254.169.254", "172.16.0.1", "192.168.1.1", "198.18.0.1", "224.0.0.1", "::1", "::", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "2002:7f00:1::", "2001:db8::1", "invalid"]) assert.equal(publicDownloadAddress(address), false, address);
  for (const address of ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111", "2001:4860:4860::8888"]) assert.equal(publicDownloadAddress(address), true, address);
});

test("DNS validation rejects mixed answers and returns exactly the validated socket addresses", async () => {
  const addresses = [{ address: "1.1.1.1", family: 4 }];
  assert.equal(await resolvePublicDownload("files.example.com", async () => addresses), addresses);
  await assert.rejects(() => resolvePublicDownload("files.example.com", async () => [...addresses, { address: "10.0.0.1", family: 4 }]), /invalid download address/);
  await assert.rejects(() => resolvePublicDownload("files.example.com", async () => []), /invalid download address/);
  await assert.rejects(() => resolvePublicDownload("files.example.com", async () => [{ address: "::ffff:169.254.169.254", family: 6 }]), /invalid download address/);
});

test("the real Node transport refuses a hostname resolving to loopback before sending a request", async () => {
  await assert.rejects(() => downloadFetch(new URL("https://localhost/private"), { redirect: "manual", signal: AbortSignal.timeout(5000) }), error => {
    assert.match(String((error as Error & { cause?: Error }).cause?.message || error), /invalid download address/);
    return true;
  });
});
