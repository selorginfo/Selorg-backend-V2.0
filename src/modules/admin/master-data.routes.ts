import { Router } from 'express';
import * as masterDataController from './master-data.controller';

const router = Router();

// Cities
router.get('/cities', masterDataController.listCities);
router.get('/cities/:id', masterDataController.getCity);
router.post('/cities', masterDataController.createCity);
router.put('/cities/:id', masterDataController.updateCity);
router.delete('/cities/:id', masterDataController.deleteCity);

// Zones
router.get('/zones', masterDataController.listZones);
router.get('/zones/:id', masterDataController.getZone);
router.post('/zones', masterDataController.createZone);
router.put('/zones/:id', masterDataController.updateZone);
router.delete('/zones/:id', masterDataController.deleteZone);

// Vehicle types
router.get('/vehicle-types', masterDataController.listVehicleTypes);
router.get('/vehicle-types/:id', masterDataController.getVehicleType);
router.post('/vehicle-types', masterDataController.createVehicleType);
router.put('/vehicle-types/:id', masterDataController.updateVehicleType);
router.delete('/vehicle-types/:id', masterDataController.deleteVehicleType);

// SKU units
router.get('/sku-units', masterDataController.listSkuUnits);
router.get('/sku-units/:id', masterDataController.getSkuUnit);
router.post('/sku-units', masterDataController.createSkuUnit);
router.put('/sku-units/:id', masterDataController.updateSkuUnit);
router.delete('/sku-units/:id', masterDataController.deleteSkuUnit);

export default router;
