const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
/** Parse `15169` or `AS15169`. Returns null for anything else. */
export function parseAsn(value) {
    if (typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 4_294_967_295) {
        return value;
    }
    if (typeof value === "string") {
        const match = /^(?:AS)?(\d+)$/i.exec(value.trim());
        if (!match)
            return null;
        const asn = Number(match[1]);
        if (Number.isInteger(asn) && asn > 0 && asn <= 4_294_967_295)
            return asn;
    }
    return null;
}
export function normalizeCountry(value) {
    if (typeof value !== "string")
        return null;
    const code = value.trim().toUpperCase();
    if (code === "UK")
        return "GB";
    if (!/^[A-Z]{2}$/.test(code))
        return null;
    return code;
}
export function cleanName(value) {
    if (typeof value !== "string")
        return null;
    const name = value.replace(/\s+/g, " ").trim();
    if (!name || name.length > 300)
        return null;
    if (/^(n\/a|na|none|null|unknown|-|--)$/i.test(name))
        return null;
    return name;
}
/** Hostnames only. Rejects bare IPs and strings that are not domains. */
export function cleanDomain(value) {
    if (typeof value !== "string")
        return null;
    let domain = value.trim().toLowerCase();
    domain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
    if (domain.startsWith("www."))
        domain = domain.slice(4);
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain))
        return null;
    return domain;
}
export function isPublicIp(value) {
    if (isPublicIpv4(value))
        return true;
    return isPublicIpv6(value);
}
/**
 * Cache key coarser than a single host: IPv4 /24 or IPv6 /48.
 * Returns null for private or unparseable addresses.
 */
export function coarsePrefix(ip) {
    if (isPublicIpv4(ip)) {
        const [a, b, c] = ip.split(".");
        return `${a}.${b}.${c}.0/24`;
    }
    const groups = expandIpv6(ip);
    if (!groups || !isPublicIpv6(ip))
        return null;
    return `${groups[0]}:${groups[1]}:${groups[2]}::/48`;
}
function isPublicIpv4(ip) {
    if (!IPV4.test(ip))
        return false;
    const parts = ip.split(".").map((part) => Number(part));
    if (parts.some((part) => part > 255))
        return false;
    const [a, b] = parts;
    if (a === undefined || b === undefined)
        return false;
    if (a === 0 || a === 10 || a === 127)
        return false;
    if (a === 169 && b === 254)
        return false;
    if (a === 172 && b >= 16 && b <= 31)
        return false;
    if (a === 192 && b === 168)
        return false;
    if (a === 100 && b >= 64 && b <= 127)
        return false; // carrier-grade NAT
    if (a >= 224)
        return false;
    return true;
}
function isPublicIpv6(ip) {
    const groups = expandIpv6(ip);
    if (!groups)
        return false;
    const first = parseInt(groups[0] ?? "0", 16);
    if (groups.every((group) => group === "0"))
        return false;
    if (groups.slice(0, 7).every((group) => group === "0") && groups[7] === "1")
        return false;
    if ((first & 0xfe00) === 0xfc00)
        return false; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80)
        return false; // fe80::/10 link local
    if ((first & 0xff00) === 0xff00)
        return false; // multicast
    return true;
}
function expandIpv6(ip) {
    const lower = ip.toLowerCase().split("%")[0] ?? "";
    if (!lower || !/^[0-9a-f:]+$/.test(lower))
        return null;
    const halves = lower.split("::");
    if (halves.length > 2)
        return null;
    const left = halves[0] ? halves[0].split(":") : [];
    const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
    if (halves.length === 1 && left.length !== 8)
        return null;
    const missing = 8 - left.length - right.length;
    if (missing < 0)
        return null;
    const raw = halves.length === 1 ? left : [...left, ...Array(missing).fill("0"), ...right];
    if (raw.length !== 8)
        return null;
    const groups = [];
    for (const group of raw) {
        if (!/^[0-9a-f]{1,4}$/.test(group))
            return null;
        groups.push(group.replace(/^0+/, "") || "0");
    }
    return groups;
}
//# sourceMappingURL=ip.js.map