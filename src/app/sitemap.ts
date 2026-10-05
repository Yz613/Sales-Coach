import type { MetadataRoute } from "next";
import { PUBLIC_SITEMAP_PATHS } from "@/lib/public-path";

const ORIGIN = "https://refreshqueue.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_SITEMAP_PATHS.map((path) => ({
    url: path === "/" ? `${ORIGIN}/` : `${ORIGIN}${path}`,
    changeFrequency: path === "/privacy" ? "yearly" : "weekly",
    priority: path === "/" ? 1 : path === "/privacy" ? 0.3 : 0.8,
  }));
}
