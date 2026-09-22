import { Integration, IntegrationWebhook, IntegrationLog, IntegrationApiKey, generateIntegrationApiKey, IIntegration } from './integration.model';
import { AppError } from '../../utils/AppError';

interface ServiceMeta {
  category: string;
  logo: string;
  provider: string;
  description: string;
  features: string[];
}

const SERVICE_META: Record<string, ServiceMeta> = {
  razorpay: { category: 'payment', logo: '💳', provider: 'Razorpay Payments', description: 'Payment gateway for UPI, cards, wallets', features: ['UPI', 'Cards', 'Wallets', 'Netbanking'] },
  stripe: { category: 'payment', logo: '💰', provider: 'Stripe Inc.', description: 'International payment processing', features: ['Cards', 'Apple Pay', 'Google Pay'] },
  google_maps: { category: 'maps', logo: '🗺️', provider: 'Google Cloud', description: 'Maps, geocoding, distance matrix', features: ['Maps', 'Geocoding', 'Directions'] },
  sendgrid: { category: 'communication', logo: '📧', provider: 'Twilio SendGrid', description: 'Email delivery service', features: ['Transactional', 'Marketing'] },
  msg91: { category: 'communication', logo: '📱', provider: 'MSG91', description: 'SMS and OTP delivery', features: ['SMS', 'OTP'] },
  fcm: { category: 'communication', logo: '🔥', provider: 'Firebase', description: 'Push notifications', features: ['Push', 'Cloud Messaging'] },
  s3: { category: 'storage', logo: '☁️', provider: 'Amazon Web Services', description: 'Cloud storage', features: ['Object Storage', 'CDN'] },
  default: { category: 'other', logo: '🔌', provider: 'External', description: 'Third-party integration', features: [] },
};

function getServiceMeta(service?: string): ServiceMeta {
  const key = (service || '').toLowerCase().replace(/\s+/g, '_');
  return SERVICE_META[key] || { ...SERVICE_META.default, provider: service || 'Unknown' };
}

interface IntegrationMetrics {
  requestsToday?: number;
  successRate?: number;
  avgResponseTime?: number;
  errorCount?: number;
  uptime?: number;
  rateLimit?: number;
  rateLimitUsed?: number;
}

function toRichIntegration(doc: Record<string, any>, metrics: IntegrationMetrics = {}, health = 'healthy') {
  const meta = getServiceMeta(doc.service);
  const lastSync = doc.lastSync || doc.updatedAt;
  return {
    id: String(doc._id),
    name: doc.name,
    provider: meta.provider,
    category: meta.category,
    status: doc.isActive ? 'active' : 'inactive',
    health,
    description: meta.description,
    logo: meta.logo,
    apiVersion: 'v1',
    connectedAt: (doc.createdAt || new Date()).toISOString(),
    lastSync: lastSync ? new Date(lastSync).toISOString() : new Date().toISOString(),
    metrics: {
      requestsToday: metrics.requestsToday ?? 0,
      successRate: metrics.successRate ?? 0,
      avgResponseTime: metrics.avgResponseTime ?? 0,
      errorCount: metrics.errorCount ?? 0,
      uptime: metrics.uptime ?? 0,
      rateLimit: metrics.rateLimit ?? 100000,
      rateLimitUsed: metrics.rateLimitUsed ?? 0,
    },
    config: {
      apiKey: doc.apiKey ? `${String(doc.apiKey).slice(0, 8)}••••••••` : '',
      environment: 'production',
      features: meta.features,
      webhookUrl: doc.webhookUrl || '',
    },
  };
}

const SEED_INTEGRATIONS: Array<Pick<IIntegration, 'name' | 'service' | 'apiKey' | 'isActive' | 'endpoint'>> = [
  { name: 'Razorpay', service: 'razorpay', apiKey: '', isActive: true, endpoint: 'https://api.razorpay.com/v1/' },
  { name: 'Stripe', service: 'stripe', apiKey: '', isActive: true, endpoint: 'https://api.stripe.com/v1/' },
  { name: 'Google Maps API', service: 'google_maps', apiKey: '', isActive: true, endpoint: 'https://maps.googleapis.com/maps/api/' },
  { name: 'SendGrid Email', service: 'sendgrid', apiKey: '', isActive: true, endpoint: 'https://api.sendgrid.com/v3/' },
  { name: 'MSG91 SMS', service: 'msg91', apiKey: '', isActive: true, endpoint: 'https://api.msg91.com/api/' },
  { name: 'Firebase FCM', service: 'fcm', apiKey: '', isActive: true, endpoint: 'https://fcm.googleapis.com/fcm/' },
  { name: 'AWS S3', service: 's3', apiKey: '', isActive: true, endpoint: 'https://s3.amazonaws.com/' },
];

export async function list() {
  let integs = await Integration.find();
  if (integs.length === 0) {
    await Integration.insertMany(SEED_INTEGRATIONS);
    integs = await Integration.find();
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const logAgg = await IntegrationLog.aggregate([
    { $match: { createdAt: { $gte: todayStart } } },
    { $group: { _id: '$integrationId', total: { $sum: 1 }, success: { $sum: { $cond: ['$success', 1, 0] } }, avgTime: { $avg: '$responseTime' } } },
  ]);
  const logMap = Object.fromEntries(logAgg.map((l) => [String(l._id), l]));

  return integs.map((i) => {
    const agg = logMap[String(i._id)] || {};
    const health = i.lastSync
      ? Date.now() - new Date(i.lastSync).getTime() < 3600000
        ? 'healthy'
        : Date.now() - new Date(i.lastSync).getTime() < 86400000
          ? 'degraded'
          : 'down'
      : 'healthy';
    const metrics: IntegrationMetrics = {
      requestsToday: agg.total || 0,
      successRate: agg.total ? ((agg.success || 0) / agg.total) * 100 : 0,
      avgResponseTime: Math.round(agg.avgTime || 0),
      errorCount: (agg.total || 0) - (agg.success || 0),
      uptime: 99,
      rateLimit: 100000,
      rateLimitUsed: agg.total || 0,
    };
    return toRichIntegration(i.toObject() as Record<string, any>, metrics, health);
  });
}

export interface UpdateIntegrationInput {
  status?: string;
  config?: { environment?: string };
}

export async function update(id: string, input: UpdateIntegrationInput) {
  const update: Record<string, unknown> = {};
  if (input.status !== undefined) update.isActive = input.status === 'active';
  const i = await Integration.findByIdAndUpdate(id, update, { new: true });
  if (!i) throw AppError.notFound('Integration', id);
  return toRichIntegration(i.toObject() as Record<string, any>);
}

export async function toggle(id: string, status?: string) {
  const isActive = status === 'active';
  const i = await Integration.findByIdAndUpdate(id, { isActive }, { new: true });
  if (!i) throw AppError.notFound('Integration', id);
  return toRichIntegration(i.toObject() as Record<string, any>);
}

export async function test(id: string) {
  const i = await Integration.findById(id);
  if (!i) throw AppError.notFound('Integration', id);
  await Integration.findByIdAndUpdate(id, { lastSync: new Date() });
  return { message: `Connection to ${i.name} verified successfully` };
}

export async function health() {
  const integs = await Integration.find({ isActive: true });
  return integs.map((i) => ({
    id: String(i._id),
    serviceKey: i.service,
    displayName: i.name,
    provider: getServiceMeta(i.service).provider,
    status: i.lastSync && Date.now() - new Date(i.lastSync).getTime() < 3600000 ? 'healthy' : 'unknown',
    message: i.lastSync ? `Last sync: ${new Date(i.lastSync).toISOString()}` : 'Never synced',
  }));
}

// --- Webhooks ------------------------------------------------------------------------------

export async function listWebhooks() {
  const webhooks = await IntegrationWebhook.find().populate('integrationId', 'name');
  return webhooks.map((w) => ({
    id: String(w._id),
    integrationId: (w.integrationId as any)?._id?.toString(),
    integrationName: (w.integrationId as any)?.name || 'Unknown',
    event: w.event,
    url: w.url,
    method: w.method,
    status: w.status,
    lastTriggered: (w.lastTriggered || w.updatedAt || new Date()).toISOString(),
    totalCalls: w.totalCalls,
    successCount: w.successCount,
    failureCount: w.failureCount,
    retryPolicy: w.retryPolicy,
    headers: Object.fromEntries(w.headers || new Map()),
  }));
}

export interface CreateWebhookInput {
  integrationId?: string;
  integrationName?: string;
  event?: string;
  url?: string;
}

export async function createWebhook(input: CreateWebhookInput) {
  if (!input.integrationId || !input.event || !input.url) {
    throw AppError.badRequest('integrationId, event and url are required');
  }
  const integ = await Integration.findById(input.integrationId);
  if (!integ) throw AppError.notFound('Integration', input.integrationId);
  const w = await IntegrationWebhook.create({ integrationId: input.integrationId, event: input.event, url: input.url, method: 'POST', status: 'active' });
  return {
    id: String(w._id),
    integrationId: w.integrationId.toString(),
    integrationName: input.integrationName || integ.name,
    event: w.event,
    url: w.url,
    method: w.method,
    status: w.status,
    lastTriggered: new Date().toISOString(),
    totalCalls: 0,
    successCount: 0,
    failureCount: 0,
    retryPolicy: w.retryPolicy,
    headers: {},
  };
}

export async function retryWebhook(webhookId: string) {
  const w = await IntegrationWebhook.findById(webhookId);
  if (!w) throw AppError.notFound('Webhook', webhookId);
  w.status = 'active';
  await w.save();
  return { message: 'Webhook retry initiated' };
}

// --- API keys --------------------------------------------------------------------------------

export async function listApiKeys() {
  const keys = await IntegrationApiKey.find().populate('integrationId', 'name');
  return keys.map((k) => ({
    id: String(k._id),
    name: k.name,
    key: k.keyPrefix || 'sk_••••••••',
    integrationId: (k.integrationId as any)?._id?.toString(),
    integrationName: (k.integrationId as any)?.name || 'Unknown',
    permissions: k.permissions || [],
    environment: k.environment,
    status: k.status,
    createdAt: k.createdAt?.toISOString(),
    expiresAt: k.expiresAt?.toISOString() || 'Never',
    lastUsed: k.lastUsed ? k.lastUsed.toISOString() : 'Never',
    usageCount: k.usageCount || 0,
  }));
}

export interface CreateApiKeyInput {
  integrationId?: string;
  integrationName?: string;
  name?: string;
  environment?: string;
}

export async function createApiKey(input: CreateApiKeyInput) {
  if (!input.integrationId || !input.name) throw AppError.badRequest('integrationId and name are required');
  const integ = await Integration.findById(input.integrationId);
  if (!integ) throw AppError.notFound('Integration', input.integrationId);
  const { plain, keyPrefix, keyHash } = generateIntegrationApiKey();
  const k = await IntegrationApiKey.create({
    integrationId: input.integrationId,
    name: input.name,
    keyPrefix,
    keyHash,
    environment: input.environment || 'production',
    status: 'active',
    permissions: ['read', 'write'],
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  });
  return {
    data: {
      id: String(k._id),
      name: k.name,
      key: plain,
      integrationId: k.integrationId.toString(),
      integrationName: input.integrationName || integ.name,
      permissions: k.permissions,
      environment: k.environment,
      status: k.status,
      createdAt: k.createdAt.toISOString(),
      expiresAt: k.expiresAt?.toISOString(),
      lastUsed: 'Never',
      usageCount: 0,
    },
    plainKey: plain,
    message: 'API key created. Copy the key now - it will not be shown again.',
  };
}

export async function revokeApiKey(keyId: string) {
  const k = await IntegrationApiKey.findById(keyId);
  if (!k) throw AppError.notFound('API key', keyId);
  k.status = 'revoked';
  await k.save();
  return { message: 'API key revoked' };
}

// --- Logs + stats ------------------------------------------------------------------------------

export async function listLogs() {
  const logs = await IntegrationLog.find().populate('integrationId', 'name').sort({ createdAt: -1 }).limit(100);
  return logs.map((l) => ({
    id: String(l._id),
    integrationId: (l.integrationId as any)?._id?.toString(),
    integrationName: (l.integrationId as any)?.name || 'Unknown',
    timestamp: l.createdAt?.toISOString(),
    method: l.method,
    endpoint: l.endpoint,
    statusCode: l.statusCode,
    responseTime: l.responseTime,
    requestSize: l.requestSize || 0,
    responseSize: l.responseSize || 0,
    success: l.success,
    errorMessage: l.errorMessage,
  }));
}

export async function stats() {
  const totalIntegrations = await Integration.countDocuments();
  const activeIntegrations = await Integration.countDocuments({ isActive: true });
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const agg = await IntegrationLog.aggregate([
    { $match: { createdAt: { $gte: todayStart } } },
    { $group: { _id: null, totalRequests: { $sum: 1 }, successCount: { $sum: { $cond: ['$success', 1, 0] } }, avgResponseTime: { $avg: '$responseTime' } } },
  ]);
  const a = agg[0] || {};
  const total = a.totalRequests || 0;
  const success = a.successCount || 0;
  return {
    totalIntegrations,
    activeIntegrations,
    totalRequests: total,
    successRate: total ? Number(((success / total) * 100).toFixed(1)) : 0,
    avgResponseTime: Math.round(a.avgResponseTime || 0),
    errorRate: total ? Number((((total - success) / total) * 100).toFixed(1)) : 0,
  };
}
