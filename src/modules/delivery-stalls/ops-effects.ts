import type { Cell, OpsActionEffect, Tone } from './ops-types';

/**
 * What each action changes on the record, beyond the activity log and flow stage the engine
 * always records. The design writes every action to the record's history; these effects make the
 * list reflect it too (status badge, assigned vehicle/operator/employee, quantities), so a
 * coordinator sees the outcome without reopening the record. Column indices follow the screen's
 * columns in data/screens.generated.ts; the last column is always the status.
 */

const S = (label: string, tone: Tone): [string, Tone] => [label, tone];
const v = (id: string) => (vals: Record<string, string>) => vals[id] ?? "";
const num = (cell: Cell | undefined) => parseInt(String(typeof cell === "object" && cell ? cell.label : cell ?? "0").replace(/[^\d]/g, ""), 10) || 0;
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const STALL_STATUS_TONE: Record<string, Tone> = {
  Planned: "grey",
  "Setup pending": "amber",
  Active: "green",
  "Temporarily closed": "amber",
  Maintenance: "red",
  Inactive: "grey",
};

export const OPS_EFFECTS: Record<string, Record<string, OpsActionEffect>> = {
  deliveries: {
    "Assign rider": { status: S("Rider assigned", "blue"), set: { 3: v("rider") } },
    "Reassign rider": { status: S("Rider reassigned", "blue"), set: { 3: v("rider") } },
    "Reattempt delivery": { status: (x) => S(`Reattempt · ${x.when ?? "scheduled"}`, "amber") },
    "Mark delivered": { status: S("Delivered", "green"), set: { 6: () => "—" } },
    "Mark failed": { status: (x) => S(`Failed — ${(x.reason ?? "").toLowerCase()}`, "red") },
    "Refund delivery": { status: S("Refunded", "grey") },
  },
  "bd-queue": {
    "Group into batch": { status: S("Batched", "green"), set: { 6: () => "New batch" } },
    "Add to existing batch": { status: S("Batched", "green"), set: { 6: (x) => (x.batch ?? "").split(" ")[0] ?? "" } },
    "Remove from batch": { status: S("Removed from batch", "amber"), set: { 6: () => "—" } },
    "Mark priority": { status: (x) => S(`Priority — ${(x.level ?? "").toLowerCase()}`, "blue") },
    "Exclude from bulk": { status: (x) => S(`Excluded — ${(x.route2 ?? "").toLowerCase()}`, "grey") },
  },
  "bd-batches": {
    "Assign vehicle": { status: S("Vehicle assigned", "blue"), set: { 2: (x) => (x.vehicle ?? "").split(" · ").slice(0, 2).reverse().join(" · ") } },
    "Assign operator": { status: S("Operator assigned", "blue"), set: { 3: v("operator") } },
    "Optimise route": { status: S("Route optimised", "green") },
    "Run dispatch checklist": {
      status: (x) =>
        Object.entries(x).some(([k, val]) => k !== "note" && /^No/.test(val))
          ? S("Checklist failed", "red")
          : S("Ready for dispatch", "green"),
    },
    "Dispatch batch": { status: S("In transit", "blue") },
    "Pause batch": { status: S("Paused", "amber") },
    "Resume batch": { status: S("In transit", "blue") },
    "Split batch": { status: (x) => S(`Split — ${(x.into ?? "").toLowerCase()}`, "amber") },
    "Cancel batch": { status: S("Cancelled", "grey") },
  },
  "bd-stops": {
    "Mark delivered": { status: S("Delivered", "green"), set: { 5: () => nowHm(), 6: () => "2 min" } },
    "Reattempt stop": { status: S("Re-queued at end of run", "blue") },
    "Skip stop": { status: (x) => S(`Skipped — ${(x.reason ?? "").toLowerCase()}`, "amber") },
    "Move to tomorrow": { status: (x) => S(`Moved to tomorrow · ${(x.slot ?? "").toLowerCase()}`, "grey") },
    "Re-queue at end of run": { status: S("Re-queued at end of run", "blue") },
    "Report stop issue": { status: (x) => S(`Issue — ${(x.issue ?? "").toLowerCase()}`, "red") },
  },
  "bd-route": {
    "Optimise route": { status: S("Optimised", "green") },
    "Lock stop": { status: S("Locked — priority", "blue") },
    "Unlock stop": { status: S("Optimised", "green") },
    "Move stop": { status: (x) => S(`Moved to position ${x.to ?? "?"}`, "amber") },
    "Add stop": { status: S("Added to route", "blue") },
    "Remove stop": { status: (x) => S(`Removed — ${(x.what ?? "").toLowerCase()}`, "grey") },
    "Apply route": { status: S("Applied", "green") },
  },
  "bd-track": {
    "Skip stop": { status: S("Stop skipped", "amber") },
    "Re-route remaining": { status: S("Re-routed", "blue") },
    "Pause batch": { status: (x) => S(`Paused — ${(x.reason ?? "").toLowerCase()}`, "amber") },
    "Close trip": { status: S("Trip closed", "green"), set: { 6: () => "0", 5: () => "—" } },
  },
  "bd-ops": {
    "Assign vehicle": { status: S("Vehicle assigned", "blue"), set: { 2: (x) => (x.vehicle ?? "").split(" · ").slice(0, 2).join(" · ") } },
    "Assign batch": { status: (x) => S((x.batch2 ?? "").split(" ")[0] ?? "Batch assigned", "blue") },
    "Renew licence": { status: S("Available", "green"), set: { 1: (x) => `${x.cls} · to ${x.until}` } },
    "Mark off duty": { status: (x) => S(x.reason || "Off duty", "grey") },
  },
  "bd-exceptions": {
    "Reattempt stop": { status: S("Reattempt scheduled", "blue") },
    "Skip stop": { status: S("Stop skipped", "amber") },
    "Re-route remaining": { status: S("Route re-optimised", "blue") },
    "Reassign to rider": { status: (x) => S(`Reassigned to ${x.rider}`, "blue") },
    "Return to store": { status: S("Returning to store", "amber") },
    "Refund order": { status: S("Refunded", "grey") },
    Escalate: { status: (x) => S(`Escalated — ${x.to}`, "red") },
    "Resolve exception": { status: S("Resolved", "green"), set: { 6: v("outcome") } },
  },
  vehicles: {
    "Assign to store": { set: { 2: v("store") } },
    "Assign driver": { status: S("Driver assigned", "blue"), set: { 4: v("driver") } },
    "Set delivery mode": {
      set: { 1: (x) => (/Bulk/.test(x.mode ?? "") ? "E-auto · bulk" : /bike/.test(x.mode ?? "") ? "Bike · single" : "Cycle · single") },
    },
    "Log maintenance": { status: (x) => S(`In service — ${(x.type ?? "").toLowerCase()}`, "amber") },
    "Renew document": { status: S("Documents current", "green") },
    "Mark available": { status: S("Available", "green"), set: { 2: v("store") } },
    "Retire vehicle": { status: S("Retired", "grey") },
  },
  "bulk-dispatch": {
    "Match vehicle": { status: S("Vehicle matched", "blue"), set: { 1: (x) => (x.vehicle ?? "").split(" · ")[0] ?? "" } },
    "Assign driver": { status: S("Assigned", "blue"), set: { 2: v("driver") } },
    "Split into trips": { status: S("Split into trips", "amber") },
    "Dispatch load": { status: S("Dispatched", "blue") },
  },
  "bulk-track": {
    "Mark delivered": { status: S("Delivered", "green"), set: { 6: () => nowHm() } },
    "Close trip": { status: S("Delivered", "green") },
  },

  "stall-areas": {
    "Map dark store": { set: { 1: (x) => `${x.store} · supplies all 9` } },
    "Plan stalls": { status: (x) => S(`${x.count} stall(s) planned`, "blue") },
    "Set area target": { status: (x) => S(`Target: ${x.value} ${(x.metric ?? "").toLowerCase()}`, "blue") },
    "Review performance": { status: (x) => S(x.verdict ?? "Reviewed", x.verdict === "Place under review" ? "red" : "green") },
  },
  stalls: {
    "Assign employee": { status: S("Active", "green"), set: { 3: (x) => (x.who ?? "").replace(/^EMP-\d+\s*/, "") } },
    "Change status": { status: (x) => S(x.status ?? "Active", STALL_STATUS_TONE[x.status ?? ""] ?? "grey") },
    "Close temporarily": { status: (x) => S(`Closed — ${(x.reason ?? "").toLowerCase()}`, "amber") },
    "Deactivate stall": { status: S("Inactive", "grey"), set: { 3: () => "—" } },
    "Edit stall": { set: { 0: (x, row) => (x.name ? `${String(row[0]).split(" ")[0]} ${x.name}` : String(row[0])), 2: (x, row) => x.address || String(row[2]) } },
  },
  "stall-staff": {
    "Assign to stall": { status: S("Active", "green"), set: { 1: v("area"), 2: v("stall") } },
    "Reassign stall": { status: S("Active", "green"), set: { 2: v("stall") } },
    "Set fixed salary": { set: { 6: (x) => rupees(num(x.amount ?? "0")) } },
    "Mark on leave": { status: (x) => S(`Leave to ${x.to}`, "amber") },
    "Review performance": { status: (x) => S(x.verdict ?? "Reviewed", x.verdict === "Place under review" ? "red" : "green") },
    "Suspend employee": { status: S("Suspended", "red") },
  },
  "stall-conv": {
    "Reattribute conversion": { status: S("Reattributed", "blue"), set: { 1: (x, row) => (x.to === "Organic — no stall" ? "Organic" : x.stall || String(row[1])) } },
    "Flag as invalid": { status: (x) => S(`Invalid — ${(x.reason ?? "").toLowerCase()}`, "red") },
  },
  "stall-orders": {
    "Reattribute conversion": { status: S("Reattributed", "blue"), set: { 2: (x, row) => (x.to === "Organic — no stall" ? "Organic" : x.stall || String(row[2])) } },
  },
  "stall-ads": {
    "Assign to stalls": { status: S("Running", "green"), set: { 3: (x) => (x.scope === "One area" ? x.area ?? "" : x.scope ?? "") } },
    "Schedule campaign": { status: (x) => S(`Starts ${x.start}`, "blue"), set: { 5: (x) => `${x.start}–${x.end}`, 4: v("stalls") } },
    "Replace creative": { set: { 1: v("type") } },
    "Extend window": { status: S("Running", "green"), set: { 5: (x, row) => `${String(row[5]).split("–")[0]}–${x.until}` } },
    "End campaign": { status: S("Ended", "grey") },
  },
  "stall-samples": {
    "Approve allocation": { status: S("Distributing", "green"), set: { 4: v("qty"), 6: (x, row) => String(Math.max(0, num(x.qty ?? "0") - num(row[5]))) } },
    "Allocate samples": { status: S("Awaiting approval", "amber"), set: { 1: v("product"), 4: v("qty") } },
    "Record distribution": {
      set: {
        5: (x, row) => String(num(row[5]) + num(x.qty ?? "0")),
        6: (x, row) => String(Math.max(0, num(row[6]) - num(x.qty ?? "0"))),
      },
      status: S("Distributing", "green"),
    },
    "Reconcile allocation": { status: S("Reconciled", "grey"), set: { 5: v("distributed") } },
    "Reorder samples": { status: S("Reorder raised", "blue") },
  },
  "stall-incentives": {
    "Create new version": { status: S("Draft", "grey"), set: { 6: (_x, row) => `v${num(row[6]) + 1}`, 4: (x, row) => (x.change === "Amount" ? x.value ?? "" : String(row[4])) } },
    "Submit for approval": { status: S("Awaiting approval", "amber") },
    "Approve rule": { status: S("Active", "green") },
    "Schedule rule": { status: (x) => S(`Starts ${x.start}`, "blue"), set: { 5: v("scope") } },
    "Expire rule": { status: S("Expired", "grey") },
  },
  "stall-earnings": {
    "Approve earning": { status: S("Approved", "green") },
    "Adjust incentive": {
      set: {
        4: (x, row) => rupees(Math.max(0, num(row[4]) + (x.dir === "Deduct" ? -1 : 1) * num(x.amount ?? "0"))),
        6: (x, row) => rupees(Math.max(0, num(row[6]) + (x.dir === "Deduct" ? -1 : 1) * num(x.amount ?? "0"))),
      },
    },
    "Hold payment": { status: (x) => S(`On hold — ${(x.reason ?? "").toLowerCase()}`, "red") },
    "Release with salary": { status: (x) => S(`Paid with ${x.month} salary`, "green") },
  },
};

function nowHm(): string {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}
