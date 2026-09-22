/** HHD device order flow status. */
export const ORDER_STATUS = {
  PENDING: 'pending',
  RECEIVED: 'received',
  BAG_SCANNED: 'bag_scanned',
  PICKING: 'picking',
  COMPLETED: 'completed',
  PHOTO_VERIFIED: 'photo_verified',
  RACK_ASSIGNED: 'rack_assigned',
  HANDED_OFF: 'handed_off',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const ITEM_STATUS = {
  PENDING: 'pending',
  FOUND: 'found',
  NOT_FOUND: 'not_found',
  SCANNED: 'scanned',
  COMPLETED: 'completed',
  SUBSTITUTED: 'substituted',
} as const;

export type ItemStatus = (typeof ITEM_STATUS)[keyof typeof ITEM_STATUS];

export const BAG_STATUS = {
  SCANNED: 'scanned',
  IN_USE: 'in_use',
  PHOTO_TAKEN: 'photo_taken',
  COMPLETED: 'completed',
} as const;

export type BagStatus = (typeof BAG_STATUS)[keyof typeof BAG_STATUS];

export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export const TASK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type TaskPriority = (typeof TASK_PRIORITY)[keyof typeof TASK_PRIORITY];

/** Order priority for HHD orders (delivery/pick urgency). */
export const ORDER_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type OrderPriority = (typeof ORDER_PRIORITY)[keyof typeof ORDER_PRIORITY];

export const USER_ROLE = {
  PICKER: 'picker',
  SUPERVISOR: 'supervisor',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export const ZONE = {
  A: 'Zone A',
  B: 'Zone B',
  C: 'Zone C',
  D: 'Zone D',
} as const;

export type Zone = (typeof ZONE)[keyof typeof ZONE];

export const PICK_ISSUE_TYPE = {
  ITEM_DAMAGED: 'ITEM_DAMAGED',
  ITEM_MISSING: 'ITEM_MISSING',
  ITEM_EXPIRED: 'ITEM_EXPIRED',
  WRONG_ITEM: 'WRONG_ITEM',
} as const;

export type PickIssueType = (typeof PICK_ISSUE_TYPE)[keyof typeof PICK_ISSUE_TYPE];

export const INVENTORY_STATUS = {
  AVAILABLE: 'available',
  DAMAGED: 'damaged',
  EXPIRED: 'expired',
  BLOCKED: 'blocked',
  RESERVED: 'reserved',
} as const;

export type InventoryStatus = (typeof INVENTORY_STATUS)[keyof typeof INVENTORY_STATUS];

export const ITEM_STATUS_EXTENDED = {
  ...ITEM_STATUS,
  PICKED: 'picked',
  SHORT: 'short',
  ON_HOLD: 'on_hold',
  REASSIGNED: 'reassigned',
} as const;

export type ItemStatusExtended = (typeof ITEM_STATUS_EXTENDED)[keyof typeof ITEM_STATUS_EXTENDED];

export const PICK_NEXT_ACTION = {
  ALTERNATE_BIN: 'ALTERNATE_BIN',
  SKIP_ITEM: 'SKIP_ITEM',
} as const;

export type PickNextAction = (typeof PICK_NEXT_ACTION)[keyof typeof PICK_NEXT_ACTION];

export const RACK_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance',
} as const;

export type RackStatus = (typeof RACK_STATUS)[keyof typeof RACK_STATUS];

export const PHOTO_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
} as const;

export type PhotoStatus = (typeof PHOTO_STATUS)[keyof typeof PHOTO_STATUS];
