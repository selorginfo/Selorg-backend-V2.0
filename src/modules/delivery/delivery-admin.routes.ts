import { Router } from 'express';
import { RESOURCE_MOUNTS } from '../delivery-stalls/ops-catalog';
import {
  bindResource,
  deleteOpsRecord,
  getOpsRoute,
  getOpsRouteKpis,
  postOpsAction,
  postOpsAdvance,
  postOpsSave,
  postRoutingCalculate,
} from '../delivery-stalls/ops.controller';
import * as bulk from './bulk-order.controller';

const router = Router();

router.get('/ops-routes/:route', getOpsRoute);
router.get('/ops-routes/:route/kpis', getOpsRouteKpis);
router.post('/ops-routes/:route/actions', postOpsAction);
router.post('/ops-routes/:route/records', postOpsSave);
router.delete('/ops-routes/:route/records/:id', deleteOpsRecord);
router.post('/ops-routes/:route/records/:id/advance', postOpsAdvance);
router.post('/routing/calculate', postRoutingCalculate);

for (const mount of RESOURCE_MOUNTS.filter((item) => item.module === 'delivery')) {
  const h = bindResource(mount);
  const p = mount.path;
  router.get(`${p}/kpis`, h.kpis);
  router.get(`${p}/export`, h.export);
  router.post(`${p}/bulk/:action`, h.bulk);
  router.post(p, h.create);
  router.get(p, h.list);
  router.get(`${p}/:${mount.idParam}`, h.get);
  router.patch(`${p}/:${mount.idParam}`, h.patch);
  router.delete(`${p}/:${mount.idParam}`, h.remove);
  router.post(`${p}/:${mount.idParam}/advance`, h.advance);
  router.post(`${p}/:${mount.idParam}/:action`, h.action);
}

const bulkOrders = Router();
bulkOrders.get('/products', bulk.products);
bulkOrders.get('/', bulk.list);
bulkOrders.post('/', bulk.create);
bulkOrders.get('/:id', bulk.get);
bulkOrders.post('/:id/status', bulk.setStatus);
bulkOrders.post('/:id/payment-status', bulk.setPayment);
bulkOrders.post('/:id/assign-picker', bulk.assignPicker);
bulkOrders.post('/:id/assign-rider', bulk.assignRider);
bulkOrders.post('/:id/cancel', bulk.cancel);
router.use('/bulk-orders', bulkOrders);

export default router;
