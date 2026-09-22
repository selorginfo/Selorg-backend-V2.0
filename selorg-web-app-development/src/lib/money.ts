export function formatMoney(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function formatDiscountPct(pct: number): string {
  return `-${pct}%`;
}
