"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";

const PLACEHOLDER = "/selorg-logo.png";

/** True for Selorg S3/CloudFront URLs — optimizer proxying these can 5xx and
 *  abort the RSC Suspense stream ("server could not finish this Suspense boundary"). */
export function isSelorgCdnUrl(src: string): boolean {
  return /cloudfront\.net|amazonaws\.com/i.test(src);
}

type SafeRemoteImageProps = Omit<ImageProps, "src" | "alt"> & {
  src?: string | null;
  alt: string;
  /** Extra class on the fallback placeholder when the remote URL fails. */
  fallbackClassName?: string;
};

/**
 * Next/Image wrapper that:
 * - never renders with an empty src (throws in Next 16)
 * - skips the optimizer for Selorg CDN hosts (avoids SSR Suspense aborts on CDN 5xx)
 * - falls back to the brand mark if the remote asset fails to load
 */
export function SafeRemoteImage({
  src,
  alt,
  className,
  fallbackClassName,
  onError,
  ...rest
}: SafeRemoteImageProps) {
  const resolved = typeof src === "string" && src.trim() ? src.trim() : PLACEHOLDER;
  // Track which src last failed — when `resolved` changes, retry the new URL.
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const current = brokenSrc === resolved ? PLACEHOLDER : resolved;
  const failed = current === PLACEHOLDER && resolved !== PLACEHOLDER;

  return (
    <Image
      {...rest}
      src={current}
      alt={alt}
      unoptimized={isSelorgCdnUrl(current) || current === PLACEHOLDER}
      className={cn(className, failed && fallbackClassName)}
      onError={(e) => {
        if (brokenSrc !== resolved) setBrokenSrc(resolved);
        onError?.(e);
      }}
    />
  );
}
