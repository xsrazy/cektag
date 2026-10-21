import type { MetadataRoute } from "next";

const SITE = "https://cektag.web.id";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/harga`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/privasi`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/syarat`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
