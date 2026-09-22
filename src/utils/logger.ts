import fs from 'fs';
import path from 'path';
import winston from 'winston';
import type { Request, Response } from 'express';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  }),
);

const defaultLogLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
    level: defaultLogLevel,
  }),
];

if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: logFormat,
      maxsize: 5242880,
      maxFiles: 5,
    }),
  );
}

const winstonLogger = winston.createLogger({
  level: defaultLogLevel,
  format: logFormat,
  defaultMeta: { service: 'selorg-service', version: process.env.API_VERSION || '1.0.0' },
  transports,
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log'), format: logFormat }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'rejections.log'), format: logFormat }),
  ],
});

type LogContext = Record<string, unknown> | undefined;

class Logger {
  error(message: string, context?: LogContext) {
    winstonLogger.error(message, context);
  }

  warn(message: string, context?: LogContext) {
    winstonLogger.warn(message, context);
  }

  info(message: string, context?: LogContext) {
    winstonLogger.info(message, context);
  }

  debug(message: string, context?: LogContext) {
    winstonLogger.debug(message, context);
  }

  logRequest(req: Request, res: Response, duration?: number) {
    winstonLogger.info('HTTP Request', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      userId: req.user?.userId,
      ...(duration !== undefined && { duration }),
    });
  }

  logError(error: Error, context?: LogContext) {
    winstonLogger.error(error.message, {
      ...context,
      error: { message: error.message, stack: error.stack, name: error.name },
    });
  }
}

export const logger = new Logger();
export default logger;
