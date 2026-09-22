import { Router } from 'express';
import { searchProducts, searchSuggestions, getTrendingSearches } from './products.controller';

// Standalone /search router — mirrors routes registered under /products for
// clients that call GET /api/v1/customer/search directly.
const router = Router();

router.get('/', searchProducts);
router.get('/suggestions', searchSuggestions);
router.get('/trending', getTrendingSearches);

export default router;
