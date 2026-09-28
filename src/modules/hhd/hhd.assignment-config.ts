/** Shared HSD assignment timing constants (avoids claim ↔ timeout import cycles). */

/** Milliseconds a picker may hold an incomplete HSD assignment (default 20 minutes). */
export const HHD_PICKER_ASSIGNMENT_TIMEOUT_MS = Math.max(
  60_000,
  Number(process.env.HHD_PICKER_ASSIGNMENT_TIMEOUT_MS || 20 * 60 * 1000) || 20 * 60 * 1000,
);
