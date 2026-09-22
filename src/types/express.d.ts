import 'express';

export interface AdminAuthUser {
  userId: string;
  email?: string;
  roleId?: string;
  role?: string;
  name?: string;
  permissions: string[];
  assignedStores: string[];
  primaryStoreId?: string;
  warehouseKey?: string;
  hubKey?: string;
}

export interface CustomerAuthUser {
  _id: string;
  profile?: Record<string, unknown>;
}

export interface HHDAuthUser {
  id: string;
  mobile: string;
  role: string;
}

/**
 * Rider (picker) identity resolved by picker.auth.middleware.ts. The fields are the
 * ones every rider handler needs for authorization and hub scoping, so they are
 * loaded once instead of re-queried per service call.
 */
export interface PickerAuthUser {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'REJECTED' | 'SUSPENDED' | 'BLOCKED' | 'DELETION_PENDING';
  deliveryMode: 'standard' | 'bulk';
  currentLocationId?: string | null;
  activeShiftId?: string | null;
  isOnline: boolean;
  workforceRole?: 'picker' | 'rider' | null;
}

declare global {
  namespace Express {
    interface Request {
      id: string;
      /** Set by middleware/auth.middleware.ts `authenticateAdmin` (dashboard JWT). */
      user?: AdminAuthUser;
      /** Set by middleware/auth.middleware.ts `authenticateCustomer` / `optionalCustomerAuth`. */
      customer?: CustomerAuthUser;
      /** Set by hhd.auth.middleware.ts `protect` (HHD device JWT). */
      hhdUser?: HHDAuthUser;
      /** Set by picker/picker.auth.middleware.ts `authenticatePicker` (rider JWT). */
      pickerId?: string;
      /** Set alongside `pickerId`; the rider's authorization-relevant state. */
      picker?: PickerAuthUser;
      rawBody?: Buffer;
    }
  }
}
