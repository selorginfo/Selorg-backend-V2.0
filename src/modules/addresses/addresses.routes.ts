import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { authenticateCustomer } from '../../middleware/auth.middleware';
import * as addressesController from './addresses.controller';
import { createAddressSchema, updateAddressSchema } from './addresses.validation';

const router = Router();

router.get('/', authenticateCustomer, addressesController.list);
router.get('/default', authenticateCustomer, addressesController.getDefault);
router.post('/', authenticateCustomer, validate(createAddressSchema), addressesController.create);
router.put('/:id', authenticateCustomer, validate(updateAddressSchema), addressesController.update);
router.delete('/:id', authenticateCustomer, addressesController.remove);
router.post('/:id/default', authenticateCustomer, addressesController.setDefault);

export default router;
