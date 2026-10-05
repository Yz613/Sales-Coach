import { lookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { BlockList, isIP } from "node:net";
import type { Dispatcher } from "undici";
import { RevenueError } from "../revenue/security";

/** Fail closed for non-global addresses, including IPv4-mapped IPv6 and transition networks. */
export function publicDownloadAddress(address: string): boolean {
  const family = isIP(address);
  if (!family) return false;
  const blocked = new BlockList();
  if (family === 4) {
    for (const [ip, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
      ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
      ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const) blocked.addSubnet(ip, prefix, "ipv4");
    return !blocked.check(address, "ipv4");
  }
  const global = new BlockList();
  global.addSubnet("2000::", 3, "ipv6");
  for (const [ip, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) blocked.addSubnet(ip, prefix, "ipv6");
  return global.check(address, "ipv6") && !blocked.check(address, "ipv6");
}

export async function resolvePublicDownload(hostname: string, resolve: (hostname: string, options: { all: true }) => Promise<LookupAddress[]> = lookup): Promise<LookupAddress[]> {
  const addresses = await resolve(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !publicDownloadAddress(address))) throw new RevenueError("Provider returned an invalid download address.", 502);
  return addresses;
}

let dispatcher: Dispatcher | undefined;
/** Validate DNS inside socket creation, so Node cannot re-resolve a checked name to a private address. */
export async function downloadFetch(url: URL, init: RequestInit): Promise<Response> {
  let worker = false;
  try { worker = Boolean(require("@opennextjs/cloudflare").getCloudflareContext()?.env); } catch { /* Self-hosted Node uses pinned sockets below. */ }
  // Workers routes global fetch through the public Internet via global_fetch_strictly_public.
  if (worker) return fetch(url, init);
  if (!dispatcher) {
    const { Agent } = await import("undici");
    dispatcher = new Agent({ connect: { lookup: (hostname, options, callback) => {
      resolvePublicDownload(hostname).then(addresses => {
        if (options.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      }).catch(error => callback(error, "", 4));
    } } });
  }
  return fetch(url, { ...init, dispatcher } as RequestInit);
}
