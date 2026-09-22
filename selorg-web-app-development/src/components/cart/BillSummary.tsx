import type { ReactNode } from "react";
import { formatMoney } from "@/lib/money";
import type { CartTotals } from "@/types";

export function BillSummary({
  totals,
  showWalletToggle,
  cta,
  variant = "cart",
  title = "Bill details",
  header,
}: {
  totals: CartTotals;
  showWalletToggle?: ReactNode;
  cta?: ReactNode;
  /** Cart shows the MRP total + product discount; checkout shows the already-discounted subtotal. */
  variant?: "cart" | "checkout";
  title?: string | null;
  /** Rendered above the rows — checkout puts its scrollable order-summary list here so the
   *  design's single sticky card is preserved instead of two stacked cards. */
  header?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[9px] rounded-app border border-line bg-white p-5">
      {header}
      {title ? <h3 className="mb-[14px] text-base font-extrabold">{title}</h3> : null}

      {variant === "cart" ? (
        <>
          <Row label="Item total (MRP)" value={formatMoney(totals.mrpSum)} />
          {totals.discount > 0 ? (
            <Row label="Product discount" value={`-${formatMoney(totals.discount)}`} tone="accent" />
          ) : null}
        </>
      ) : (
        <>
          <Row label="Subtotal" value={formatMoney(totals.sub)} />
          {totals.discount > 0 ? (
            <Row label="Discount" value={`-${formatMoney(totals.discount)}`} tone="accent" />
          ) : null}
        </>
      )}

      {totals.hasCoupon ? (
        <Row label="Coupon" value={`-${formatMoney(totals.couponAmt)}`} tone="accent" />
      ) : null}
      <Row label="Delivery fee" value={totals.delivery === 0 ? "FREE" : formatMoney(totals.delivery)} tone={totals.delivery === 0 ? "accent" : undefined} />
      <Row label={variant === "cart" ? "Handling fee" : "Handling & taxes"} value={formatMoney(totals.handling)} />
      {totals.usesWallet ? (
        <Row label="Selorg Wallet" value={`-${formatMoney(totals.walletUsed)}`} tone="accent" />
      ) : null}

      {showWalletToggle}

      <div className="mt-1 flex items-center justify-between border-t border-dashed border-line pt-3 text-[18px] font-extrabold">
        <span>{variant === "cart" ? "To pay" : "Total"}</span>
        <span>{formatMoney(totals.grand)}</span>
      </div>

      {totals.hasSavings ? (
        <div className="mt-3 rounded-[10px] bg-accent-tint px-3 py-[9px] text-center text-[12.5px] font-bold text-accent-dark">
          🎉 You saved {formatMoney(totals.savings)} on this order
        </div>
      ) : null}

      {totals.belowFree ? (
        <div className="rounded-[10px] bg-black/5 px-3 py-[9px] text-center text-[12.5px] font-bold text-muted">
          Add {formatMoney(totals.amtToFree)} more for free delivery
        </div>
      ) : null}

      {cta}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "accent" }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={tone === "accent" ? "font-bold text-accent-dark" : "font-semibold"}>{value}</span>
    </div>
  );
}
