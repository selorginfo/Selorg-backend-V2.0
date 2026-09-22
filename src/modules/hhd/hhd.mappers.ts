import {
  ORDER_STATUS,
  ITEM_STATUS,
  TASK_STATUS,
  ZONE,
  OrderStatus,
  ItemStatus,
  Zone,
} from './hhd.constants';
import type { IHHDOrder, IHHDItem, IHHDBag, IHHDTask, IHHDUser, IHHDRack } from './hhd.models';

/** Strip Mongo internals and map `_id` → `id`. */
export function toClient<T extends Record<string, unknown>>(doc: T | null | undefined): Record<string, unknown> | null {
  if (!doc) return null;
  const maybeToObject = doc as unknown as { toObject?: () => Record<string, unknown> };
  const obj =
    typeof maybeToObject.toObject === 'function' ? maybeToObject.toObject() : { ...doc };
  const { _id, __v, ...rest } = obj as Record<string, unknown> & { _id?: unknown; __v?: unknown };
  const id = _id != null ? String(_id) : (rest.id as string | undefined);
  return { id, ...rest };
}

export function mapItemStatusForClient(status: string): string {
  switch (status) {
    case 'short':
    case 'on_hold':
      return ITEM_STATUS.NOT_FOUND;
    case 'reassigned':
    case 'picked':
    case 'found':
      return status === 'picked' || status === 'found' ? ITEM_STATUS.SCANNED : ITEM_STATUS.PENDING;
    default:
      return status;
  }
}

const SIZE_LABELS: Record<string, string> = {
  XS: '10L Extra Small',
  S: '15L Small',
  M: '25L Medium',
  L: '35L Large',
  XL: '50L Extra Large',
};

export function bagSizeLabel(size?: string | null, litres?: string | number | null): string {
  if (size && SIZE_LABELS[size.toUpperCase()]) {
    const litresPrefix = litres != null ? `${litres}L ` : '';
    const base = SIZE_LABELS[size.toUpperCase()];
    // Prefer litres from QR when present (e.g. BAG-25-M-4471 → "25L Medium")
    if (litres != null) {
      const sizeName = base.replace(/^\d+L\s*/, '');
      return `${litres}L ${sizeName}`;
    }
    return base;
  }
  if (litres != null) return `${litres}L`;
  return size || 'Unknown';
}

export function formatRackSlot(rackIdentifier: string, slotNumber: number): string {
  return `${rackIdentifier}·S${slotNumber}`;
}

export function deriveZoneFromRackIdentifier(rackIdentifier: string): Zone {
  const letter = rackIdentifier.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase();
  const candidate = `Zone ${letter}`;
  if (Object.values(ZONE).includes(candidate as Zone)) {
    return candidate as Zone;
  }
  return ZONE.A;
}

function leanOrder(order: IHHDOrder | Record<string, unknown>): Record<string, unknown> {
  if (typeof (order as IHHDOrder).toObject === 'function') {
    return (order as IHHDOrder).toObject();
  }
  return { ...(order as Record<string, unknown>) };
}

export function mapBagView(
  bag: IHHDBag | Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!bag) return null;
  const b = typeof (bag as IHHDBag).toObject === 'function' ? (bag as IHHDBag).toObject() : { ...bag };
  const bagId = String(b.bagId ?? '');
  const parts = bagId.split('-');
  const litres = parts.length >= 2 ? parts[1] : null;
  const size = (b.size as string) || (parts.length >= 3 ? parts[2] : undefined);
  const sizeLabel = (b.sizeLabel as string) || bagSizeLabel(size, litres);
  return {
    code: bagId,
    size: size ?? null,
    sizeLabel,
    status: b.status,
    orderId: b.orderId,
    scannedAt: b.scannedAt ?? null,
  };
}

export function mapRackTarget(
  order: Record<string, unknown>,
  rack?: IHHDRack | Record<string, unknown> | null,
): Record<string, unknown> | null {
  const targetCode = (order.targetRackCode as string) || (order.rackLocation as string) || null;
  if (!targetCode && !rack && !(order.targetRiderName || order.riderName)) return null;

  let slot = '';
  let code = targetCode || '';
  if (rack) {
    const r = typeof (rack as IHHDRack).toObject === 'function' ? (rack as IHHDRack).toObject() : { ...rack };
    code = String(r.rackCode || code);
    slot = formatRackSlot(String(r.rackIdentifier || ''), Number(r.slotNumber || 0));
  } else if (code) {
    const m = String(code).match(/^Rack-([A-Z0-9]+)-Slot(\d+)$/i);
    if (m) slot = formatRackSlot(m[1].toUpperCase(), parseInt(m[2], 10));
  }

  return {
    code: code || null,
    slot: slot || null,
    rider: (order.targetRiderName as string) || (order.riderName as string) || null,
    riderId: (order.targetRiderId as string) || (order.riderId as string) || null,
  };
}

export function mapOrderView(
  order: IHHDOrder | Record<string, unknown>,
  opts: {
    bag?: IHHDBag | Record<string, unknown> | null;
    rack?: IHHDRack | Record<string, unknown> | null;
    zoneCategory?: string | null;
  } = {},
): Record<string, unknown> {
  const o = leanOrder(order);
  const lineCount = Number(o.lineCount ?? o.itemCount ?? 0);
  const unitCount = Number(o.unitCount ?? o.itemCount ?? 0);
  const targetTimeMinutes = o.targetTime != null ? Number(o.targetTime) : null;
  const targetTimeSeconds =
    o.targetTimeSeconds != null
      ? Number(o.targetTimeSeconds)
      : targetTimeMinutes != null
        ? Math.round(targetTimeMinutes * 60)
        : null;

  const zone = String(o.zone || '');
  const zoneLabel = opts.zoneCategory ? `${zone} · ${opts.zoneCategory}` : zone;

  let pickTimeSeconds: number | null = null;
  if (o.pickTimeSeconds != null) {
    pickTimeSeconds = Number(o.pickTimeSeconds);
  } else if (o.pickTime != null) {
    // Legacy rows may store minutes; prefer seconds when startedAt/completedAt exist
    if (o.startedAt && o.completedAt) {
      pickTimeSeconds = Math.round(
        (new Date(o.completedAt as string).getTime() - new Date(o.startedAt as string).getTime()) / 1000,
      );
    } else {
      pickTimeSeconds = Math.round(Number(o.pickTime) * 60);
    }
  }

  return {
    id: String(o.orderId),
    status: o.status,
    priority: o.priority,
    zone,
    zoneLabel,
    lines: lineCount,
    units: unitCount,
    assignedAt: o.assignedAt ?? o.createdAt ?? null,
    slaDueAt: o.slaDueAt ?? null,
    targetTimeSeconds,
    recommendedBagSize: o.recommendedBagSize ?? null,
    bag: mapBagView(opts.bag ?? (o.bagId ? { bagId: o.bagId, size: undefined, status: 'scanned', orderId: o.orderId } : null)),
    rack: mapRackTarget(o, opts.rack),
    startedAt: o.startedAt ?? null,
    completedAt: o.completedAt ?? null,
    pickTimeSeconds,
    bagId: o.bagId ?? null,
  };
}

export function mapItemView(item: IHHDItem | Record<string, unknown>): Record<string, unknown> {
  const i =
    typeof (item as IHHDItem).toObject === 'function'
      ? (item as IHHDItem).toObject()
      : { ...(item as Record<string, unknown>) };
  const id = i._id != null ? String(i._id) : String(i.id ?? '');
  return {
    id,
    name: i.name,
    itemCode: i.itemCode,
    crate: i.crate ?? null,
    packSize: i.packSize ?? null,
    gram: i.packSize ?? null,
    mrp: i.mrp ?? null,
    expiryDate: i.expiryDate ?? null,
    expiry: i.expiryDate ?? null,
    bin: i.location ?? null,
    qty: Number(i.quantity ?? 1),
    scannedQty: Number(i.scannedQuantity ?? 0),
    status: mapItemStatusForClient(String(i.status)),
    category: i.category ?? null,
    notes: i.notes ?? null,
    substituteItemCode: i.substituteItemCode ?? null,
    scannedAt: i.scannedAt ?? null,
  };
}

export function mapTaskView(task: IHHDTask | Record<string, unknown>): Record<string, unknown> {
  const t =
    typeof (task as IHHDTask).toObject === 'function'
      ? (task as IHHDTask).toObject()
      : { ...(task as Record<string, unknown>) };
  const status = String(t.status);
  const sub =
    (t.description as string) ||
    (t.orderId ? `Order ${t.orderId} · ${t.priority || 'medium'}` : String(t.priority || 'Pending'));
  return {
    id: t._id != null ? String(t._id) : String(t.id ?? ''),
    title: t.title,
    sub,
    done: status === TASK_STATUS.COMPLETED,
    status,
    priority: t.priority,
    orderId: t.orderId ?? null,
    dueDate: t.dueDate ?? null,
    completedAt: t.completedAt ?? null,
  };
}

export function mapUserView(user: IHHDUser | Record<string, unknown>): Record<string, unknown> {
  const u =
    typeof (user as IHHDUser).toObject === 'function'
      ? (user as IHHDUser).toObject()
      : { ...(user as Record<string, unknown>) };
  return {
    id: u._id != null ? String(u._id) : String(u.id ?? ''),
    mobile: u.mobile ?? null,
    name: u.name ?? null,
    email: u.email ?? null,
    warehouse: u.warehouse ?? null,
    darkstore: (u.darkstore as string) || (u.warehouse as string) || null,
    role: u.role,
    deviceId: u.deviceId ?? null,
    isActive: u.isActive !== false,
    lastLogin: u.lastLogin ?? null,
    shift: u.shift ?? null,
  };
}

export function isActivePickStatus(status: string): boolean {
  return (
    status === ORDER_STATUS.PENDING ||
    status === ORDER_STATUS.RECEIVED ||
    status === ORDER_STATUS.BAG_SCANNED ||
    status === ORDER_STATUS.PICKING ||
    status === ORDER_STATUS.PHOTO_VERIFIED ||
    status === ORDER_STATUS.RACK_ASSIGNED
  );
}

export function frontendOrderStatus(status: string): OrderStatus | string {
  if (
    status === ORDER_STATUS.PHOTO_VERIFIED ||
    status === ORDER_STATUS.RACK_ASSIGNED ||
    status === ORDER_STATUS.HANDED_OFF
  ) {
    return ORDER_STATUS.COMPLETED;
  }
  return status;
}

export type OrderProgress = {
  scannedUnits: number;
  totalUnits: number;
  lineIndex: number;
  linesRemaining: number;
  pickComplete: boolean;
};

export function computeOrderProgress(items: Array<IHHDItem | Record<string, unknown>>): OrderProgress {
  let scannedUnits = 0;
  let totalUnits = 0;
  let resolvedLines = 0;
  let firstUnresolvedIndex = 0;
  let foundUnresolved = false;

  items.forEach((raw, idx) => {
    const i =
      typeof (raw as IHHDItem).toObject === 'function'
        ? (raw as IHHDItem).toObject()
        : (raw as Record<string, unknown>);
    const qty = Number(i.quantity ?? 1);
    const scanned = Number(i.scannedQuantity ?? 0);
    const status = mapItemStatusForClient(String(i.status));
    totalUnits += qty;

    if (status === ITEM_STATUS.NOT_FOUND || status === ITEM_STATUS.SUBSTITUTED) {
      scannedUnits += qty;
      resolvedLines += 1;
      return;
    }
    if (status === ITEM_STATUS.SCANNED || status === ITEM_STATUS.COMPLETED) {
      scannedUnits += qty;
      resolvedLines += 1;
      return;
    }
    scannedUnits += Math.min(scanned, qty);
    if (scanned >= qty) {
      resolvedLines += 1;
    } else if (!foundUnresolved) {
      firstUnresolvedIndex = idx;
      foundUnresolved = true;
    }
  });

  const linesRemaining = Math.max(0, items.length - resolvedLines);
  return {
    scannedUnits,
    totalUnits,
    lineIndex: foundUnresolved ? firstUnresolvedIndex : Math.max(0, items.length - 1),
    linesRemaining,
    pickComplete: linesRemaining === 0 && items.length > 0,
  };
}
