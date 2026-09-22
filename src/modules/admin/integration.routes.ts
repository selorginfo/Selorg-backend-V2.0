import { Router } from 'express';
import { validate } from '../../middleware/validate.middleware';
import * as integrationController from './integration.controller';
import { updateIntegrationSchema, toggleIntegrationSchema, createWebhookSchema, createApiKeySchema } from './integration.validation';

const router = Router();

// Static paths first (before :id), matches legacy mount order.
router.get('/', integrationController.list);
router.get('/health', integrationController.health);
router.get('/webhooks', integrationController.listWebhooks);
router.post('/webhooks', validate(createWebhookSchema), integrationController.createWebhook);
router.post('/webhooks/:webhookId/retry', integrationController.retryWebhook);
router.get('/api-keys', integrationController.listApiKeys);
router.post('/api-keys', validate(createApiKeySchema), integrationController.createApiKey);
router.delete('/api-keys/:keyId', integrationController.revokeApiKey);
router.get('/logs', integrationController.listLogs);
router.get('/stats', integrationController.stats);

// Integration by id
router.put('/:id', validate(updateIntegrationSchema), integrationController.update);
router.patch('/:id', validate(toggleIntegrationSchema), integrationController.toggle);
router.post('/:id/test', integrationController.test);

export default router;
