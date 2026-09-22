import { Router } from 'express';
import * as storeWarehouseController from './store-warehouse.controller';

const router = Router();

// Stores (specific paths before :id)
router.get('/stores/performance', storeWarehouseController.getStorePerformance);
router.get('/stores/stats', storeWarehouseController.getStoreStats);
router.get('/stores', storeWarehouseController.listStores);
router.get('/stores/:id', storeWarehouseController.getStore);
router.post('/stores', storeWarehouseController.createStore);
router.put('/stores/:id', storeWarehouseController.updateStore);
router.delete('/stores/:id', storeWarehouseController.deleteStore);

// Warehouses (legacy Store-model read/update)
router.get('/warehouses-legacy', storeWarehouseController.listWarehouses);
router.get('/warehouses-legacy/:id', storeWarehouseController.getWarehouse);

// Warehouses (schema-driven — warehouse_locations collection)
router.get('/warehouses', storeWarehouseController.listWarehouseLocations);
router.get('/warehouses/:id', storeWarehouseController.getWarehouseLocation);
router.post('/warehouses', storeWarehouseController.createWarehouseLocation);
router.put('/warehouses/:id', storeWarehouseController.updateWarehouseLocation);
router.delete('/warehouses/:id', storeWarehouseController.deleteWarehouseLocation);

// Staff (WarehouseStaff — operational staff list)
router.get('/staff', storeWarehouseController.listStaff);
router.get('/staff/:id', storeWarehouseController.getStaff);
router.post('/staff', storeWarehouseController.createStaff);
router.put('/staff/:id', storeWarehouseController.updateStaff);
router.delete('/staff/:id', storeWarehouseController.deleteStaff);

// Warehouse User Mappings (warehouse_id → user_id with role)
router.get('/warehouse-users', storeWarehouseController.listWarehouseUsers);
router.get('/warehouse-users/:id', storeWarehouseController.getWarehouseUser);
router.post('/warehouse-users', storeWarehouseController.createWarehouseUser);
router.put('/warehouse-users/:id', storeWarehouseController.updateWarehouseUser);
router.delete('/warehouse-users/:id', storeWarehouseController.deleteWarehouseUser);

// Dark Store User Mappings (darkStoreId → userId with role)
router.get('/darkstore-users', storeWarehouseController.listDarkStoreUsers);
router.post('/darkstore-users', storeWarehouseController.createDarkStoreUser);
router.put('/darkstore-users/:id', storeWarehouseController.updateDarkStoreUser);
router.delete('/darkstore-users/:id', storeWarehouseController.deleteDarkStoreUser);

export default router;
