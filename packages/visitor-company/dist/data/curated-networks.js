/**
 * Hand-maintained networks that do not identify a visitor's employer.
 * Holder names were checked against RIPE Stat on 2026-10-05.
 * `npm run refresh-asns` adds the long tail from PeeringDB; entries here win
 * so a mobile carrier is not reported as a generic ISP, and so well-known
 * clouds stay filtered even if the snapshot is stale.
 */
export const CURATED_NETWORKS = {
    // Comcast
    7922: "isp",
    7015: "isp",
    7016: "isp",
    7725: "isp",
    13367: "isp",
    20214: "isp",
    21508: "isp",
    22909: "isp",
    33287: "isp",
    33489: "isp",
    33490: "isp",
    33491: "isp",
    33650: "isp",
    33651: "isp",
    33652: "isp",
    33657: "isp",
    33660: "isp",
    33667: "isp",
    33668: "isp",
    // Charter / Spectrum
    7843: "isp",
    10796: "isp",
    11351: "isp",
    11426: "isp",
    11427: "isp",
    12271: "isp",
    20001: "isp",
    20115: "isp",
    22291: "isp",
    33363: "isp",
    33588: "isp",
    // Other US residential ISPs
    22773: "isp", // Cox
    5650: "isp", // Frontier
    209: "isp", // CenturyLink / Lumen legacy
    7029: "isp", // Windstream
    30036: "isp", // Mediacom
    6128: "isp", // Cablevision / Optimum
    6079: "isp", // RCN
    16591: "isp", // Google Fiber
    14593: "isp", // Starlink
    6621: "isp", // HughesNet
    11492: "isp", // Cable One
    12083: "isp", // WideOpenWest
    11272: "isp", // C Spire
    8100: "isp", // Splice
    // Verizon eyeballs are mobile; UUNET/Verizon transit is not a company signal
    22394: "mobile",
    6167: "mobile",
    701: "transit",
    702: "transit",
    19262: "transit",
    // AT&T
    7018: "isp",
    7132: "isp",
    6389: "isp",
    2685: "isp",
    20057: "mobile",
    // T-Mobile USA
    21928: "mobile",
    // Major transit providers. The visitor is a customer of the transit AS, not the AS itself.
    174: "transit",
    1239: "transit", // Cogent, not Sprint
    1299: "transit",
    2914: "transit",
    3257: "transit",
    3356: "transit",
    6453: "transit",
    6461: "transit",
    6939: "transit",
    // International carriers
    1267: "mobile", // Wind Tre
    2119: "isp", // Telenor
    2516: "isp", // KDDI
    2856: "isp", // BT
    3209: "isp", // Vodafone Germany
    3215: "isp", // Orange
    3269: "isp", // Telecom Italia
    3301: "isp", // Telia
    3303: "isp", // Swisscom
    3320: "isp", // Deutsche Telekom
    3352: "isp", // Telefonica Spain
    4713: "isp", // NTT OCN
    4766: "isp", // Korea Telecom
    5089: "isp", // Virgin Media
    5391: "isp", // Hrvatski Telekom
    5410: "isp", // Bouygues
    5607: "isp", // Sky Broadband
    577: "isp", // Bell Canada
    6805: "isp", // Telefonica Germany
    6830: "isp", // Liberty Global
    6871: "isp", // Plusnet
    7545: "isp", // TPG
    812: "isp", // Rogers
    852: "isp", // TELUS
    1221: "isp", // Telstra
    4134: "isp", // China Telecom
    4837: "isp", // China Unicom
    5769: "isp", // Videotron
    6327: "isp", // Shaw
    8422: "isp", // NetCologne
    8426: "isp", // Claranet
    8767: "isp", // M-net
    8881: "isp", // 1&1 Versatel
    9318: "isp", // SK Broadband
    9498: "isp", // Bharti Airtel
    12322: "isp", // Free / Proxad
    13184: "isp", // Hansenet
    13285: "isp", // TalkTalk
    15557: "isp", // SFR
    17676: "isp", // SoftBank
    24651: "isp", // Balticom
    12576: "mobile", // EE
    55836: "mobile", // Reliance Jio
    9605: "mobile", // NTT Docomo
    9808: "mobile", // China Mobile
    // Cloud, hosting, and CDNs. Traffic here is customers or WARP, not the provider's staff.
    7224: "hosting",
    8068: "hosting",
    8069: "hosting",
    8070: "hosting",
    8071: "hosting",
    8074: "hosting",
    8075: "hosting", // Microsoft / Azure
    8560: "hosting", // IONOS
    8987: "hosting", // AWS GovCloud
    9059: "hosting", // AWS Europe
    12076: "hosting",
    12876: "hosting", // Scaleway
    13335: "hosting", // Cloudflare, including WARP
    14061: "hosting", // DigitalOcean
    14618: "hosting",
    15169: "hosting", // Google, including GCP
    15830: "hosting", // Equinix
    16265: "hosting",
    16276: "hosting", // OVH
    16509: "hosting", // AWS
    16625: "hosting",
    19527: "hosting",
    197540: "hosting", // netcup
    20473: "hosting", // Vultr
    20940: "hosting", // Akamai
    209242: "hosting", // Cloudflare Spectrum
    213230: "hosting", // Hetzner Cloud
    24940: "hosting", // Hetzner
    26496: "hosting", // GoDaddy
    31898: "hosting", // Oracle Cloud
    32787: "hosting", // Akamai Prolexic
    35540: "hosting",
    36040: "hosting",
    36351: "hosting", // IBM Cloud
    36352: "hosting", // ColoCrossing
    37963: "hosting",
    396982: "hosting", // Google Cloud
    398101: "hosting",
    43515: "hosting",
    45090: "hosting",
    45102: "hosting",
    46606: "hosting", // Unified Layer
    47583: "hosting", // Hostinger
    51167: "hosting", // Contabo
    53667: "hosting", // FranTech
    54113: "hosting", // Fastly
    60068: "hosting", // Datacamp / CDN77
    60781: "hosting", // Leaseweb
    63949: "hosting", // Linode / Akamai
    7203: "hosting",
    132203: "hosting",
    136787: "hosting", // PacketHub
    212238: "hosting",
    // VPN exit networks
    9009: "vpn", // M247
    209103: "vpn", // ProtonVPN
};
//# sourceMappingURL=curated-networks.js.map