import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import { authenticateCustomer } from '../../middleware/auth.middleware';
import * as cartController from './cart.controller';
import { addCartItemSchema, mergeCartSchema, removeCartItemSchema, updateCartItemByProductVariantSchema, updateCartItemSchema } from './cart.validation';

const router = Router();

router.get('/', authenticateCustomer, cartController.getCart);
router.post('/items', authenticateCustomer, validate(addCartItemSchema), cartController.addCartItem);
// Idempotent guest-cart merge on login (exactly once per mergeKey)
router.post('/merge', authenticateCustomer, validate(mergeCartSchema), cartController.mergeCart);
// Update by product + variant (no cart line id) — must be before /items/:itemId
router.put('/items', authenticateCustomer, validate(updateCartItemByProductVariantSchema), cartController.updateCartItemByProductVariant);
router.put('/items/:itemId', authenticateCustomer, validate(updateCartItemSchema), cartController.updateCartItem);
router.delete('/items/:itemId', authenticateCustomer, validate(removeCartItemSchema), cartController.removeCartItem);
router.delete('/clear', authenticateCustomer, cartController.clear);

export default router;
