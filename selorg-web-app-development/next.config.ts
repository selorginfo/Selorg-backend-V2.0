import type { NextConfig } from "next";

/**
 * Normalize NEXT_ALLOWED_DEV_ORIGINS entries to hostnames Next expects
 * (e.g. "192.168.1.47" — with or without protocol/port in the env value).
 */
function toDevOriginHost(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    if (/^https?:\/\//i.test(trimmed)) return new URL(trimmed).hostname;
  } catch {
    /* fall through */
  }
  return trimmed.replace(/^https?:\/\//i, "").split("/")[0]!.split(":")[0]!;
}

const envOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map(toDevOriginHost)
  .filter(Boolean);

// Next.js 15+ blocks cross-origin /_next/* asset loads in dev. `localhost` and
// `127.0.0.1` are different origins — Playwright and resolveApiBaseUrl use
// 127.0.0.1, so without this every dynamic chunk 403s and React never hydrates
// (Continue / auth guards / cart hydrate appear broken).
const allowedDevOrigins = Array.from(
  new Set(["127.0.0.1", "localhost", ...envOrigins]),
);

const nextConfig: NextConfig = {
  allowedDevOrigins,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
        pathname: "/**",
      },
      // selorg-service serves all real product/category/banner images from
      // S3 buckets and CloudFront distributions it manages — wildcarded
      // since admins can add new buckets/distributions without a redeploy.
      {
        protocol: "https",
        hostname: "*.amazonaws.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.cloudfront.net",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
