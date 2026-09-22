"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf, RefreshCw, Zap } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAddresses } from "@/context/AddressContext";
import { useRecentlyViewed } from "@/context/RecentlyViewedContext";
import { useDeliveryEtaLabel } from "@/context/DeliveryContext";
import { decorateProduct, productDisplayName } from "@/lib/products";
import { formatDiscountPct, formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/product/QuantityStepper";
import { VariantSelector } from "@/components/product/VariantSelector";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductGrid } from "@/components/product/ProductGrid";
import type { Product } from "@/types";

export function ProductClient({
  product,
  related,
}: {
  product: Product;
  related: Product[];
}) {
  const { cart, cartVariant, addToCart, increment, decrement } = useCart();
  const { addresses, selectedAddr } = useAddresses();
  const { pushRecent } = useRecentlyViewed();
  const router = useRouter();
  const [variantIndex, setVariantIndex] = useState(cartVariant[product.id] ?? 0);
  const variant =
    product.variants[variantIndex] ??
    product.variants[0] ?? { label: product.unit, price: product.price, mrp: product.mrp, variantId: product.id };
  const decorated = decorateProduct(product, cart[product.id] ?? 0);
  const selHasDiscount = variant.mrp > variant.price;
  const selDiscount = selHasDiscount ? Math.round((1 - variant.price / variant.mrp) * 100) : 0;
  const address = addresses.find((a) => a.id === selectedAddr);
  // Live ETA for the selected address first; the catalog's own `deliveryInfo`
  // string is the fallback before a location is set.
  const eta = useDeliveryEtaLabel();
  const deliveryLine = eta ? `${eta} delivery` : product.deliveryInfo ?? "Fast delivery";

  useEffect(() => {
    pushRecent(product.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  return (
    <div className="wrap pb-10 pt-4 sm:pb-14 sm:pt-5">
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 pdp:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] pdp:gap-8 min-[1200px]:gap-10">
        <ProductGallery product={product} hasDiscount={decorated.hasDiscount} />

        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <span className="text-[12.5px] font-extrabold uppercase tracking-[.4px] text-accent-dark">{product.brand}</span>
            <h1 className="mt-1.5 mb-2.5 font-sans text-[26px] font-extrabold leading-[1.1] tracking-[-0.8px] sm:text-[32px]">
              {productDisplayName(product.name)}
            </h1>
            <div className="flex flex-wrap items-center gap-3.5">
              {product.rating != null ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-[#fff6e8] px-2 py-1 text-[12.5px] font-extrabold text-[#b45309]">
                  ★ {product.rating.toFixed(1)}
                  {product.sold != null ? (
                    <span className="font-semibold text-muted">· {product.sold}+ sold</span>
                  ) : null}
                </span>
              ) : null}
              {product.sub?.trim() ? (
                <span className="text-[12.5px] font-bold text-muted">{product.sub}</span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-accent-dark">
                <Leaf size={16} /> Certified Organic
              </span>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-sans text-[30px] font-extrabold sm:text-[34px]">{formatMoney(variant.price)}</span>
              {selHasDiscount ? (
                <>
                  <span className="text-base text-muted line-through sm:text-lg">{formatMoney(variant.mrp)}</span>
                  <span className="text-[14px] font-extrabold text-warn sm:text-[15px]">{formatDiscountPct(selDiscount)}</span>
                </>
              ) : null}
            </div>
            <div className="text-xs text-muted">Inclusive of all taxes</div>
          </div>

          <div>
            <h3 className="mb-2.5 text-sm font-extrabold">Select variant</h3>
            <VariantSelector variants={product.variants} selected={variantIndex} onSelect={setVariantIndex} />
          </div>

          <div className="flex flex-col gap-3 pt-1 min-[480px]:flex-row min-[480px]:pt-2">
            {decorated.oos ? (
              <Button disabled variant="outline" className="w-full flex-1" size="lg">
                Out of stock
              </Button>
            ) : decorated.inCart ? (
              <>
                <QuantityStepper
                  qty={decorated.qty}
                  onInc={() => increment(product.id)}
                  onDec={() => decrement(product.id)}
                  size="lg"
                  variant="outline"
                  disableInc={decorated.qty >= 6}
                />
                <Button onClick={() => router.push("/checkout")} size="lg" className="w-full flex-1">
                  Go to checkout
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full flex-1"
                  onClick={() => addToCart(product.id, variantIndex, product)}
                >
                  Add to cart
                </Button>
                <Button
                  size="lg"
                  className="w-full flex-1"
                  onClick={() => {
                    addToCart(product.id, variantIndex, product);
                    router.push("/checkout");
                  }}
                >
                  Buy now
                </Button>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2.5 xs:grid-cols-2">
            <div className="flex items-center gap-[11px] rounded-xl border border-line bg-white p-3.5">
              <Zap size={20} className="shrink-0 text-accent-dark" />
              <div className="min-w-0">
                <div className="text-[13px] font-extrabold">{deliveryLine}</div>
                <div className="truncate text-[11.5px] text-muted">
                  To {address?.area ?? "your address"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-[11px] rounded-xl border border-line bg-white p-3.5">
              <RefreshCw size={20} className="shrink-0 text-accent-dark" />
              <div className="min-w-0">
                <div className="text-[13px] font-extrabold">Easy returns</div>
                <div className="text-[11.5px] text-muted">On-delivery check</div>
              </div>
            </div>
          </div>

          {/* Every value below comes from `GET /products/:id`; anything the
              catalog hasn't filled in is omitted rather than substituted with
              generic copy. */}
          <div className="border-t border-line pt-[18px]">
            {product.about ? (
              <>
                <h3 className="mb-2 text-[15px] font-extrabold">About this product</h3>
                <p className="text-sm leading-relaxed text-[#4a4d43]">{product.about}</p>
              </>
            ) : null}

            {product.healthBenefits ? (
              <>
                <h3 className="mb-2 mt-4 text-[15px] font-extrabold">Health benefits</h3>
                <p className="text-sm leading-relaxed text-[#4a4d43]">{product.healthBenefits}</p>
              </>
            ) : null}

            {product.nutrition ? (
              <>
                <h3 className="mb-2 mt-4 text-[15px] font-extrabold">Nutrition</h3>
                <p className="text-sm leading-relaxed text-[#4a4d43]">{product.nutrition}</p>
              </>
            ) : null}

            <dl className="mt-4 grid grid-cols-2 gap-x-2 gap-y-0">
              <InfoRow label="Brand" value={product.brand} />
              <InfoRow label="Net weight" value={variant.label} />
              <InfoRow label="Shelf life" value={product.shelfLife} />
              <InfoRow label="Origin" value={product.origin} />
            </dl>
          </div>
        </div>
      </div>

      {/* No ratings/reviews section: selorg-service has no review system, so
          there is nothing to render that wouldn't be invented. */}
      {related.length > 0 ? (
        <section className="mt-8 min-w-0 sm:mt-[30px]">
          <h2 className="mb-3 font-sans text-[20px] font-extrabold tracking-[-0.6px] sm:mb-4 sm:text-[22px]">
            You might also like
          </h2>
          <ProductGrid products={related} variant="full" />
        </section>
      ) : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <>
      <dt className="border-b border-line py-2.5 text-[13px] text-muted">{label}</dt>
      <dd className="break-words border-b border-line py-2.5 text-right text-[13px] font-bold">{value}</dd>
    </>
  );
}
