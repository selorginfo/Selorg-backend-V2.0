import type { OrderInvoice } from "@/services/orderService";
import { productDisplayName } from "@/lib/products";

/** Seller block from SELORG customer invoice sample. */
export const INVOICE_SELLER = {
  legalName: "SELORG TECHNOLOGIES PRIVATE LIMITED",
  addressLines: [
    "No. 24, 2nd Floor, Velachery Main Road, Chennai, Tamil",
    "Nadu – 600042",
  ],
  gstin: "33AABCS1234A1Z5",
  contact: "+91 90000 12345 • support@selorg.com",
  tagline: "Fresh groceries. Delivered simply.",
} as const;

export type InvoiceDownloadContext = {
  customerName?: string;
  customerPhone?: string;
  deliveryNote?: string;
  logoUrl?: string;
};

type LineRow = {
  name: string;
  hsn: string;
  unit: string;
  qty: number;
  rate: number;
  gstPercent: number;
  taxable: number;
  tax: number;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatInr(value: number): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ` ${ONES[o]}` : ""}`;
}

/** Indian numbering: … Crore / Lakh / Thousand. */
export function amountInWordsInr(amount: number): string {
  const rounded = Math.round(Math.abs(amount));
  if (rounded === 0) return "Zero Rupees Only";

  const crore = Math.floor(rounded / 1_00_00_000);
  const lakh = Math.floor((rounded % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((rounded % 1_00_000) / 1_000);
  const hundred = Math.floor((rounded % 1_000) / 100);
  const rest = rounded % 100;

  const parts: string[] = [];
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigits(rest));

  return `${parts.join(" ")} Rupees Only`;
}

function defaultGstPercent(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("salt") || n.includes("milk") || n.includes("atta") || n.includes("rice") || n.includes("oil")) {
    if (n.includes("salt") || n.includes("milk")) return 0;
    return 5;
  }
  return 5;
}

function buildLines(invoice: OrderInvoice): LineRow[] {
  return invoice.items.map((item) => {
    const name = productDisplayName(item.name);
    const qty = item.quantity || 1;
    const rate = item.unitPrice;
    const gstPercent = defaultGstPercent(name);
    const lineTotal = item.total || rate * qty;
    // Sample layout treats taxable as exclusive; when prices are tax-inclusive, reverse out GST.
    const taxable =
      gstPercent > 0 ? Math.round((lineTotal / (1 + gstPercent / 100)) * 100) / 100 : lineTotal;
    const tax = Math.round((lineTotal - taxable) * 100) / 100;
    return {
      name,
      hsn: "—",
      unit: item.variantSize?.trim() || "pcs",
      qty,
      rate,
      gstPercent,
      taxable,
      tax,
    };
  });
}

function formatInvoiceDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
}

/**
 * Builds a print-ready HTML tax invoice matching
 * `SELORG_Customer_Invoice_Sample.html` layout.
 */
export function buildCustomerInvoiceHtml(
  invoice: OrderInvoice,
  ctx: InvoiceDownloadContext = {},
): string {
  const lines = buildLines(invoice);
  const itemSubtotal = lines.reduce((s, l) => s + l.taxable, 0);
  const taxTotal = lines.reduce((s, l) => s + l.tax, 0);
  const cgst = Math.round((taxTotal / 2) * 100) / 100;
  const sgst = Math.round((taxTotal - cgst) * 100) / 100;
  const discount = invoice.discount || 0;
  const deliveryFee = invoice.deliveryFee || 0;
  const handling = invoice.handlingCharge || 0;
  const grand =
    invoice.totalAmount ||
    Math.round((itemSubtotal - discount + deliveryFee + handling + taxTotal) * 100) / 100;

  const gstin = invoice.taxInfo?.gstNumber?.replace(/^GSTIN:\s*/i, "") || INVOICE_SELLER.gstin;
  const customerName = ctx.customerName?.trim() || "Customer";
  const customerPhone = ctx.customerPhone?.trim();
  const deliveryNote = ctx.deliveryNote?.trim() || "Delivered to customer address";
  const logoUrl = ctx.logoUrl || "/selorg-logo.png";

  const rowsHtml = lines
    .map(
      (l) => `
      <tr>
        <td class="item">${escapeHtml(l.name)}</td>
        <td class="center">${escapeHtml(l.hsn)}</td>
        <td class="center">${escapeHtml(l.unit)}</td>
        <td class="center">${l.qty}</td>
        <td class="num">${formatInr(l.rate)}</td>
        <td class="center">${l.gstPercent}%</td>
        <td class="num">${formatInr(l.taxable)}</td>
        <td class="num">${formatInr(l.tax)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SELORG • Customer Invoice — ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    :root {
      --ink: #1b1d17;
      --muted: #5f6358;
      --line: #d7ddd0;
      --green: #2f5d28;
      --green-deep: #244820;
      --mint: #e8f1e2;
      --paper: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f3f4ef;
      color: var(--ink);
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 12.5px;
      line-height: 1.35;
    }
    .sheet {
      width: min(920px, 100%);
      margin: 18px auto;
      background: var(--paper);
      border: 1px solid var(--line);
      padding: 22px 24px 18px;
    }
    .top {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      padding-bottom: 14px;
      border-bottom: 4px solid var(--green);
    }
    .brand {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .brand img {
      width: 56px;
      height: 56px;
      border-radius: 10px;
      object-fit: cover;
      background: var(--green);
    }
    .brand-name {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.4px;
      color: var(--green-deep);
      line-height: 1;
    }
    .brand-sub {
      margin-top: 4px;
      color: var(--muted);
      font-size: 11.5px;
    }
    .inv-meta {
      text-align: right;
      min-width: 210px;
    }
    .inv-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 1.2px;
      color: var(--green-deep);
      margin-bottom: 8px;
    }
    .meta-row {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin: 2px 0;
    }
    .meta-row span:first-child {
      color: var(--muted);
      font-weight: 600;
    }
    .meta-row span:last-child { font-weight: 700; }
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 14px 0 12px;
    }
    .box {
      border: 1px solid var(--line);
      border-radius: 2px;
      overflow: hidden;
      min-height: 118px;
    }
    .box-h {
      background: var(--mint);
      padding: 7px 10px;
      font-weight: 800;
      font-size: 11.5px;
      color: var(--green-deep);
      border-bottom: 1px solid var(--line);
    }
    .box-b { padding: 10px; }
    .box-b .name { font-weight: 800; margin-bottom: 4px; }
    .box-b .line { color: var(--muted); margin: 1px 0; }
    table.items {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.items th, table.items td {
      border: 1px solid var(--line);
      padding: 7px 6px;
      vertical-align: top;
    }
    table.items th {
      background: var(--green);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      text-align: left;
    }
    table.items th.center, td.center { text-align: center; }
    table.items th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
    td.item { font-weight: 650; }
    .mid {
      display: grid;
      grid-template-columns: 1fr 280px;
      gap: 12px;
      margin-top: 12px;
      align-items: start;
    }
    .status-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .status-cell {
      border: 1px solid var(--line);
      padding: 8px 10px;
    }
    .status-cell .k {
      color: var(--muted);
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .status-cell .v { margin-top: 3px; font-weight: 700; }
    .totals {
      border: 1px solid var(--line);
      overflow: hidden;
    }
    .totals .row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 6px 10px;
      border-bottom: 1px solid var(--line);
    }
    .totals .row:last-child { border-bottom: 0; }
    .totals .row span:first-child { color: var(--muted); font-weight: 600; }
    .totals .row span:last-child { font-weight: 700; font-variant-numeric: tabular-nums; }
    .totals .grand {
      background: var(--mint);
      font-size: 13.5px;
    }
    .totals .grand span { color: var(--green-deep) !important; font-weight: 800 !important; }
    .words {
      margin-top: 12px;
      border: 1px solid var(--line);
      padding: 9px 11px;
    }
    .words strong { color: var(--muted); font-size: 11px; }
    .notes {
      margin-top: 12px;
      border: 1px solid var(--line);
      overflow: hidden;
    }
    .notes .box-h { margin: 0; }
    .notes .box-b { color: var(--muted); font-size: 11.5px; }
    .footer-line {
      margin-top: 16px;
      border-top: 1px solid var(--line);
      padding-top: 8px;
      color: var(--muted);
      font-size: 10.5px;
      text-align: center;
    }
    @media print {
      body { background: #fff; }
      .sheet { margin: 0; border: 0; width: 100%; max-width: none; }
    }
    @media (max-width: 720px) {
      .sheet { margin: 0; border: 0; padding: 14px; }
      .top, .parties, .mid, .status-grid { grid-template-columns: 1fr; display: grid; }
      .inv-meta { text-align: left; }
      .meta-row { justify-content: flex-start; }
      table.items { font-size: 11px; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div class="brand">
        <img src="${escapeHtml(logoUrl)}" alt="SELORG" />
        <div>
          <div class="brand-name">SELORG</div>
          <div class="brand-sub">${escapeHtml(INVOICE_SELLER.tagline)}</div>
        </div>
      </div>
      <div class="inv-meta">
        <div class="inv-title">INVOICE</div>
        <div class="meta-row"><span>Invoice No:</span><span>${escapeHtml(invoice.invoiceNumber)}</span></div>
        <div class="meta-row"><span>Invoice Date:</span><span>${escapeHtml(formatInvoiceDate(invoice.orderDate))}</span></div>
        <div class="meta-row"><span>Order ID:</span><span>${escapeHtml(String(invoice.orderNumber))}</span></div>
      </div>
    </div>

    <div class="parties">
      <div class="box">
        <div class="box-h">Seller Details</div>
        <div class="box-b">
          <div class="name">${escapeHtml(INVOICE_SELLER.legalName)}</div>
          ${INVOICE_SELLER.addressLines.map((l) => `<div class="line">${escapeHtml(l)}</div>`).join("")}
          <div class="line">GSTIN: ${escapeHtml(gstin)}</div>
          <div class="line">${escapeHtml(INVOICE_SELLER.contact)}</div>
        </div>
      </div>
      <div class="box">
        <div class="box-h">Bill To / Deliver To</div>
        <div class="box-b">
          <div class="name">${escapeHtml(customerName)}</div>
          <div class="line">${escapeHtml(invoice.deliveryAddress || "N/A")}</div>
          ${customerPhone ? `<div class="line">Mobile: ${escapeHtml(customerPhone)}</div>` : ""}
        </div>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th style="width:28%">Item</th>
          <th class="center" style="width:9%">HSN</th>
          <th class="center" style="width:9%">Unit</th>
          <th class="center" style="width:7%">Qty</th>
          <th class="num" style="width:11%">Rate</th>
          <th class="center" style="width:8%">GST</th>
          <th class="num" style="width:14%">Taxable</th>
          <th class="num" style="width:14%">Tax</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="mid">
      <div class="status-grid">
        <div class="status-cell">
          <div class="k">Payment</div>
          <div class="v">${escapeHtml(invoice.paymentMethod || "N/A")}</div>
        </div>
        <div class="status-cell">
          <div class="k">Delivery</div>
          <div class="v">${escapeHtml(deliveryNote)}</div>
        </div>
      </div>
      <div class="totals">
        <div class="row"><span>Item subtotal</span><span>${formatInr(itemSubtotal)}</span></div>
        <div class="row"><span>Discount</span><span>${discount > 0 ? `− ${formatInr(discount)}` : formatInr(0)}</span></div>
        <div class="row"><span>Delivery fee</span><span>${formatInr(deliveryFee)}</span></div>
        ${handling > 0 ? `<div class="row"><span>Handling</span><span>${formatInr(handling)}</span></div>` : ""}
        <div class="row"><span>CGST</span><span>${formatInr(cgst)}</span></div>
        <div class="row"><span>SGST</span><span>${formatInr(sgst)}</span></div>
        <div class="row grand"><span>Grand Total</span><span>${formatInr(grand)}</span></div>
      </div>
    </div>

    <div class="words">
      <strong>Amount in words:</strong>
      ${escapeHtml(amountInWordsInr(grand))}
    </div>

    <div class="notes">
      <div class="box-h">Notes &amp; Customer Information</div>
      <div class="box-b">
        <div><strong>Tax invoice note:</strong> ${escapeHtml(
          invoice.taxInfo?.note ||
            "This is a computer-generated tax invoice. Prices shown may reverse-calculate GST for display; confirm final GST treatment with your finance/tax team before issuing a legal tax invoice.",
        )}</div>
      </div>
    </div>

    <div class="footer-line">Thank you for shopping with SELORG</div>
  </div>
</body>
</html>`;
}

export function downloadCustomerInvoiceHtml(
  invoice: OrderInvoice,
  ctx: InvoiceDownloadContext = {},
): void {
  const html = buildCustomerInvoiceHtml(invoice, {
    ...ctx,
    logoUrl: ctx.logoUrl || `${window.location.origin}/selorg-logo.png`,
  });
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${invoice.invoiceNumber.replace(/[^\w.-]+/g, "_")}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
