"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { SafeRemoteImage } from "@/components/ui/SafeRemoteImage";
import { formatDiscountPct } from "@/lib/money";
import { productDisplayName } from "@/lib/products";
import { cn } from "@/lib/cn";
import type { Product } from "@/types";

/**
 * PDP gallery matching the customer-app pattern:
 * vertical thumbnails on the left + large main image with a next control.
 */
export function ProductGallery({
  product,
  hasDiscount,
}: {
  product: Product;
  hasDiscount: boolean;
}) {
  const gallery =
    product.photos?.length > 0
      ? product.photos
      : product.photo
        ? [product.photo]
        : ["/selorg-logo.png"];
  const thumbs = gallery.slice(0, 5);
  const [active, setActive] = useState(0);
  const safeIndex = Math.min(active, thumbs.length - 1);
  const current = thumbs[safeIndex] ?? thumbs[0]!;
  const hasMultiple = thumbs.length > 1;

  const goNext = () => {
    if (!hasMultiple) return;
    setActive((i) => (i + 1) % thumbs.length);
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-[560px] pdp:sticky pdp:top-4">
      <div
        className={cn(
          "grid w-full gap-2.5 sm:gap-3",
          hasMultiple ? "grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[72px_minmax(0,1fr)]" : "grid-cols-1",
        )}
      >
        {hasMultiple ? (
          <div className="flex max-h-[min(72vw,420px)] flex-col gap-2 overflow-y-auto sm:max-h-[480px] sm:gap-2.5">
            {thumbs.map((src, index) => {
              const selected = index === safeIndex;
              return (
                <button
                  key={`${src}-${index}`}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`View image ${index + 1}`}
                  aria-pressed={selected}
                  className={cn(
                    "relative aspect-square w-full shrink-0 overflow-hidden rounded-[10px] border-[1.5px] bg-[#f7f7f2] transition-colors",
                    selected ? "border-ink" : "border-line hover:border-[#b8c2a8]",
                  )}
                >
                  <SafeRemoteImage
                    src={src}
                    alt=""
                    fill
                    sizes="72px"
                    className="object-cover"
                    fallbackClassName="object-contain opacity-40 p-1"
                  />
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="relative aspect-square w-full overflow-hidden rounded-[16px] border border-line bg-[#f7f7f2] sm:rounded-[20px]">
          <div className="absolute inset-0 p-3 sm:p-5">
            <div className="relative h-full w-full">
              <SafeRemoteImage
                key={current}
                src={current}
                alt={productDisplayName(product.name)}
                fill
                sizes="(max-width: 900px) calc(100vw - 90px), min(480px, 38vw)"
                className="object-contain"
                fallbackClassName="object-contain opacity-40"
                priority
              />
            </div>
          </div>

          {hasDiscount ? (
            <span className="absolute left-3 top-3 z-10 rounded-[10px] bg-warn px-2.5 py-1 text-[12px] font-extrabold text-white sm:left-4 sm:top-4 sm:text-[13px]">
              {formatDiscountPct(product.discount)}
            </span>
          ) : null}

          {!product.stock ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/[.66] text-base font-extrabold text-warn sm:text-lg">
              OUT OF STOCK
            </div>
          ) : null}

          {hasMultiple ? (
            <button
              type="button"
              onClick={goNext}
              aria-label="Next image"
              className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink shadow-[0_4px_14px_rgba(20,30,10,0.12)] transition-transform hover:scale-105 active:scale-95 sm:bottom-4 sm:right-4 sm:h-10 sm:w-10"
            >
              <ChevronRight size={18} strokeWidth={2.4} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
