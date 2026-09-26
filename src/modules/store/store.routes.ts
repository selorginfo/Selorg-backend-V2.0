import { Router } from 'express';
import { optionalCustomerAuth, authenticateAdmin, requireRole } from '../../middleware/auth.middleware';
import {
  assignStore,
  getStoreInventory,
  listStoresAdmin,
  createStoreAdmin,
  updateStoreAdmin,
  deleteStoreAdmin,
  updateStoreInventoryAdmin,
  syncStoreInventoryAdmin,
  getStoreInventoryHistoryAdmin,
  triggerStoreReplenishmentAdmin,
} from './store.controller';

const router = Router();

router.post('/assign', optionalCustomerAuth, assignStore);
router.get('/:storeId/inventory', optionalCustomerAuth, getStoreInventory);

const STORE_ADMIN_ROLES = [
  'admin',
  'super_admin',
  'darkstore',
  'dark_store_manager',
  'store_manager',
  'warehouse',
  'warehouse_manager',
  'operations_admin',
  'operations',
] as const;

export const merchAdminRouter = Router();
merchAdminRouter.use(authenticateAdmin, requireRole(...STORE_ADMIN_ROLES));
merchAdminRouter.get('/stores', listStoresAdmin);
merchAdminRouter.post('/stores', createStoreAdmin);
merchAdminRouter.put('/stores/:id', updateStoreAdmin);
merchAdminRouter.delete('/stores/:id', deleteStoreAdmin);
merchAdminRouter.put('/inventory/:storeId', updateStoreInventoryAdmin);
merchAdminRouter.post('/inventory/:storeId/sync', syncStoreInventoryAdmin);
merchAdminRouter.get('/inventory/:storeId/history', getStoreInventoryHistoryAdmin);
merchAdminRouter.post('/inventory/:storeId/replenish', triggerStoreReplenishmentAdmin);

// Cleaner top-level admin router mounted at /api/v1/admin/darkstores (see app.ts).
export const adminDarkstoreRouter = Router();
adminDarkstoreRouter.use(authenticateAdmin, requireRole(...STORE_ADMIN_ROLES));
adminDarkstoreRouter.get('/', listStoresAdmin);
adminDarkstoreRouter.post('/', createStoreAdmin);
adminDarkstoreRouter.put('/:id', updateStoreAdmin);
adminDarkstoreRouter.delete('/:id', deleteStoreAdmin);
adminDarkstoreRouter.put('/:storeId/inventory', updateStoreInventoryAdmin);
adminDarkstoreRouter.get('/:storeId/inventory', getStoreInventoryHistoryAdmin);
adminDarkstoreRouter.post('/:storeId/inventory/sync', syncStoreInventoryAdmin);
adminDarkstoreRouter.post('/:storeId/replenish', triggerStoreReplenishmentAdmin);

export default router;
