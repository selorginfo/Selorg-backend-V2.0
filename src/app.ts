import './config/env';
import express, { type Request, type Response } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import xss from 'xss-clean';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';

import { appConfig } from './config/env';
import { createCorsOriginHandler, isAllowedOrigin } from './config/cors';
import { swaggerSpec } from './config/swagger';
import { logger } from './utils/logger';
import { ResponseFormatter } from './utils/response';
import { apiEnvelopeMiddleware, errorHandlerMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { getConnectionPoolHealth } from './database/mongoose';

import authRoutes from './modules/auth/auth.routes';
import legalRoutes, { adminRouter as legalAdminRoutes } from './modules/legal/legal.routes';
import faqRoutes, { adminRouter as faqAdminRoutes } from './modules/faq/faq.routes';
import bannersRoutes, { adminRouter as bannersAdminRoutes } from './modules/banners/banners.routes';
import onboardingRoutes, { adminRouter as onboardingAdminRoutes } from './modules/onboarding/onboarding.routes';
import userRoutes from './modules/user/user.routes';
import addressesRoutes from './modules/addresses/addresses.routes';
import notificationsRoutes, { adminRouter as notificationsAdminRoutes } from './modules/notifications/notifications.routes';
import productsRoutes from './modules/products/products.routes';
import couponsRoutes, { adminRouter as couponsAdminRoutes } from './modules/coupons/coupons.routes';
import categoriesRoutes, { adminRouter as categoriesAdminRoutes } from './modules/categories/categories.routes';
import cartRoutes from './modules/cart/cart.routes';
import orderRoutes, { adminOrderRouter } from './modules/orders/order.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import walletRoutes from './modules/wallet/wallet.routes';
import refundsRoutes from './modules/refunds/refunds.routes';
import invoiceRoutes from './modules/invoice/invoice.routes';
import supportRoutes, { publicRouter as publicSupportRoutes } from './modules/support/support.routes';
import adminRoutes from './modules/admin/admin.routes';
import riderRoutes from './modules/rider/rider.routes';
import pickerRoutes, { pickerAdminRouter } from './modules/picker/picker.routes';
import darkstoreRoutes from './modules/darkstore/darkstore.routes';
import vendorRoutes from './modules/vendor/vendor.routes';
import financeRoutes from './modules/finance/finance.routes';
import homeRoutes, { adminRouter as homeAdminRoutes } from './modules/home/home.routes';
import sectionsRoutes from './modules/home/sections.routes';
import staffRoutes from './modules/staff/staff.routes';
import { riderRouter as supportChatRiderRoutes, adminRouter as supportChatAdminRoutes } from './modules/support-chat/support-chat.routes';
import hhdRoutes from './modules/hhd/hhd.routes';
import logisticsRoutes from './modules/logistics/logistics.routes';
import bootstrapRoutes from './modules/bootstrap/bootstrap.routes';
import deliveryRoutes from './modules/delivery/delivery.routes';
import locationsRoutes from './modules/locations/locations.routes';
import collectionsRoutes, { adminRouter as collectionsAdminRoutes } from './modules/collections/collections.routes';
import pagesRoutes, { adminRouter as pagesAdminRoutes } from './modules/pages/pages.routes';
import cmsAdminRoutes from './modules/pages/cms.admin.routes';
import customerStoreRoutes, { merchAdminRouter as customerMerchAdminRoutes, adminDarkstoreRouter } from './modules/store/store.routes';
import searchRoutes from './modules/products/search.routes';
import sharedRoutes from './modules/shared/shared.routes';
import appConfigRoutes, { adminRouter as appConfigAdminRoutes, cancellationPolicyAdminRouter } from './modules/app-config/app-config.routes';
import warehouseRoutes from './modules/warehouse/warehouse.routes';
import paymentApiRoutes from './modules/payments/payment-api.routes';
import merchRoutes from './modules/merch/merch.routes';
import productionRoutes from './modules/production/production.routes';
import adminProductsRoutes from './modules/products/products.admin.routes';
import mastersheetRoutes from './modules/mastersheet/mastersheet.routes';
import { registerEventListeners } from './events/registerListeners';

export function createApp() {
  const app = express();

  if (appConfig.isProduction) {
    app.set('trust proxy', 1);
  }

  // Request ID — first, so every downstream log/response can correlate.
  app.use((req, res, next) => {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    req.id = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  // Request logging.
  app.use((req, res, next) => {
    const startTime = Date.now();
    logger.info('Incoming request', { requestId: req.id, method: req.method, path: req.path });
    res.on('finish', () => {
      logger.logRequest(req, res, Date.now() - startTime);
    });
    next();
  });

  // Health checks — before CORS/auth, no auth required.
  app.get('/health', (_req: Request, res: Response) => {
    res.json(
      ResponseFormatter.success({
        status: 'healthy',
        uptime: process.uptime(),
        service: 'selorg-service',
        version: appConfig.apiVersion,
      }),
    );
  });
  app.get('/healthz', (_req: Request, res: Response) => res.status(200).json({ ok: true }));
  app.get('/health/db', (_req: Request, res: Response) => {
    const health = getConnectionPoolHealth();
    res.status(health.status === 'healthy' ? 200 : 503).json(ResponseFormatter.success(health));
  });
  app.get('/health/ready', (_req: Request, res: Response) => {
    const dbReady = mongoose.connection.readyState === 1;
    const status = dbReady ? 'ready' : 'not_ready';
    res
      .status(dbReady ? 200 : 503)
      .json(ResponseFormatter.success({ status, checks: { database: { status: dbReady ? 'healthy' : 'unhealthy' } } }));
  });

  // CORS before helmet/body parsers so OPTIONS preflight succeeds.
  app.use((req, res, next) => {
    if (req.method !== 'OPTIONS') return next();
    const origin = req.headers.origin;
    if (!origin || !isAllowedOrigin(origin)) return next();
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, Idempotency-Key, Accept, Origin');
    res.header('Vary', 'Origin');
    res.sendStatus(204);
  });
  app.use(
    cors({
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Idempotency-Key', 'Accept', 'Origin'],
      exposedHeaders: ['X-Request-ID', 'Retry-After'],
      maxAge: 86400,
      origin: createCorsOriginHandler((origin, allowed) => logger.warn('CORS blocked origin', { origin, allowed })),
    }),
  );

  // Security middleware.
  app.use(
    helmet({
      contentSecurityPolicy: false, // API returns JSON; CSP is for HTML documents.
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );
  app.use(mongoSanitize());
  app.use(hpp());
  app.use(xss());
  app.use(compression({ threshold: 1024, level: 6 }));

  app.use(cookieParser());
  app.use(express.json({ limit: '12mb' }));
  app.use(express.urlencoded({ extended: true, limit: '12mb' }));
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Normalizes any raw `res.json({...})` call to the standard success/error envelope.
  app.use(apiEnvelopeMiddleware);

  // General API rate limit (per IP) for all /api/v1 routes.
  app.use(
    '/api/v1',
    rateLimit({
      windowMs: appConfig.rateLimit.windowMs,
      max: appConfig.rateLimit.maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // --- Module routes ---------------------------------------------------------
  app.use('/api/v1/customer/auth', authRoutes);
  app.use('/api/v1/customer/legal', legalRoutes);
  app.use('/api/v1/customer/admin/legal', legalAdminRoutes);
  app.use('/api/v1/customer/faq', faqRoutes);
  app.use('/api/v1/customer/admin/faq', faqAdminRoutes);
  app.use('/api/v1/customer/banners', bannersRoutes);
  app.use('/api/v1/customer/admin/banners', bannersAdminRoutes);
  app.use('/api/v1/customer/onboarding', onboardingRoutes);
  app.use('/api/v1/customer/admin/onboarding-pages', onboardingAdminRoutes);
  app.use('/api/v1/customer/user', userRoutes);
  app.use('/api/v1/customer/addresses', addressesRoutes);
  app.use('/api/v1/customer/notifications', notificationsRoutes);
  app.use('/api/v1/customer/admin/notifications', notificationsAdminRoutes);
  app.use('/api/v1/customer/sections', sectionsRoutes);
  app.use('/api/v1/customer/products', productsRoutes);
  app.use('/api/v1/customer/categories', categoriesRoutes);
  app.use('/api/v1/customer/admin/categories', categoriesAdminRoutes);
  app.use('/api/v1/customer/cart', cartRoutes);
  app.use('/api/v1/customer/orders', orderRoutes);
  app.use('/api/v1/customer/orders', invoiceRoutes);
  app.use('/api/v1/admin/orders', adminOrderRouter);
  app.use('/api/v1/customer/payments', paymentsRoutes);
  app.use('/api/v1/customer/wallet', walletRoutes);
  app.use('/api/v1/customer/coupons', couponsRoutes);
  app.use('/api/v1/customer/admin/coupons', couponsAdminRoutes);
  app.use('/api/v1/customer/refunds', refundsRoutes);
  app.use('/api/v1/customer/support', supportRoutes);
  app.use('/api/v1/support', publicSupportRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/rider', riderRoutes);
  app.use('/api/v1/picker', pickerRoutes);
  app.use('/api/v1/admin/picker', pickerAdminRouter);
  app.use('/api/v1/darkstore', darkstoreRoutes);
  app.use('/api/v1/admin/vendor', vendorRoutes);
  app.use('/api/v1/admin/finance', financeRoutes);

  // New modules from migration
  app.use('/api/v1/customer/home', homeRoutes);
  app.use('/api/v1/customer/admin/home', homeAdminRoutes);
  app.use('/api/v1/admin/staff', staffRoutes);
  app.use('/api/v1/rider/support-chat', supportChatRiderRoutes);
  app.use('/api/v1/admin/support-chat', supportChatAdminRoutes);
  app.use('/api/v1/hhd', hhdRoutes);
  if (!appConfig.isProduction) {
    // Temporary local diagnostics for order → rider handoff debugging.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { diagOrderFlowRouter } = require('./routes/diag-order-flow');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { diagHubRouter } = require('./routes/diag-hubs');
    app.use('/api/v1/diag', diagOrderFlowRouter);
    app.use('/api/v1/diag', diagHubRouter);
  }
  app.use('/api/v1/logistics', logisticsRoutes);
  app.use('/api/v1/customer/bootstrap', bootstrapRoutes);
  app.use('/api/v1/customer/delivery', deliveryRoutes);
  app.use('/api/v1/customer/locations', locationsRoutes);
  app.use('/api/v1/customer/collections', collectionsRoutes);
  app.use('/api/v1/customer/admin/collections', collectionsAdminRoutes);
  app.use('/api/v1/customer/pages', pagesRoutes);
  app.use('/api/v1/customer/admin/pages', pagesAdminRoutes);
  app.use('/api/v1/customer/admin/cms', cmsAdminRoutes);
  app.use('/api/v1/customer/store', customerStoreRoutes);
  app.use('/api/v1/customer/admin/merch', customerMerchAdminRoutes);
  app.use('/api/v1/admin/darkstores', adminDarkstoreRouter);
  app.use('/api/v1/customer/admin/cancellation-policies', cancellationPolicyAdminRouter);
  app.use('/api/v1/customer/search', searchRoutes);
  app.use('/api/v1/shared', sharedRoutes);
  app.use('/api/v1/customer/app-config', appConfigRoutes);
  app.use('/api/v1/customer/admin/app-config', appConfigAdminRoutes);
  app.use('/api/v1/warehouse', warehouseRoutes);
  app.use('/api/payment', paymentApiRoutes);
  app.use('/api/v1/merch', merchRoutes);
  app.use('/api/v1/production', productionRoutes);
  app.use('/api/v1/admin/products', adminProductsRoutes);
  app.use('/api/v1/admin/mastersheet', mastersheetRoutes);

  // Wire domain event listeners
  registerEventListeners();

  // API Documentation (Swagger).
  if (!appConfig.isProduction || process.env.ENABLE_SWAGGER === 'true') {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'Selorg API Documentation' }));
    logger.info('Swagger documentation available at /api-docs');
  }

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}

export default createApp;
