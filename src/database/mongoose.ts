import dns from 'dns';
import mongoose, { ConnectOptions } from 'mongoose';
import { logger } from '../utils/logger';

// Fail fast when DB is down instead of buffering queries for 10s (e.g. login lookups).
mongoose.set('bufferCommands', false);

function configureDnsResolvers() {
  const fromEnv = (process.env.DNS_SERVERS || process.env.MONGO_DNS_SERVERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s.toLowerCase() !== 'system');
  const usePublicDns =
    process.env.MONGO_USE_PUBLIC_DNS === 'true' ||
    (process.env.MONGO_USE_PUBLIC_DNS !== 'false' && process.platform === 'win32' && fromEnv.length === 0);
  const defaults = usePublicDns ? ['8.8.8.8', '1.1.1.1'] : [];
  const servers = fromEnv.length > 0 ? fromEnv : defaults;
  if (servers.length === 0) return;
  dns.setServers(servers);
  logger.info('DNS resolvers configured for MongoDB', { servers });
}

async function resolveSrvMongoUri(srvUri: string): Promise<string> {
  if (!srvUri || !srvUri.startsWith('mongodb+srv://')) return srvUri;

  const withoutScheme = srvUri.slice('mongodb+srv://'.length);
  const atIndex = withoutScheme.lastIndexOf('@');
  const credsPart = atIndex >= 0 ? withoutScheme.slice(0, atIndex) : '';
  const hostAndRest = atIndex >= 0 ? withoutScheme.slice(atIndex + 1) : withoutScheme;
  const slashIndex = hostAndRest.indexOf('/');
  const hostname = slashIndex >= 0 ? hostAndRest.slice(0, slashIndex) : hostAndRest.split('?')[0];
  const pathAndQuery = slashIndex >= 0 ? hostAndRest.slice(slashIndex) : '';

  const srvRecords = await dns.promises.resolveSrv(`_mongodb._tcp.${hostname}`);
  const hosts = srvRecords.map((r) => `${r.name}:${r.port}`).join(',');

  const pathOnly = pathAndQuery.split('?')[0] || '';
  const params = new URLSearchParams(pathAndQuery.includes('?') ? pathAndQuery.slice(pathAndQuery.indexOf('?') + 1) : '');
  if (!params.has('ssl')) params.set('ssl', 'true');
  if (credsPart && !params.has('authSource')) params.set('authSource', 'admin');
  if (!params.has('retryWrites')) params.set('retryWrites', 'true');
  if (!params.has('w')) params.set('w', 'majority');

  const query = params.toString();
  const prefix = credsPart ? `mongodb://${credsPart}@` : 'mongodb://';
  return `${prefix}${hosts}${pathOnly}${query ? `?${query}` : ''}`;
}

async function prepareMongoUri(uri: string): Promise<string> {
  configureDnsResolvers();
  if (!uri.startsWith('mongodb+srv://')) return uri;
  const shouldResolve =
    process.platform === 'win32' ||
    Boolean(process.env.DNS_SERVERS?.trim()) ||
    Boolean(process.env.MONGO_DNS_SERVERS?.trim());
  if (!shouldResolve) return uri;

  try {
    const resolved = await resolveSrvMongoUri(uri);
    logger.info('Resolved mongodb+srv URI to standard connection string');
    return resolved;
  } catch (err) {
    logger.warn('SRV pre-resolve failed; connecting with mongodb+srv and alternate DNS', {
      error: (err as Error).message,
    });
    return uri;
  }
}

function buildConnectOptions(uri: string): ConnectOptions {
  const options: ConnectOptions = {
    maxPoolSize: 50,
    minPoolSize: 10,
    waitQueueTimeoutMS: 5000,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
    retryWrites: true,
    w: 'majority',
    connectTimeoutMS: 10000,
    heartbeatFrequencyMS: 30000,
  };
  // authSource: admin breaks local/no-auth URIs; only set when credentials are present.
  if (/@/.test(uri)) {
    (options as Record<string, unknown>).authSource = 'admin';
  }
  return options;
}

let connectPromise: Promise<void> | null = null;
let poolMonitorStarted = false;

export function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function waitForConnection(timeoutMs = 10000): Promise<void> {
  if (isConnected()) return;
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (isConnected()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('MongoDB connection timeout'));
      setTimeout(check, 100);
    };
    check();
  });
}

function setupPoolMonitoring() {
  if (poolMonitorStarted) return;
  poolMonitorStarted = true;
  const interval = setInterval(() => {
    try {
      const stats = getPoolStatistics();
      if (stats.utilization > 80) {
        logger.warn('[DB Pool] High utilization detected', {
          utilization: `${stats.utilization}%`,
          active: stats.activeConnections,
          available: stats.availableConnections,
          waiting: stats.waitingRequests,
        });
      }
      if (stats.waitingRequests > 0) {
        logger.warn('[DB Pool] Requests waiting for connection', { count: stats.waitingRequests });
      }
    } catch {
      // Monitoring is non-critical.
    }
  }, 30000);
  process.on('exit', () => clearInterval(interval));
}

export function getPoolStatistics() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = mongoose.connection.getClient() as any;
    const pool = client?.topology?.s?.pool;
    const activeConnections = pool?.checkedOut || 0;
    const availableConnections = pool?.availableConnectionCount || 0;
    const waitingRequests = pool?.waitQueue?.length || 0;
    const maxPoolSize = 50;
    const utilization = maxPoolSize > 0 ? Math.round((activeConnections / maxPoolSize) * 100) : 0;
    return {
      activeConnections,
      availableConnections,
      waitingRequests,
      maxPoolSize,
      utilization,
      status: utilization > 80 ? 'HIGH' : utilization > 50 ? 'MEDIUM' : 'LOW',
    };
  } catch {
    return {
      activeConnections: 0,
      availableConnections: 0,
      waitingRequests: 0,
      maxPoolSize: 50,
      utilization: 0,
      status: 'UNKNOWN',
    };
  }
}

export function getConnectionPoolHealth() {
  const stats = getPoolStatistics();
  const isHealthy = stats.waitingRequests < 5 && stats.utilization < 90;
  return { status: isHealthy ? 'healthy' : 'degraded', pool: stats, timestamp: new Date().toISOString() };
}

export async function connectDB(): Promise<void> {
  try {
    const rawUri =
      process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/selorg';
    const uri = await prepareMongoUri(rawUri);

    const conn = await mongoose.connect(uri, buildConnectOptions(uri));

    logger.info('MongoDB Connected', {
      host: conn.connection.host,
      database: conn.connection.name,
      poolSize: { min: 10, max: 50 },
    });

    setupPoolMonitoring();
  } catch (err) {
    const message = (err as Error).message;
    const srvHint =
      message.includes('querySrv') || message.includes('ECONNREFUSED')
        ? 'DNS blocked mongodb+srv. Set DNS_SERVERS=8.8.8.8,1.1.1.1 (or MONGO_USE_PUBLIC_DNS=true) in .env'
        : undefined;
    logger.error('Database connection error', { error: message, hint: srvHint });
    if (process.env.NODE_ENV === 'test') {
      logger.warn('Test mode: continuing without database');
      return;
    }
    throw err;
  }
}

export async function ensureDbConnection(timeoutMs = 15000): Promise<void> {
  if (isConnected()) return;

  const state = mongoose.connection.readyState;
  if (state === 0 || state === 3) {
    if (!connectPromise) {
      connectPromise = connectDB().finally(() => {
        connectPromise = null;
      });
    }
    try {
      await connectPromise;
    } catch {
      throw Object.assign(
        new Error('Database is not available. Please ensure MongoDB is running and MONGO_URI is correct.'),
        { statusCode: 503 },
      );
    }
  }

  try {
    await waitForConnection(timeoutMs);
  } catch {
    throw Object.assign(
      new Error('Database is not available. Please ensure MongoDB is running and MONGO_URI is correct.'),
      { statusCode: 503 },
    );
  }
}

export { mongoose };
export default connectDB;
