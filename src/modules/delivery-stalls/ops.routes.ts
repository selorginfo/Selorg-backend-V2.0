import { Router } from 'express';
import { RESOURCE_MOUNTS } from './ops-catalog';
import {
  bindResource,
  postAttributeOrder,
  postConversion,
  postInteraction,
  postPreview,
  postRelease,
} from './ops.controller';

/** Container stall screens only. Delivery and B2C bulk orders are mounted from the delivery module. */
const router = Router();

router.post('/stall-incentive-rules/preview', postPreview);
router.post('/stall-earnings/release', postRelease);
router.post('/stall-orders/attribute', postAttributeOrder);

for (const mount of RESOURCE_MOUNTS.filter((item) => item.module === 'stalls')) {
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

export const stallAppRouter = Router();
stallAppRouter.post('/interactions', postInteraction);
stallAppRouter.post('/conversions', postConversion);

export default router;
