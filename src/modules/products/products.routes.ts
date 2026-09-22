import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import * as productsController from './products.controller';
import { productDetailQuerySchema } from './products.validation';

const router = Router();

router.get('/search', productsController.searchProducts);
router.get('/search/suggestions', productsController.searchSuggestions);
router.get('/search/trending', productsController.getTrendingSearches);
router.get('/:id', validate(productDetailQuerySchema, 'query'), productsController.getProductDetail);

export default router;
