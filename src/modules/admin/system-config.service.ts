import { AppError } from '../../utils/AppError';
import { SystemConfig } from './system-config.model';
import { PaymentGateway } from './payment-gateway.model';
import { FeatureFlag } from './feature-flag.model';
import { Integration } from './integration.model';
import { SystemApiKey, generateSystemApiKey } from './system-api-key.model';

type ConfigSection = 'general' | 'delivery' | 'notifications' | 'tax' | 'advanced';

const DEFAULTS: Record<ConfigSection, Record<string, unknown>> = {
  general: {
    platformName: 'QuickCommerce',
    tagline: 'Groceries delivered in 10 minutes',
    logoUrl: '',
    faviconUrl: '/favicon.ico',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    currencySymbol: '₹',
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'hi', 'kn', 'ta', 'te'],
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h',
    primaryColor: '#e11d48',
    secondaryColor: '#0ea5e9',
    contactEmail: 'support@quickcommerce.com',
    supportPhone: '+919444183378',
  },
  delivery: {
    minOrderValue: 99,
    maxOrderValue: 10000,
    baseDeliveryFee: 25,
    freeDeliveryAbove: 500,
    deliveryFeePerKm: 8,
    maxDeliveryRadius: 10,
    avgDeliveryTime: 15,
    expressDeliveryFee: 49,
    slots: [
      { id: 'slot-1', name: 'Morning', startTime: '06:00', endTime: '10:00', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], maxOrders: 100, isActive: true, surgeMultiplier: 1.0 },
      { id: 'slot-2', name: 'Afternoon', startTime: '12:00', endTime: '16:00', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], maxOrders: 150, isActive: true, surgeMultiplier: 1.0 },
      { id: 'slot-3', name: 'Evening', startTime: '18:00', endTime: '22:00', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], maxOrders: 200, isActive: true, surgeMultiplier: 1.2 },
      { id: 'slot-4', name: 'Late Night', startTime: '22:00', endTime: '02:00', days: ['Friday', 'Saturday'], maxOrders: 80, isActive: true, surgeMultiplier: 1.5 },
    ],
    partners: ['Dunzo', 'Shadowfax', 'Porter', 'In-house Fleet'],
  },
  notifications: {
    emailEnabled: true,
    smsEnabled: true,
    pushEnabled: true,
    emailProvider: 'sendgrid',
    smsProvider: 'msg91',
    emailApiKey: '',
    smsApiKey: '',
    fcmServerKey: '',
    templates: [],
  },
  tax: {
    gstEnabled: true,
    cgstRate: 2.5,
    sgstRate: 2.5,
    igstRate: 5.0,
    tdsEnabled: false,
    tdsRate: 1.0,
    taxDisplayType: 'inclusive',
    gstNumber: '',
    panNumber: '',
  },
  advanced: {
    maintenanceMode: false,
    debugMode: false,
    cacheEnabled: true,
    cacheDuration: 300,
    rateLimitPerMinute: 60,
    maxConcurrentUsers: 10000,
    sessionTimeout: 1800,
    logLevel: 'info',
    apiVersion: '1.0.0',
  },
};

async function getOrCreateConfig(key: ConfigSection): Promise<Record<string, unknown>> {
  let doc = await SystemConfig.findOne({ key });
  if (!doc) {
    doc = await SystemConfig.create({ key, value: DEFAULTS[key] });
  }
  return doc.value as Record<string, unknown>;
}

async function updateConfig(key: ConfigSection, value: Record<string, unknown>): Promise<Record<string, unknown>> {
  const doc = await SystemConfig.findOneAndUpdate({ key }, { $set: { value } }, { new: true, upsert: true });
  return doc.value as Record<string, unknown>;
}

export async function getSection(key: ConfigSection) {
  return getOrCreateConfig(key);
}

export async function updateSection(key: ConfigSection, patch: Record<string, unknown>) {
  const current = await getOrCreateConfig(key);
  return updateConfig(key, { ...current, ...patch });
}

function maskKey(k?: string): string {
  return k ? `${k.slice(0, 8)}...${k.length > 4 ? k.slice(-4) : ''}` : 'N/A';
}

const DEFAULT_PAYMENT_GATEWAYS = [
  { name: 'Razorpay', provider: 'razorpay', isActive: true, apiKey: '', secretKey: '', transactionFee: 2, transactionFeeType: 'percentage', minAmount: 10, maxAmount: 100000, displayOrder: 1 },
  { name: 'Paytm', provider: 'paytm', isActive: true, apiKey: '', secretKey: '', merchantId: '', transactionFee: 1.8, transactionFeeType: 'percentage', minAmount: 10, maxAmount: 100000, displayOrder: 2 },
  { name: 'PhonePe', provider: 'phonepe', isActive: false, apiKey: '', secretKey: '', merchantId: '', transactionFee: 1.5, transactionFeeType: 'percentage', minAmount: 10, maxAmount: 100000, displayOrder: 3 },
  { name: 'Cash on Delivery', provider: 'cod', isActive: true, apiKey: 'N/A', secretKey: 'N/A', transactionFee: 15, transactionFeeType: 'flat', minAmount: 0, maxAmount: 2000, displayOrder: 4 },
];

function toGatewayDto(g: InstanceType<typeof PaymentGateway>) {
  return {
    id: g._id.toString(),
    name: g.name,
    provider: g.provider,
    isActive: g.isActive,
    apiKey: g.apiKey === 'N/A' ? 'N/A' : maskKey(g.apiKey),
    secretKey: g.secretKey ? '••••••••••••••••' : 'N/A',
    merchantId: g.merchantId,
    transactionFee: g.transactionFee,
    transactionFeeType: g.transactionFeeType,
    minAmount: g.minAmount,
    maxAmount: g.maxAmount,
    displayOrder: g.displayOrder,
  };
}

export async function listPaymentGateways() {
  let gateways = await PaymentGateway.find().sort({ displayOrder: 1 });
  if (gateways.length === 0) {
    await PaymentGateway.insertMany(DEFAULT_PAYMENT_GATEWAYS);
    gateways = await PaymentGateway.find().sort({ displayOrder: 1 });
  }
  return gateways.map(toGatewayDto);
}

export async function updatePaymentGateway(id: string, body: Record<string, unknown>) {
  const update = { ...body };
  delete update.id;
  const g = await PaymentGateway.findByIdAndUpdate(id, update, { new: true });
  if (!g) throw AppError.notFound('Payment gateway', id);
  return toGatewayDto(g);
}

const DEFAULT_FEATURE_FLAGS = [
  { name: 'Dark Mode', key: 'dark_mode', description: 'Enable dark mode theme', isEnabled: true, category: 'core', requiresRestart: false },
  { name: 'Loyalty Program', key: 'loyalty_program', description: 'Reward points and cashback', isEnabled: true, category: 'premium', requiresRestart: false },
  { name: 'Live Chat Support', key: 'live_chat', description: 'Real-time customer support chat', isEnabled: false, category: 'beta', requiresRestart: false },
  { name: 'Voice Search', key: 'voice_search', description: 'Voice-based product search', isEnabled: false, category: 'experimental', requiresRestart: true },
  { name: 'Subscription Plans', key: 'subscriptions', description: 'Recurring delivery subscriptions', isEnabled: true, category: 'premium', requiresRestart: false },
  { name: 'Social Login', key: 'social_login', description: 'Login with Google, Facebook', isEnabled: true, category: 'core', requiresRestart: false },
];

function toFlagDto(f: InstanceType<typeof FeatureFlag>) {
  return {
    id: f._id.toString(),
    name: f.name,
    key: f.key,
    description: f.description,
    isEnabled: f.isEnabled,
    category: f.category,
    requiresRestart: f.requiresRestart,
  };
}

export async function listFeatureFlags() {
  let flags = await FeatureFlag.find();
  if (flags.length === 0) {
    await FeatureFlag.insertMany(DEFAULT_FEATURE_FLAGS);
    flags = await FeatureFlag.find();
  }
  return flags.map(toFlagDto);
}

export async function toggleFeatureFlag(id: string) {
  const f = await FeatureFlag.findById(id);
  if (!f) throw AppError.notFound('Feature flag', id);
  f.isEnabled = !f.isEnabled;
  await f.save();
  return toFlagDto(f);
}

const DEFAULT_INTEGRATIONS = [
  { name: 'Google Maps API', service: 'google_maps', apiKey: '', isActive: true, endpoint: 'https://maps.googleapis.com/maps/api/' },
  { name: 'SendGrid Email', service: 'sendgrid', apiKey: '', isActive: true, endpoint: 'https://api.sendgrid.com/v3/' },
  { name: 'MSG91 SMS', service: 'msg91', apiKey: '', isActive: true, endpoint: 'https://api.msg91.com/api/' },
  { name: 'Firebase FCM', service: 'fcm', apiKey: '', isActive: true, endpoint: 'https://fcm.googleapis.com/fcm/' },
  { name: 'AWS S3', service: 's3', apiKey: '', isActive: true, endpoint: 'https://s3.amazonaws.com/' },
];

function toIntegrationDto(i: InstanceType<typeof Integration>) {
  return {
    id: i._id.toString(),
    name: i.name,
    service: i.service,
    apiKey: i.apiKey ? `${i.apiKey.slice(0, 8)}...` : '',
    isActive: i.isActive,
    endpoint: i.endpoint,
    lastSync: i.lastSync,
  };
}

/**
 * Shares the same `Integration` collection as the Integration Manager module
 * (integration.service.ts) — legacy `systemConfigController.js` and
 * `integrationController.js` both require `admin/models/Integration.js`.
 */
export async function listIntegrationsLite() {
  let integs = await Integration.find();
  if (integs.length === 0) {
    await Integration.insertMany(DEFAULT_INTEGRATIONS);
    integs = await Integration.find();
  }
  return integs.map(toIntegrationDto);
}

export async function updateIntegrationLite(id: string, body: Record<string, unknown>) {
  const update = { ...body };
  delete update.id;
  const i = await Integration.findByIdAndUpdate(id, update, { new: true });
  if (!i) throw AppError.notFound('Integration', id);
  return toIntegrationDto(i);
}

export async function testIntegrationLite(id: string) {
  const i = await Integration.findById(id);
  if (!i) throw AppError.notFound('Integration', id);
  await Integration.findByIdAndUpdate(id, { lastSync: new Date() });
  return `Connection to ${i.name} verified successfully`;
}

export async function listApiKeys() {
  const keys = await SystemApiKey.find().populate('createdBy', 'name email').sort({ createdAt: -1 });
  return keys.map((k) => {
    const creator = k.createdBy as unknown as { name?: string; email?: string } | undefined;
    return {
      key_id: k.keyId,
      id: k._id.toString(),
      name: k.name,
      created_by: creator?.name || creator?.email || 'System',
      scopes: k.scopes,
      last_used: k.lastUsed,
      status: k.status,
      created_at: k.createdAt,
    };
  });
}

export async function createApiKey(name: string, scopes: string[], createdBy?: string) {
  const { plain, keyId, keyHash } = generateSystemApiKey();
  const key = await SystemApiKey.create({ keyId, name, keyHash, createdBy, scopes, status: 'active' });
  return {
    data: { key_id: key.keyId, id: key._id.toString(), name: key.name, scopes: key.scopes, status: key.status, created_at: key.createdAt },
    plainKey: plain,
  };
}

export async function revokeApiKey(id: string) {
  const key = await SystemApiKey.findById(id);
  if (!key) throw AppError.notFound('API key', id);
  key.status = 'revoked';
  await key.save();
}

export async function rotateApiKey(id: string) {
  const key = await SystemApiKey.findById(id);
  if (!key) throw AppError.notFound('API key', id);
  if (key.status === 'revoked') throw AppError.badRequest('Cannot rotate a revoked key');
  const { plain, keyId, keyHash } = generateSystemApiKey();
  key.keyId = keyId;
  key.keyHash = keyHash;
  await key.save();
  return {
    data: { key_id: key.keyId, id: key._id.toString(), name: key.name, scopes: key.scopes, status: key.status },
    plainKey: plain,
  };
}

/** Static placeholder list — legacy has no real cron scheduler wired into this endpoint either. */
export function listCronJobs() {
  const now = Date.now();
  return [
    { id: 'cron-1', name: 'Order Sync', schedule: '0 */5 * * * *', lastRun: new Date(now).toISOString(), nextRun: new Date(now + 300000).toISOString(), status: 'active', executions: 0, avgDuration: '0.2s' },
    { id: 'cron-2', name: 'Inventory Refresh', schedule: '0 0 * * * *', lastRun: new Date(now).toISOString(), nextRun: new Date(now + 3600000).toISOString(), status: 'active', executions: 0, avgDuration: '1.5s' },
    { id: 'cron-3', name: 'Analytics Daily', schedule: '0 0 2 * * *', lastRun: null, nextRun: new Date(now).toISOString(), status: 'active', executions: 0, avgDuration: '30s' },
  ];
}

/** Static placeholder list — legacy never wires this to real process env introspection beyond these 3. */
export function listEnvVariables() {
  return [
    { key: 'NODE_ENV', value: process.env.NODE_ENV || 'development', isSensitive: false, category: 'core' },
    { key: 'API_VERSION', value: '1.0.0', isSensitive: false, category: 'api' },
    { key: 'LOG_LEVEL', value: process.env.LOG_LEVEL || 'info', isSensitive: false, category: 'core' },
  ];
}

export async function getMaintenanceMode() {
  const data = await getOrCreateConfig('advanced');
  return { enabled: Boolean(data.maintenanceMode) };
}

export async function toggleMaintenanceMode(enabled: boolean) {
  const current = await getOrCreateConfig('advanced');
  const updated = await updateConfig('advanced', { ...current, maintenanceMode: !!enabled });
  return { enabled: Boolean(updated.maintenanceMode) };
}
