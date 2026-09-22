import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/auth.middleware';
import * as staffController from './staff.controller';

const router = Router();

router.use(authenticateAdmin);

router.get('/summary', staffController.getSummary);
router.get('/', staffController.listRiders);
router.get('/shifts', staffController.listShifts);
router.get('/shifts/:id', staffController.getShiftById);
router.post('/shifts', staffController.createShift);
router.put('/shifts/:id', staffController.updateShift);

export default router;
