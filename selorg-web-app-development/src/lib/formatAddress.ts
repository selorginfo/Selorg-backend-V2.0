/**
 * Address display normalization — dedupe overlapping components before render.
 * Prefer structured fields over a fat `line1` that already embeds area/city/pin.
 */

export type AddressParts = {
  line1?: string | null;
  line2?: string | null;
  landmark?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
};

function clean(value?: string | null): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,\s*,+/g, ",")
    .replace(/^[\s,·|]+|[\s,·|]+$/g, "")
    .trim();
}

function tokenize(value: string): string[] {
  return clean(value)
    .split(/[,·|]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function normKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.\u2013\u2014-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True if `needle` is already covered by an earlier kept token. */
function isCoveredBy(needle: string, haystackKeys: Set<string>): boolean {
  const key = normKey(needle);
  if (!key) return true;
  if (haystackKeys.has(key)) return true;
  for (const existing of haystackKeys) {
    if (existing === key) return true;
    // Exact whole-word / phrase containment only — never drop "Adyar" because
    // "Venkata Rathinam Nagar" happens to share the suffix "nagar".
    const existingParts = existing.split(" ").filter(Boolean);
    const needleParts = key.split(" ").filter(Boolean);
    if (needleParts.length === 1 && existingParts.includes(key)) return true;
    if (existingParts.length === 1 && needleParts.includes(existing) && existing.length >= 5) {
      return true;
    }
    if (
      existing.startsWith(`${key} `) ||
      existing.endsWith(` ${key}`) ||
      existing.includes(` ${key} `)
    ) {
      return true;
    }
  }
  return false;
}

function pushDeduped(out: string[], seen: Set<string>, value?: string | null): void {
  for (const token of tokenize(value ?? "")) {
    // Strip trailing 6-digit pin from a free-text token when pin is tracked separately later.
    const withoutPin = token.replace(/\s*-?\s*\d{6}$/, "").trim() || token;
    if (isCoveredBy(withoutPin, seen)) continue;
    seen.add(normKey(withoutPin));
    // Also mark original if different
    seen.add(normKey(token));
    out.push(withoutPin);
  }
}

/**
 * Build a single human-readable address line without repeating road/area/city/state/pin.
 *
 * Order: House/Street → Landmark → Area → City, State - Pincode
 */
export function formatAddress(parts: AddressParts): string {
  const line1 = clean(parts.line1);
  const landmark = clean(parts.landmark);
  const line2 = clean(parts.line2);
  const city = clean(parts.city);
  const state = clean(parts.state);
  const pincode = clean(parts.pincode).replace(/\D/g, "").slice(0, 6) || clean(parts.pincode);

  const seen = new Set<string>();
  const head: string[] = [];

  // Prefer structured locality/city/state/pin as canonical; strip them out of fat line1.
  const reserved = [landmark, line2, city, state, pincode].filter(Boolean);
  for (const r of reserved) {
    for (const t of tokenize(r)) seen.add(normKey(t));
    if (/^\d{6}$/.test(pincode)) seen.add(pincode);
  }

  // Re-build seen for output order: first emit line1 tokens that aren't reserved.
  const emitSeen = new Set<string>();
  for (const token of tokenize(line1)) {
    const stripped = token.replace(/\s*-?\s*\d{6}$/, "").trim() || token;
    const key = normKey(stripped);
    if (!key) continue;
    // Drop if this token is clearly city/state/area/pin already stored separately.
    if (isCoveredBy(stripped, seen) && reserved.length > 0) continue;
    if (/^\d{6}$/.test(stripped) && pincode && stripped === pincode) continue;
    if (isCoveredBy(stripped, emitSeen)) continue;
    emitSeen.add(key);
    head.push(stripped);
  }

  const mid: string[] = [];
  pushDeduped(mid, emitSeen, landmark);
  pushDeduped(mid, emitSeen, line2);

  const cityState: string[] = [];
  pushDeduped(cityState, emitSeen, city);
  pushDeduped(cityState, emitSeen, state);

  const segments = [
    head.join(", "),
    mid.join(", "),
    cityState.join(", "),
  ].filter(Boolean);

  let result = segments.join(", ");
  if (pincode && !result.includes(pincode)) {
    result = result ? `${result} - ${pincode}` : pincode;
  }

  return result.replace(/\s+,/g, ",").replace(/,\s*,+/g, ",").replace(/\s{2,}/g, " ").trim();
}

/** Short street / house line for cards (deduped against locality+city). */
export function formatAddressLine(parts: AddressParts): string {
  const full = formatAddress(parts);
  const localityBits = [parts.line2, parts.city, parts.state, parts.pincode]
    .filter(Boolean)
    .join(" ");
  if (!localityBits) return clean(parts.line1) || full;

  // Prefer structured line1 after stripping duplicates.
  const seen = new Set<string>();
  for (const t of tokenize([parts.line2, parts.landmark, parts.city, parts.state, parts.pincode].filter(Boolean).join(", "))) {
    seen.add(normKey(t));
  }
  const head: string[] = [];
  for (const token of tokenize(parts.line1 ?? "")) {
    const stripped = token.replace(/\s*-?\s*\d{6}$/, "").trim() || token;
    if (isCoveredBy(stripped, seen)) continue;
    if (isCoveredBy(stripped, new Set(head.map(normKey)))) continue;
    head.push(stripped);
  }
  return head.join(", ") || clean(parts.line1) || full;
}

/** Secondary line: landmark · area · city, state · pin (deduped). */
export function formatAddressArea(parts: AddressParts): string {
  const seen = new Set<string>();
  // Treat line1 tokens as already shown on the primary line.
  for (const t of tokenize(parts.line1 ?? "")) {
    seen.add(normKey(t.replace(/\s*-?\s*\d{6}$/, "").trim() || t));
  }

  const bits: string[] = [];

  const pushSegment = (value?: string | null) => {
    const cleaned = clean(value);
    if (!cleaned) return;
    const tokens = tokenize(cleaned);
    const fresh = tokens.filter((t) => !isCoveredBy(t, seen));
    if (!fresh.length) return;
    for (const t of fresh) seen.add(normKey(t));
    bits.push(fresh.join(", "));
  };

  pushSegment(parts.landmark);
  pushSegment(parts.line2);

  const cityState: string[] = [];
  for (const value of [parts.city, parts.state]) {
    const cleaned = clean(value);
    if (!cleaned || isCoveredBy(cleaned, seen)) continue;
    seen.add(normKey(cleaned));
    cityState.push(cleaned);
  }
  if (cityState.length) bits.push(cityState.join(", "));

  const pin = clean(parts.pincode).replace(/\D/g, "").slice(0, 6) || clean(parts.pincode);
  if (pin && !bits.some((b) => b.includes(pin))) bits.push(pin);

  return bits.join(" · ");
}

/** Soft duplicate check for save-time prevention (normalized components). */
export function addressesLookSame(a: AddressParts, b: AddressParts): boolean {
  const left = formatAddress(a).toLowerCase();
  const right = formatAddress(b).toLowerCase();
  if (left && right && left === right) return true;

  const pinA = clean(a.pincode).replace(/\D/g, "");
  const pinB = clean(b.pincode).replace(/\D/g, "");
  const lineA = normKey(formatAddressLine(a));
  const lineB = normKey(formatAddressLine(b));
  const areaA = normKey(clean(a.line2));
  const areaB = normKey(clean(b.line2));
  const cityA = normKey(clean(a.city));
  const cityB = normKey(clean(b.city));

  return Boolean(
    lineA &&
      lineB &&
      lineA === lineB &&
      areaA === areaB &&
      cityA === cityB &&
      pinA &&
      pinB &&
      pinA === pinB,
  );
}
