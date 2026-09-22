import './config/env';
import { createServer } from 'http';
import { createApp } from './app';
import { appConfig, validateEnvironment } from './config/env';
import { validateJWTSecret } from './middleware/auth.middleware';
import { connectDB, waitForConnection } from './database/mongoose';
import { logger } from './utils/logger';
import { warmSmtpConnection, logEmailProviderStatus } from './services/email.service';
import { initRealtime } from './services/realtime.service';

async function bootstrap() {
  if (!appConfig.isTest) {
    try {
      validateEnvironment();
      validateJWTSecret();
    } catch (error) {
      logger.error('Startup validation failed', { error: (error as Error).message });
      process.exit(1);
    }
  }

  const app = createApp();
  const httpServer = createServer(app);
  initRealtime(httpServer);

  if (appConfig.isTest) {
    return app;
  }

  try {
    await connectDB();
    await waitForConnection(30000);
    const { ensurePickerDocumentIndexes } = await import('./modules/picker/picker.models');
    await ensurePickerDocumentIndexes();
  } catch (dbErr) {
    logger.error('Cannot start server without database', {
      error: (dbErr as Error).message,
      hint: 'Check MONGO_URI in selorg-service/.env and that MongoDB is reachable.',
    });
    process.exit(1);
  }

  const { initOrderRealtime } = await import('./realtime/orderRealtime');
  initOrderRealtime(httpServer);

  httpServer
    .listen(appConfig.port, appConfig.host, () => {
      logger.info('Server started', {
        host: appConfig.host,
        port: appConfig.port,
        nodeEnv: appConfig.nodeEnv,
        version: appConfig.apiVersion,
      });
      logEmailProviderStatus();
      warmSmtpConnection().catch(() => undefined);
    })
    .on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.error('Port already in use', {
          port: appConfig.port,
          suggestion: `Set a different PORT in .env, or: lsof -ti:${appConfig.port} | xargs kill -9`,
        });
      } else {
        logger.error('Server startup error', { error: err.message, stack: err.stack });
      }
      process.exit(1);
    });

  return app;
}

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection', { error: (err as Error)?.message, stack: (err as Error)?.stack });
});

process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.error('Port conflict detected', { error: err.message, port: appConfig.port });
    process.exit(1);
    return;
  }

  const msg = String(err?.message || '');
  // tesseract.js worker can emit fatal image-decode errors as uncaughtException.
  // Do not take down the API process for OCR failures — uploads must keep working.
  if (
    /attempting to read image|Invalid SOS parameters|tesseract|ImageProcessor/i.test(msg) ||
    /tesseract\.js/i.test(String(err?.stack || ''))
  ) {
    logger.error('Uncaught OCR/image worker exception (process kept alive)', {
      error: msg,
      stack: err.stack,
    });
    return;
  }

  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

if (!appConfig.isTest) {
  bootstrap();
}

export { bootstrap };
