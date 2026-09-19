import type { MetadataRoute } from "next";

/**
 * The Admin Panel must never be indexed (spec §45). robots.txt denies all
 * crawlers, on top of the noindex meta tag and the robots noindex header.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
