import { Router } from 'express';
import * as homeController from './home.controller';

const router = Router();

router.get('/:key/products', homeController.getSectionProducts);

export default router;
