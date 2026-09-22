import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import {
  Campaign,
  SKU,
  Collection,
  PriceChange,
  PriceRule,
  SurgeRule,
  SurgeConfig,
  DiscountCampaign,
  PricingCoupon,
  FlashSale,
  Bundle,
  MerchAlert,
  AnalyticsRecord,
  MerchComplianceCheck,
  StockConflict,
  PromoUplift,
  Allocation,
  AllocationAlert,
  Zone,
  OpsIncident,
  OpsIntegrationHealth,
  OpsException,
  OpsDispatchConfig,
  OpsSurgeConfig,
  OpsSlaConfig,
} from './merch.models';
import { AppError } from '../../utils/AppError';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatInrShort = (amount: number): string => {
  const n = Number(amount) || 0;
  if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₹${Math.round(n / 1_000)}k`;
  return `₹${Math.round(n)}`;
};

const parseKpiPercent = (kpiValue: string | undefined): number | null => {
  if (!kpiValue || typeof kpiValue !== 'string') return null;
  const m = kpiValue.match(/([\d.]+)/);
  return m ? Number(m[1]) : null;
};

const REGION_LABEL_TO_CODE: Record<string, string> = {
  'north america': 'na',
  na: 'na',
  europe: 'eu',
  eu: 'eu',
  apac: 'all',
  all: 'all',
};

const mapRegionCode = (region: string | undefined): string => {
  if (!region) return 'na';
  const key = String(region).toLowerCase().trim();
  return REGION_LABEL_TO_CODE[key] || (key.length <= 3 ? key : 'na');
};

const capitalizeCampaignType = (type: string | undefined): string => {
  const raw = String(type || 'discount').trim();
  if (!raw) return 'Discount';
  return raw
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

const buildDiscountLogic = (body: Record<string, unknown>): string => {
  if ((body.rules as Record<string, unknown>)?.discountLogic) {
    return String((body.rules as Record<string, unknown>).discountLogic);
  }
  const val = body.discountValue ?? (body.rules as Record<string, unknown> | undefined)?.discountValue;
  if (val == null || val === '') return 'Flat 20% Off';
  const dtype = String(body.discountType || 'percentage').toLowerCase();
  if (dtype === 'flat') return `Flat ₹${val} Off`;
  if (dtype === 'bogo') return 'Buy One Get One';
  if (dtype === 'tiered') return `Tiered ${val}% Off`;
  return `${val}% Off`;
};

const normalizeCampaignSkuObjects = async (inputSkus: unknown[] = []): Promise<unknown[]> => {
  if (!Array.isArray(inputSkus) || inputSkus.length === 0) return [];
  const skuIds = inputSkus
    .filter((s) => typeof s === 'string' || typeof s === 'number')
    .map((s) => String(s))
    .filter(Boolean);

  let skuById = new Map<string, Record<string, unknown>>();
  if (skuIds.length > 0) {
    const docs = await SKU.find({ _id: { $in: skuIds } }).lean();
    skuById = new Map(docs.map((d) => [String(d._id), d as Record<string, unknown>]));
  }

  return inputSkus
    .map((sku) => {
      if (typeof sku === 'string' || typeof sku === 'number') {
        const id = String(sku);
        const doc = skuById.get(id);
        return {
          sku: (doc?.code as string) || id,
          name: (doc?.name as string) || id,
          category: (doc?.category as string) || 'General',
          basePrice: Number(doc?.basePrice ?? 0),
          promoPrice: Number(doc?.sellingPrice ?? doc?.basePrice ?? 0),
        };
      }
      if (!sku || typeof sku !== 'object') return null;
      const s = sku as Record<string, unknown>;
      return {
        sku: String(s.sku || s.code || s.id || s._id || ''),
        name: String(s.name || s.sku || s.code || 'Unknown SKU'),
        category: String(s.category || 'General'),
        basePrice: Number(s.basePrice ?? s.base ?? 0),
        promoPrice: Number(s.promoPrice ?? s.sell ?? s.sellingPrice ?? s.basePrice ?? 0),
      };
    })
    .filter((s) => s && (s as Record<string, unknown>).sku);
};

const normalizeCampaignPayload = async (
  body: Record<string, unknown>,
  { isPartial = false } = {},
): Promise<Record<string, unknown>> => {
  const payload = { ...body };
  if (!isPartial) {
    payload.name = payload.name || 'Untitled Campaign';
    payload.tagline = payload.tagline || payload.description || 'Campaign';
    payload.period = payload.period || 'TBD';
    payload.target = payload.target || 'Selected SKUs';
    payload.scope = payload.scope || payload.region || 'Global';
    payload.type = capitalizeCampaignType(payload.type as string | undefined);
    payload.owner = payload.owner || { name: 'System', initial: 'S' };
    if (!payload.status) payload.status = 'Draft';
  }
  if (payload.endDate && !payload.endsAt) payload.endsAt = new Date(payload.endDate as string);
  if (payload.region != null && String(payload.region).length > 3) {
    payload.region = mapRegionCode(payload.region as string);
  } else if (payload.region == null && !isPartial) {
    payload.region = mapRegionCode(payload.scope as string);
  }
  if (!payload.channel && !isPartial) payload.channel = 'all';
  if (!payload.campaignCategory && !isPartial) {
    const t = String(payload.type || '').toLowerCase();
    payload.campaignCategory = t.includes('clearance') ? 'clearance' : 'promo';
  }
  if (payload.skus != null) {
    payload.skus = await normalizeCampaignSkuObjects(payload.skus as unknown[]);
  }
  if (payload.discountValue != null || payload.discountType != null || payload.minOrderValue != null) {
    const rules = payload.rules as Record<string, unknown> | undefined;
    payload.rules = {
      discountLogic: buildDiscountLogic(payload),
      minOrder:
        payload.minOrderValue != null && payload.minOrderValue !== ''
          ? `₹${payload.minOrderValue}`
          : rules?.minOrder || '$0.00',
      segment: rules?.segment || 'All Customers',
      stackable: rules?.stackable ?? false,
    };
    const depth = Number(payload.discountValue);
    if (!Number.isNaN(depth) && depth > 0) {
      payload.performance = { ...(payload.performance as object || {}), discountDepth: depth };
    }
  }
  delete payload.description;
  delete payload.endDate;
  delete payload.discountType;
  delete payload.discountValue;
  delete payload.minOrderValue;
  return payload;
};

function toApiDoc(doc: mongoose.Document): Record<string, unknown> {
  if (!doc) return {};
  const d = doc.toObject ? doc.toObject() : (doc as unknown as Record<string, unknown>);
  return { ...d, id: String((d as Record<string, unknown>)._id) };
}

// ─── Campaign Controllers ─────────────────────────────────────────────────────

const CAMPAIGN_TYPE_FILTER_REGEX: Record<string, RegExp> = {
  discount: /discount/i,
  flash: /flash/i,
  bundle: /bundle/i,
  loyalty: /loyalty/i,
  bogo: /bogo/i,
  clearance: /clearance/i,
};

export const getCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, type, scope, region, typeFilter, running } = req.query;
    const query: Record<string, unknown> = {};

    if (running === 'true') {
      query.status = { $in: ['Active', 'Scheduled'] };
    } else if (status) {
      const statusMap: Record<string, string> = {
        active: 'Active',
        scheduled: 'Scheduled',
        draft: 'Draft',
        paused: 'Paused',
        archived: 'Archived',
        ended: 'Ended',
        stopped: 'Stopped',
      };
      query.status = statusMap[String(status).toLowerCase()] || status;
    }
    if (type) query.type = type;

    const filterKey = typeFilter ? String(typeFilter).toLowerCase() : '';
    if (filterKey && filterKey !== 'all' && filterKey !== 'all-types') {
      const regex = CAMPAIGN_TYPE_FILTER_REGEX[filterKey];
      if (regex) query.type = { $regex: regex.source, $options: 'i' };
    }
    if (scope) query.scope = scope;

    const regionKey = region ? String(region).toLowerCase() : '';
    if (regionKey && regionKey !== 'all' && regionKey !== 'all-regions') {
      const regionClause = { $or: [{ region: regionKey }, { region: 'all' }] };
      if (query.$or) {
        query.$and = [{ $or: query.$or }, regionClause];
        delete query.$or;
      } else {
        Object.assign(query, regionClause);
      }
    }

    const campaigns = await Campaign.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: campaigns.length, data: campaigns });
  } catch (err) {
    next(err);
  }
};

export const getCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      res.status(404).json({ success: false, error: `Campaign not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
};

export const createCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = await normalizeCampaignPayload(req.body || {});
    const campaign = await Campaign.create(payload);
    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
};

export const updateCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body || {};
    const keys = Object.keys(body);
    const isStatusOnly = keys.length === 1 && keys[0] === 'status';
    const payload = isStatusOnly
      ? { status: body.status }
      : await normalizeCampaignPayload(body, { isPartial: false });

    const campaign = await Campaign.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    if (!campaign) {
      res.status(404).json({ success: false, error: `Campaign not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
};

export const deleteCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const campaign = await Campaign.findByIdAndDelete(req.params.id);
    if (!campaign) {
      res.status(404).json({ success: false, error: `Campaign not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

export const getMerchStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const activeCampaigns = await Campaign.countDocuments({ status: 'Active' });
    const now = new Date();
    const endingWindowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const endingSoon = await Campaign.countDocuments({
      status: 'Active',
      endsAt: { $gte: now, $lte: endingWindowEnd },
    });
    const recentUplift = await PromoUplift.findOne().sort({ createdAt: -1 });
    const stockConflicts = await StockConflict.countDocuments({ status: 'Open' });
    const pendingPriceChanges = await PriceChange.countDocuments({ status: 'Pending' });

    const promoUpliftValue =
      recentUplift?.uplift != null ? `+${recentUplift.uplift}%` : null;

    res.status(200).json({
      success: true,
      data: {
        activeCampaigns: { value: activeCampaigns, trend: `${endingSoon} ending soon`, trendUp: true },
        promoUplift: promoUpliftValue
          ? { value: promoUpliftValue, trend: 'vs last month', trendUp: true }
          : { value: null, trend: 'No uplift sample yet', trendUp: false },
        priceChanges: { value: pendingPriceChanges, subValue: 'Pending', trend: 'Needs approval', trendUp: false },
        stockConflicts: { value: stockConflicts, trend: 'High Priority', trendUp: false },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getPerformanceReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dateRange = String(req.query.dateRange || 'last-30');
    const region = String(req.query.region || 'all');
    const channel = String(req.query.channel || 'all');
    const campaignType = String(req.query.campaignType || 'all');
    const campaignQuery: Record<string, unknown> = {};

    if (region !== 'all') {
      campaignQuery.$or = [{ region }, { region: 'all' }];
    }
    if (channel !== 'all') {
      const channelClause = { $or: [{ channel }, { channel: 'all' }] };
      if (campaignQuery.$or) {
        campaignQuery.$and = [{ $or: campaignQuery.$or }, channelClause];
        delete campaignQuery.$or;
      } else {
        Object.assign(campaignQuery, channelClause);
      }
    }
    if (campaignType !== 'all') campaignQuery.campaignCategory = campaignType;

    const [campaigns, analyticsRecords, upliftRows] = await Promise.all([
      Campaign.find(campaignQuery).sort({ createdAt: -1 }).lean(),
      AnalyticsRecord.find({ type: 'campaign' }).lean(),
      PromoUplift.find().sort({ month: -1 }).lean(),
    ]);

    const analyticsByName = new Map(
      analyticsRecords.map((r) => [String(r.entityName || '').toLowerCase(), r]),
    );
    const upliftLimit = dateRange === 'last-7' ? 1 : dateRange === 'this-quarter' ? 3 : 2;
    const periodUplift = upliftRows.slice(0, upliftLimit);
    const periodRevenue = periodUplift.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
    const periodUpliftAvg =
      periodUplift.length
        ? periodUplift.reduce((s, r) => s + (Number(r.uplift) || 0), 0) / periodUplift.length
        : 0;

    const rows = campaigns.map((c) => {
      const analytics = analyticsByName.get(String(c.name || '').toLowerCase());
      const perf = c.performance || {};
      const revenueRaw = Number(perf.revenue) || Number((analytics as Record<string, unknown> | undefined)?.revenue) || 0;
      const upliftRaw =
        (perf.uplift != null ? Number(perf.uplift) : null) ??
        ((analytics as Record<string, unknown> | undefined)?.uplift != null
          ? Number((analytics as Record<string, unknown>).uplift)
          : null) ??
        parseKpiPercent(c.kpi?.value) ??
        0;
      const roiRaw = Number(perf.roi) || Number((analytics as Record<string, unknown> | undefined)?.roi) || 0;
      const discountRaw = Number(perf.discountDepth) || 0;
      return {
        id: String(c._id),
        name: c.name,
        revenue: formatInrShort(revenueRaw),
        revenueRaw,
        uplift: upliftRaw > 0 ? `+${upliftRaw.toFixed(1)}%` : '—',
        upliftRaw,
        roi: roiRaw > 0 ? `${roiRaw.toFixed(1)}x` : '—',
        roiRaw,
        discountDepth: discountRaw,
        type: c.campaignCategory || 'promo',
        region: c.region || 'na',
        channel: c.channel || 'all',
        status: c.status,
      };
    });

    const campaignRevenue = rows.reduce((s, r) => s + (r.revenueRaw || 0), 0);
    const totalRevenueRaw = campaignRevenue > 0 ? campaignRevenue : periodRevenue;
    const upliftValues = rows.map((r) => r.upliftRaw).filter((v) => v > 0);
    const avgUpliftRaw =
      upliftValues.length > 0 ? upliftValues.reduce((a, b) => a + b, 0) / upliftValues.length : periodUpliftAvg;
    const discountValues = rows.map((r) => r.discountDepth).filter((v) => v > 0);
    const avgDiscountRaw =
      discountValues.length > 0 ? discountValues.reduce((a, b) => a + b, 0) / discountValues.length : 0;
    const activeCount = campaigns.filter((c) => c.status === 'Active').length;

    res.status(200).json({
      success: true,
      data: {
        filters: { dateRange, region, channel, campaignType },
        kpis: {
          totalRevenue: formatInrShort(totalRevenueRaw),
          totalRevenueRaw,
          uplift: avgUpliftRaw > 0 ? `+${avgUpliftRaw.toFixed(1)}%` : '—',
          upliftRaw: avgUpliftRaw,
          activeCampaigns: String(activeCount),
          avgDiscount: avgDiscountRaw > 0 ? `${avgDiscountRaw.toFixed(1)}%` : '—',
          avgDiscountRaw,
        },
        campaigns: rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getStockConflicts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const conflicts = await StockConflict.find().sort({ severity: 1 });
    res.status(200).json({ success: true, count: conflicts.length, data: conflicts });
  } catch (err) {
    next(err);
  }
};

export const createStockConflict = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const conflict = await StockConflict.create(req.body);
    res.status(201).json({ success: true, data: conflict });
  } catch (err) {
    next(err);
  }
};

export const getPromoUplift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const upliftData = await PromoUplift.find().sort({ createdAt: 1 });
    res.status(200).json({ success: true, count: upliftData.length, data: upliftData });
  } catch (err) {
    next(err);
  }
};

export const createPromoUplift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const uplift = await PromoUplift.create(req.body);
    res.status(201).json({ success: true, data: uplift });
  } catch (err) {
    next(err);
  }
};

export const getPriceChanges = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const priceChanges = await PriceChange.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: priceChanges.length, data: priceChanges });
  } catch (err) {
    next(err);
  }
};

export const createPriceChange = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const priceChange = await PriceChange.create(req.body);
    res.status(201).json({ success: true, data: priceChange });
  } catch (err) {
    next(err);
  }
};

// ─── Catalog Controllers ──────────────────────────────────────────────────────

const CATALOG_REGIONS = ['North America', 'Europe (West)', 'APAC'];

export const getSKUs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const skus = await SKU.find();
    res.status(200).json({ success: true, count: skus.length, data: skus });
  } catch (err) {
    next(err);
  }
};

export const createSKU = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sku = await SKU.create(req.body);
    res.status(201).json({ success: true, data: sku });
  } catch (err) {
    next(err);
  }
};

export const updateSKU = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.body.visibility && Object.keys(req.body).length === 1) {
      const sku = await SKU.findById(req.params.id);
      if (!sku) {
        res.status(404).json({ success: false, error: `SKU not found with id of ${req.params.id}` });
        return;
      }
      CATALOG_REGIONS.forEach((r) => {
        if (req.body.visibility[r] != null) {
          (sku.visibility as Record<string, string>)[r] = req.body.visibility[r];
        }
      });
      sku.markModified('visibility');
      await sku.save();
      res.status(200).json({ success: true, data: sku });
      return;
    }
    const sku = await SKU.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!sku) {
      res.status(404).json({ success: false, error: `SKU not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: sku });
  } catch (err) {
    next(err);
  }
};

export const patchSKUVisibility = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { region, status } = req.body;
    if (!['Visible', 'Hidden'].includes(status)) {
      res.status(400).json({ success: false, error: 'status must be Visible or Hidden' });
      return;
    }
    const sku = await SKU.findById(req.params.id);
    if (!sku) {
      res.status(404).json({ success: false, error: `SKU not found with id of ${req.params.id}` });
      return;
    }
    if (region === 'Global') {
      CATALOG_REGIONS.forEach((r) => { (sku.visibility as Record<string, string>)[r] = status; });
    } else if (CATALOG_REGIONS.includes(region)) {
      (sku.visibility as Record<string, string>)[region] = status;
    } else {
      res.status(400).json({ success: false, error: `Invalid region: ${region}` });
      return;
    }
    sku.markModified('visibility');
    await sku.save();
    res.status(200).json({ success: true, data: sku });
  } catch (err) {
    next(err);
  }
};

export const deleteSKU = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sku = await SKU.findByIdAndDelete(req.params.id);
    if (!sku) {
      res.status(404).json({ success: false, error: `SKU not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

export const getCollections = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const collections = await Collection.find().populate('skus');
    res.status(200).json({ success: true, count: collections.length, data: collections });
  } catch (err) {
    next(err);
  }
};

export const createCollection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const collection = await Collection.create(req.body);
    res.status(201).json({ success: true, data: collection });
  } catch (err) {
    next(err);
  }
};

export const updateCollection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const collection = await Collection.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!collection) {
      res.status(404).json({ success: false, error: `Collection not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: collection });
  } catch (err) {
    next(err);
  }
};

export const deleteCollection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const collection = await Collection.findByIdAndDelete(req.params.id);
    if (!collection) {
      res.status(404).json({ success: false, error: `Collection not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

// ─── Pricing Controllers ──────────────────────────────────────────────────────

export const getPricingStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [skuCount, activeSurgeRules, activeDiscounts, pendingChanges] = await Promise.all([
      SKU.countDocuments(),
      SurgeRule.countDocuments({ status: 'active' }),
      DiscountCampaign.countDocuments({ status: 'active' }),
      PriceChange.countDocuments({ status: 'Pending' }),
    ]);
    res.status(200).json({
      success: true,
      data: { skuCount, activeSurgeRules, activeDiscounts, pendingChanges },
    });
  } catch (err) {
    next(err);
  }
};

export const getSurgeRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rules = await SurgeRule.find().sort({ priority: -1, createdAt: -1 }).lean();
    const formatted = rules.map((r) => {
      const item = { ...r, id: String(r._id) };
      if (item.conditions?.zones) {
        (item.conditions as Record<string, unknown>).zones = (item.conditions.zones as unknown[]).map((z) =>
          typeof z === 'object' && z !== null ? String((z as Record<string, unknown>)._id || z) : String(z),
        );
      }
      return item;
    });
    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    next(err);
  }
};

export const createSurgeRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rule = await SurgeRule.create(req.body);
    res.status(201).json({ success: true, data: toApiDoc(rule) });
  } catch (err) {
    next(err);
  }
};

export const updateSurgeRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rule = await SurgeRule.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!rule) {
      res.status(404).json({ success: false, error: `Surge rule not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: { ...rule, id: String(rule._id) } });
  } catch (err) {
    next(err);
  }
};

export const deleteSurgeRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rule = await SurgeRule.findByIdAndDelete(req.params.id);
    if (!rule) {
      res.status(404).json({ success: false, error: `Surge rule not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

export const getSurgeConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let config = await SurgeConfig.findOne({ key: 'default' }).lean();
    if (!config) {
      await SurgeConfig.create({ key: 'default', enabled: true });
      config = { key: 'default', enabled: true } as unknown as typeof config;
    }
    res.status(200).json({ success: true, data: { enabled: (config as Record<string, unknown>).enabled !== false } });
  } catch (err) {
    next(err);
  }
};

export const updateSurgeConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const enabled = !!req.body.enabled;
    const config = await SurgeConfig.findOneAndUpdate({ key: 'default' }, { enabled }, { new: true, upsert: true }).lean();
    res.status(200).json({ success: true, data: { enabled: (config as Record<string, unknown>).enabled !== false } });
  } catch (err) {
    next(err);
  }
};

export const getPendingPriceUpdates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updates = await PriceChange.find({ status: 'Pending' }).sort({ createdAt: -1 }).lean();
    const formatted = updates.map((u) => {
      const oldPrice = u.currentPrice ?? 0;
      const newPrice = u.proposedPrice ?? 0;
      const marginImpact =
        u.marginImpact ||
        (oldPrice > 0 ? `${(((newPrice - oldPrice) / oldPrice) * 100).toFixed(1)}%` : '—');
      return {
        ...u,
        id: String(u._id),
        skuName: u.productName || u.sku,
        oldPrice,
        newPrice,
        marginImpact,
        date: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '',
        effectiveDate: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '',
        reason: u.marginImpact || u.requestedBy || 'Price change request',
        source: (u.requestedBy || 'manual').toLowerCase().includes('rule') ? 'rule' : 'manual',
        user: u.requestedBy || 'system',
        priority: 'medium',
      };
    });
    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    next(err);
  }
};

export const handlePendingUpdate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawStatus = String(req.body.status || '');
    const status =
      rawStatus.toLowerCase() === 'approved'
        ? 'Approved'
        : rawStatus.toLowerCase() === 'rejected'
          ? 'Rejected'
          : rawStatus;
    let update = await PriceChange.findById(req.params.id);
    if (!update) {
      res.status(404).json({ success: false, error: `Price update not found with id of ${req.params.id}` });
      return;
    }
    update = await PriceChange.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
    if (status === 'Approved' && update?.sku && update.proposedPrice) {
      await SKU.findOneAndUpdate({ code: update.sku }, { sellingPrice: update.proposedPrice });
    }
    res.status(200).json({ success: true, data: { ...update!.toObject(), id: String(update!._id) } });
  } catch (err) {
    next(err);
  }
};

export const getPriceRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rules = await PriceRule.find().sort({ createdAt: -1 }).lean();
    const formatted = rules.map((r) => ({ ...r, id: String(r._id) }));
    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    next(err);
  }
};

export const createPriceRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = {
      name: 'Untitled Rule',
      type: 'base',
      scope: 'region',
      pricingMethod: 'fixed',
      status: 'pending',
      ...req.body,
    };
    const rule = await PriceRule.create(body);
    res.status(201).json({ success: true, data: toApiDoc(rule) });
  } catch (err) {
    next(err);
  }
};

export const getDiscountCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const campaigns = await DiscountCampaign.find().sort({ createdAt: -1 }).lean();
    const formatted = campaigns.map((c) => ({ ...c, id: String(c._id) }));
    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    next(err);
  }
};

export const createDiscountCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const campaign = await DiscountCampaign.create(req.body);
    res.status(201).json({ success: true, data: toApiDoc(campaign) });
  } catch (err) {
    next(err);
  }
};

export const updateDiscountCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const campaign = await DiscountCampaign.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!campaign) {
      res.status(404).json({ success: false, error: `Discount campaign not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: toApiDoc(campaign) });
  } catch (err) {
    next(err);
  }
};

export const deleteDiscountCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const campaign = await DiscountCampaign.findByIdAndDelete(req.params.id);
    if (!campaign) {
      res.status(404).json({ success: false, error: `Discount campaign not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

function formatCouponForApi(doc: mongoose.Document | Record<string, unknown>): Record<string, unknown> {
  const d = (doc as mongoose.Document).toObject ? (doc as mongoose.Document).toObject() : (doc as Record<string, unknown>);
  let discountType = String(d.discountType || 'percentage');
  if (discountType === 'percent') discountType = 'percentage';
  if (discountType === 'fixed') discountType = 'flat';
  return {
    ...d,
    id: String(d._id),
    discountType,
    minOrderValue: (d.minOrderValue as number) ?? (d.minOrderAmount as number) ?? 0,
    maxDiscount: (d.maxDiscount as number | null) ?? (d.maxDiscountAmount as number | null) ?? null,
    status: d.status || (d.isActive ? 'active' : 'paused'),
  };
}

export const getCoupons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const coupons = await PricingCoupon.find().sort({ createdAt: -1 }).lean();
    const formatted = coupons.map((c) => ({
      ...c,
      id: String(c._id),
      minOrderValue: c.minOrderValue ?? c.minOrderAmount ?? 0,
      maxDiscount: c.maxDiscount ?? c.maxDiscountAmount ?? null,
      status: c.status || (c.isActive ? 'active' : 'paused'),
    }));
    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    next(err);
  }
};

export const createCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = { ...req.body };
    body.code = String(body.code || '').trim().toUpperCase();
    if (!body.code) {
      res.status(400).json({ success: false, error: 'Coupon code is required' });
      return;
    }
    body.name = body.name || body.code;
    body.startDate = body.startDate ? new Date(body.startDate as string) : new Date();
    body.endDate = body.endDate
      ? new Date(body.endDate as string)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    body.validFrom = body.startDate;
    body.validTo = body.endDate;
    body.minOrderAmount = body.minOrderValue ?? body.minOrderAmount ?? 0;
    body.maxDiscountAmount = body.maxDiscount ?? body.maxDiscountAmount ?? null;
    body.isActive = body.status === 'active' || body.status === undefined;
    body.status = body.isActive ? 'active' : 'paused';
    if (body.discountType === 'percentage') body.discountType = 'percent';
    if (body.discountType === 'flat') body.discountType = 'fixed';
    const coupon = await PricingCoupon.create(body);
    res.status(201).json({ success: true, data: formatCouponForApi(coupon) });
  } catch (err: unknown) {
    if ((err as Record<string, unknown>).code === 11000) {
      res.status(400).json({ success: false, error: 'Coupon code already exists' });
      return;
    }
    next(err);
  }
};

export const updateCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = { ...req.body };
    if (body.code) body.code = String(body.code).trim().toUpperCase();
    if (body.startDate) body.validFrom = new Date(body.startDate as string);
    if (body.endDate) body.validTo = new Date(body.endDate as string);
    if (body.minOrderValue !== undefined) body.minOrderAmount = body.minOrderValue;
    if (body.maxDiscount !== undefined) body.maxDiscountAmount = body.maxDiscount;
    if (body.status === 'active') body.isActive = true;
    if (body.status === 'paused') body.isActive = false;
    if (body.discountType === 'percentage') body.discountType = 'percent';
    if (body.discountType === 'flat') body.discountType = 'fixed';
    const coupon = await PricingCoupon.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!coupon) {
      res.status(404).json({ success: false, error: `Coupon not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: formatCouponForApi(coupon) });
  } catch (err: unknown) {
    if ((err as Record<string, unknown>).code === 11000) {
      res.status(400).json({ success: false, error: 'Coupon code already exists' });
      return;
    }
    next(err);
  }
};

export const deleteCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const coupon = await PricingCoupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      res.status(404).json({ success: false, error: `Coupon not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

export const generateCouponCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let code = '';
    for (let i = 0; i < 10; i++) {
      code = generateCode();
      const existing = await PricingCoupon.findOne({ code }).lean();
      if (!existing) break;
    }
    if (!code) {
      res.status(500).json({ success: false, error: 'Could not generate unique code' });
      return;
    }
    res.status(200).json({ success: true, data: { code } });
  } catch (err) {
    next(err);
  }
};

function deriveFlashSaleStatus(doc: Record<string, unknown>): string {
  const now = new Date();
  if (new Date(doc.endDate as string) < now) return 'ended';
  if (new Date(doc.startDate as string) > now) return 'upcoming';
  return 'active';
}

export const getFlashSales = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sales = await FlashSale.find().sort({ startDate: -1 }).lean();
    const formatted = sales.map((s) => {
      const status = s.status || deriveFlashSaleStatus(s as Record<string, unknown>);
      return { ...s, id: String(s._id), status };
    });
    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    next(err);
  }
};

export const createFlashSale = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = { products: [], ...req.body };
    body.status = body.status || deriveFlashSaleStatus(body);
    const sale = await FlashSale.create(body);
    const formatted = { ...sale.toObject(), id: String(sale._id) };
    (formatted as Record<string, unknown>).status =
      (formatted as Record<string, unknown>).status || deriveFlashSaleStatus(formatted as Record<string, unknown>);
    res.status(201).json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
};

export const updateFlashSale = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sale = await FlashSale.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!sale) {
      res.status(404).json({ success: false, error: `Flash sale not found with id of ${req.params.id}` });
      return;
    }
    const formatted = { ...sale.toObject(), id: String(sale._id) };
    res.status(200).json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
};

export const deleteFlashSale = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sale = await FlashSale.findByIdAndDelete(req.params.id);
    if (!sale) {
      res.status(404).json({ success: false, error: `Flash sale not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

export const getBundles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bundles = await Bundle.find().sort({ createdAt: -1 }).lean();
    const formatted = bundles.map((b) => ({ ...b, id: String(b._id) }));
    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    next(err);
  }
};

export const createBundle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = { products: [], ...req.body };
    const totalOriginal =
      body.totalOriginalPrice ??
      (body.products as Array<{ price?: number; quantity?: number }>).reduce(
        (s: number, p: { price?: number; quantity?: number }) => s + (p.price || 0) * (p.quantity || 1),
        0,
      );
    const bundlePrice = body.bundlePrice ?? totalOriginal * 0.8;
    body.totalOriginalPrice = totalOriginal;
    body.bundlePrice = bundlePrice;
    body.savings = totalOriginal - bundlePrice;
    body.savingsPercent =
      totalOriginal > 0 ? Math.round(((totalOriginal - bundlePrice) / totalOriginal) * 10000) / 100 : 0;
    const bundle = await Bundle.create(body);
    res.status(201).json({ success: true, data: toApiDoc(bundle) });
  } catch (err) {
    next(err);
  }
};

export const updateBundle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bundle = await Bundle.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!bundle) {
      res.status(404).json({ success: false, error: `Bundle not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: toApiDoc(bundle) });
  } catch (err) {
    next(err);
  }
};

export const deleteBundle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bundle = await Bundle.findByIdAndDelete(req.params.id);
    if (!bundle) {
      res.status(404).json({ success: false, error: `Bundle not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

function formatSkuForApi(s: Record<string, unknown>): Record<string, unknown> {
  return {
    ...s,
    id: String(s._id),
    sku: s.code,
    code: s.code,
    base: (s.basePrice as number) ?? (s.sellingPrice as number) ?? 0,
    sell: (s.sellingPrice as number) ?? (s.basePrice as number) ?? 0,
    currentPrice: (s.sellingPrice as number) ?? 0,
    basePrice: (s.basePrice as number) ?? 0,
    competitor: (s.competitorAvg as number) ?? 0,
    competitorPrice: (s.competitorAvg as number) ?? 0,
    margin: (s.margin as number) ?? 0,
    marginStatus: s.marginStatus || 'healthy',
    history: s.history || [],
  };
}

export const getSKUsForPricing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const skus = await SKU.find().lean();
    const formatted = skus.map((s) => formatSkuForApi(s as Record<string, unknown>));
    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    next(err);
  }
};

export const updateSKUPrice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let sku = await SKU.findById(req.params.id);
    if (!sku) {
      res.status(404).json({ success: false, error: `SKU not found with id of ${req.params.id}` });
      return;
    }
    const body = { ...req.body };
    if (body.base !== undefined) body.basePrice = body.base;
    if (body.sell !== undefined) body.sellingPrice = body.sell;
    if (body.competitor !== undefined) body.competitorAvg = body.competitor;
    const cost = sku.cost ?? 0;
    const sell = body.sellingPrice ?? sku.sellingPrice;
    if (sell > 0 && cost > 0) body.margin = parseFloat((((sell - cost) / sell) * 100).toFixed(1));
    if (body.margin !== undefined) {
      body.marginStatus = body.margin < 10 ? 'critical' : body.margin < 15 ? 'warning' : 'healthy';
    }
    const prevSell = sku.sellingPrice;
    if (body.sellingPrice !== undefined && body.sellingPrice !== prevSell) {
      const monthLabel = new Date().toLocaleString('en-US', { month: 'short' });
      body.history = [...(sku.history || []), {
        date: monthLabel,
        price: body.sellingPrice,
        competitor: body.competitorAvg ?? sku.competitorAvg ?? 0,
      }].slice(-12);
    }
    sku = await SKU.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: formatSkuForApi(sku!.toObject() as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
};

export const bulkUpdateSKUPrices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updates = Array.isArray(req.body.updates) ? req.body.updates : [];
    if (updates.length === 0) {
      res.status(400).json({ success: false, error: 'updates array is required' });
      return;
    }
    const results: Record<string, unknown>[] = [];
    for (const item of updates as Record<string, unknown>[]) {
      const id = item.id || item._id;
      if (!id) continue;
      const sku = await SKU.findById(id);
      if (!sku) continue;
      const body: Record<string, unknown> = {};
      if (item.base !== undefined) body.basePrice = item.base;
      if (item.basePrice !== undefined) body.basePrice = item.basePrice;
      if (item.sell !== undefined) body.sellingPrice = item.sell;
      if (item.sellingPrice !== undefined) body.sellingPrice = item.sellingPrice;
      if (item.competitor !== undefined) body.competitorAvg = item.competitor;
      const cost = sku.cost ?? 0;
      const sell = (body.sellingPrice as number) ?? sku.sellingPrice;
      if (sell > 0 && cost > 0) body.margin = parseFloat((((sell - cost) / sell) * 100).toFixed(1));
      if (body.margin !== undefined) {
        body.marginStatus =
          (body.margin as number) < 10 ? 'critical' : (body.margin as number) < 15 ? 'warning' : 'healthy';
      }
      if (body.sellingPrice !== undefined && body.sellingPrice !== sku.sellingPrice) {
        const monthLabel = new Date().toLocaleString('en-US', { month: 'short' });
        body.history = [...(sku.history || []), {
          date: monthLabel,
          price: body.sellingPrice,
          competitor: sku.competitorAvg ?? 0,
        }].slice(-12);
        body.marginReviewed = false;
      }
      const updated = await SKU.findByIdAndUpdate(id as string, body, { new: true, runValidators: true });
      if (updated) results.push(formatSkuForApi(updated.toObject() as Record<string, unknown>));
    }
    res.status(200).json({ success: true, count: results.length, data: results });
  } catch (err) {
    next(err);
  }
};

// ─── Alert Controllers ────────────────────────────────────────────────────────

export const getAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, type, severity } = req.query;
    const query: Record<string, unknown> = {};
    if (type && type !== 'all') query.type = type;
    if (severity && severity !== 'all') query.severity = severity;
    if (status) {
      if (status === 'active') {
        query.status = { $nin: ['Resolved', 'Dismissed'] };
      } else if (status === 'resolved') {
        query.status = { $in: ['Resolved', 'Dismissed'] };
      } else if (status !== 'all') {
        query.status = status;
      }
    }
    const alerts = await MerchAlert.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: alerts.length, data: alerts });
  } catch (err) {
    next(err);
  }
};

export const updateAlert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const alert = await MerchAlert.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!alert) {
      res.status(404).json({ success: false, error: `Alert not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
};

export const bulkUpdateAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { ids, update } = req.body as { ids?: unknown; update?: Record<string, unknown> };
    if (!Array.isArray(ids) || ids.length === 0) {
      throw AppError.badRequest('ids (non-empty array) is required');
    }
    if (!update || typeof update !== 'object' || Object.keys(update).length === 0) {
      throw AppError.badRequest('update (non-empty object) is required');
    }
    await MerchAlert.updateMany({ _id: { $in: ids } }, { $set: update });
    res.status(200).json({ success: true, message: `${ids.length} alerts updated successfully` });
  } catch (err) {
    next(err);
  }
};

export const clearResolvedAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await MerchAlert.deleteMany({ status: { $in: ['Resolved', 'Dismissed'] } });
    res.status(200).json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    next(err);
  }
};

// ─── Analytics Controllers ────────────────────────────────────────────────────

export const getAnalyticsSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { type, range } = req.query;
    const query: Record<string, unknown> = {};
    if (type) query.type = type;
    const days = String(range || '30days').replace('days', '');
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - (parseInt(days, 10) || 30));
    query.createdAt = { $gte: daysAgo };
    const records = await AnalyticsRecord.find(query).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, count: records.length, data: records });
  } catch (err) {
    next(err);
  }
};

export const getCampaignAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const record = await AnalyticsRecord.findOne({ entityId: req.params.entityId }).lean();
    res.status(200).json({ success: true, data: record || null });
  } catch (err) {
    next(err);
  }
};

export const createAnalyticsRecord = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const record = await AnalyticsRecord.create(req.body);
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
};

// ─── Compliance Controllers ───────────────────────────────────────────────────

export const getComplianceSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pendingCount = await MerchComplianceCheck.countDocuments({ status: 'Pending' });
    const approvedCount = await MerchComplianceCheck.countDocuments({ status: 'Approved' });
    const total = await MerchComplianceCheck.countDocuments();
    const complianceScore = total > 0 ? Math.round((approvedCount / total) * 100) : 100;
    res.status(200).json({
      success: true,
      data: { pendingCount, auditsPassed: approvedCount, complianceScore },
    });
  } catch (err) {
    next(err);
  }
};

export const getApprovals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, type, riskLevel } = req.query;
    const query: Record<string, unknown> = {};
    if (status && status !== 'All') query.status = status;
    if (type && type !== 'all') query.type = type;
    if (riskLevel && riskLevel !== 'all') query.riskLevel = riskLevel;
    const approvals = await MerchComplianceCheck.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: approvals.length, data: approvals });
  } catch (err) {
    next(err);
  }
};

export const updateApprovalStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, user, note, reason } = req.body;
    const approval = await MerchComplianceCheck.findById(req.params.id);
    if (!approval) {
      res.status(404).json({ success: false, error: 'Approval request not found' });
      return;
    }
    approval.status = status;
    const commentText = note || reason;
    if (commentText) {
      approval.comments = approval.comments || [];
      approval.comments.push({ user: user || 'system', text: commentText, timestamp: new Date() });
    }
    await approval.save();
    res.status(200).json({ success: true, data: approval });
  } catch (err) {
    next(err);
  }
};

export const bulkUpdateApprovals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { ids, status, user, reason } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: 'ids array is required' });
      return;
    }
    if (!['Approved', 'Rejected'].includes(status)) {
      res.status(400).json({ success: false, error: 'status must be Approved or Rejected' });
      return;
    }
    const approvals = await MerchComplianceCheck.find({ _id: { $in: ids } });
    for (const approval of approvals) {
      approval.status = status;
      if (reason) {
        approval.comments = approval.comments || [];
        approval.comments.push({ user: user || 'system', text: reason, timestamp: new Date() });
      }
      await approval.save();
    }
    res.status(200).json({ success: true, count: approvals.length, data: approvals });
  } catch (err) {
    next(err);
  }
};

export const getAudits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, status } = req.query;
    const query: Record<string, unknown> = {};
    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { type: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    const audits = await MerchComplianceCheck.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: audits.length, data: audits });
  } catch (err) {
    next(err);
  }
};

// ─── Allocation Controllers ───────────────────────────────────────────────────

export const getAllocations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const allocations = await Allocation.find().populate('skuId').lean();
    res.status(200).json({ success: true, count: allocations.length, data: allocations });
  } catch (err) {
    next(err);
  }
};

export const getAllocationAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const alerts = await AllocationAlert.find({ status: 'active' }).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, count: alerts.length, data: alerts });
  } catch (err) {
    next(err);
  }
};

export const createAllocationAlert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const alert = await AllocationAlert.create(req.body);
    res.status(201).json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
};

export const updateAllocationAlertStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = req.body?.status ?? 'dismissed';
    const alert = await AllocationAlert.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!alert) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }
    res.status(200).json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
};

export const getAllocationLocations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const locations = await Allocation.distinct('locationName');
    res.status(200).json({ success: true, data: locations });
  } catch (err) {
    next(err);
  }
};

export const getAllocationHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const allocation = await Allocation.findOne({ skuId: req.params.skuId }).lean();
    const history = (allocation as Record<string, unknown> | null)?.history || [];
    res.status(200).json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
};

// ─── Geofence Controllers ─────────────────────────────────────────────────────

function polygonAreaSqKm(polygon: Array<{ lat: number; lng: number }> = []): number {
  if (!Array.isArray(polygon) || polygon.length < 3) return 0;
  const meanLatRad =
    (polygon.reduce((sum, p) => sum + Number(p.lat || 0), 0) / polygon.length) * (Math.PI / 180);
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos(meanLatRad);
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const curr = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const x1 = Number(curr.lng || 0) * kmPerDegLng;
    const y1 = Number(curr.lat || 0) * kmPerDegLat;
    const x2 = Number(next.lng || 0) * kmPerDegLng;
    const y2 = Number(next.lat || 0) * kmPerDegLat;
    area += x1 * y2 - x2 * y1;
  }
  return Number((Math.abs(area) / 2).toFixed(2));
}

function zoneToGeofenceZone(z: Record<string, unknown>): Record<string, unknown> {
  const polygon = Array.isArray(z.polygon) && (z.polygon as unknown[]).length >= 3
    ? z.polygon
    : [];
  const center = z.center || (Array.isArray(polygon) && (polygon as unknown[]).length > 0
    ? {
        lat: (polygon as Array<{ lat: number }>).reduce((s, p) => s + p.lat, 0) / (polygon as unknown[]).length,
        lng: (polygon as Array<{ lng: number }>).reduce((s, p) => s + p.lng, 0) / (polygon as unknown[]).length,
      }
    : { lat: 19.076, lng: 72.8777 });
  return {
    id: String(z._id),
    name: z.name,
    city: z.city || 'Unknown',
    region: z.region || 'Central',
    type: z.type || 'standard',
    status: z.status || 'active',
    isVisible: z.isVisible !== false,
    color: z.color || '#3b82f6',
    areaSqKm: z.areaSqKm,
    polygon,
    center,
    settings: z.settings || {},
    analytics: z.analytics || {},
    createdAt: z.createdAt,
    updatedAt: z.updatedAt,
    createdBy: z.createdBy || 'system',
  };
}

export const getZones = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const zones = await Zone.find().sort({ createdAt: -1 }).populate('cityId', 'name').lean();
    const data = zones.map((z) => zoneToGeofenceZone(z as Record<string, unknown>));
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

export const getZoneById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const zone = await Zone.findById(req.params.id).populate('cityId', 'name').lean();
    if (!zone) {
      res.status(404).json({ success: false, error: `Zone not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: zoneToGeofenceZone(zone as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
};

export const createZone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.body.cityId) {
      res.status(400).json({ success: false, error: 'cityId is required' });
      return;
    }
    const zone = await Zone.create(req.body);
    const doc = await Zone.findById(zone._id).populate('cityId', 'name').lean();
    res.status(201).json({ success: true, data: zoneToGeofenceZone(doc as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
};

export const updateZone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const zone = await Zone.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('cityId', 'name').lean();
    if (!zone) {
      res.status(404).json({ success: false, error: `Zone not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: zoneToGeofenceZone(zone as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
};

export const deleteZone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const zone = await Zone.findByIdAndDelete(req.params.id);
    if (!zone) {
      res.status(404).json({ success: false, error: `Zone not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

export const toggleZoneStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status } = req.body;
    if (!status || !['active', 'inactive'].includes(status)) {
      res.status(400).json({ success: false, error: 'Status must be active or inactive' });
      return;
    }
    const zone = await Zone.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate('cityId', 'name').lean();
    if (!zone) {
      res.status(404).json({ success: false, error: `Zone not found with id of ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: zoneToGeofenceZone(zone as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
};

export const getGeofenceHistory = async (req: Request, res: Response): Promise<void> => {
  const { completeOpsAction } = await import('../../utils/ops-store');
  await completeOpsAction(req, res, 'Geofence history');
};

export const getOverlaps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const zones = await Zone.find().lean();
    const warnings: unknown[] = [];
    for (let i = 0; i < zones.length; i++) {
      for (let j = i + 1; j < zones.length; j++) {
        const a = zones[i];
        const b = zones[j];
        if (!a.polygon || !b.polygon || a.polygon.length < 3 || b.polygon.length < 3) continue;
        const areaA = polygonAreaSqKm(a.polygon as Array<{ lat: number; lng: number }>);
        const areaB = polygonAreaSqKm(b.polygon as Array<{ lat: number; lng: number }>);
        if (areaA > 0 && areaB > 0) {
          warnings.push({
            id: `${a._id}-${b._id}`,
            zoneA: a.name,
            zoneB: b.name,
            zoneAId: String(a._id),
            zoneBId: String(b._id),
            severity: 'warning',
            message: `${a.name} may overlap with ${b.name}`,
          });
        }
      }
    }
    res.status(200).json({ success: true, data: warnings });
  } catch (err) {
    next(err);
  }
};

export const getPromoHeatmap = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(String(req.query.days || '30'), 10) || 30));
    const zones = await Zone.find().lean();
    const rows = zones.map((z) => ({
      zoneId: String(z._id),
      zoneName: z.name,
      color: z.color || '#3b82f6',
      revenue: (z.analytics as Record<string, unknown> | undefined)?.revenue || 0,
      orders: (z.analytics as Record<string, unknown> | undefined)?.totalOrders || 0,
      redemptions: 0,
      promoCount: z.promoCount || 0,
      areaSqKm: polygonAreaSqKm(z.polygon as Array<{ lat: number; lng: number }>) || z.areaSqKm || 0,
    }));
    res.status(200).json({ success: true, data: { days, rows, totals: { revenue: 0, orders: 0, redemptions: 0 } } });
  } catch (err) {
    next(err);
  }
};

export const getGeofenceStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const zones = await Zone.find().lean();
    const activeZones = zones.filter((z) => z.status === 'active' || z.status === 'Active').length;
    const totalArea = Math.round(
      zones.reduce((sum, z) => sum + (Number(z.areaSqKm) || polygonAreaSqKm(z.polygon as Array<{ lat: number; lng: number }>) || 0), 0) * 100,
    ) / 100;
    res.status(200).json({
      success: true,
      data: {
        totalZones: zones.length,
        activeZones,
        inactiveZones: zones.length - activeZones,
        totalArea,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getGeofenceStores = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({ success: true, count: 0, data: [] });
  } catch (err) {
    next(err);
  }
};

export const updateGeofenceStore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};

// ─── Citywide Controllers ─────────────────────────────────────────────────────

const getCityId = (req: Request): string =>
  String(req.query.cityId || (req.body as Record<string, unknown>)?.cityId || 'default');

export const getLiveMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cityId = getCityId(req);
    const [incidents, exceptions, surge] = await Promise.all([
      OpsIncident.countDocuments({ cityId, status: 'ongoing' }),
      OpsException.countDocuments({ cityId, status: 'open' }),
      OpsSurgeConfig.findOne({ cityId }).lean(),
    ]);
    res.status(200).json({
      success: true,
      data: {
        cityId,
        activeIncidents: incidents,
        openExceptions: exceptions,
        surgeActive: (surge as Record<string, unknown> | null)?.active || false,
        surgeMultiplier: (surge as Record<string, unknown> | null)?.globalMultiplier || 1.0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getCitywideZones = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const zones = await Zone.find().lean();
    res.status(200).json({ success: true, data: zones.map((z) => zoneToGeofenceZone(z as Record<string, unknown>)) });
  } catch (err) {
    next(err);
  }
};

export const getZoneDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const zone = await Zone.findById(req.params.id).lean();
    if (!zone) {
      res.status(404).json({ success: false, error: `Zone not found: ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: zoneToGeofenceZone(zone as Record<string, unknown>) });
  } catch (err) {
    next(err);
  }
};

export const getZoneOrderTrend = async (req: Request, res: Response): Promise<void> => {
  const { completeOpsAction } = await import('../../utils/ops-store');
  await completeOpsAction(req, res, 'Zone order trend');
};

export const requestZoneRiders = async (req: Request, res: Response): Promise<void> => {
  const { completeOpsAction } = await import('../../utils/ops-store');
  await completeOpsAction(req, res, 'Zone rider request');
};

export const getIncidents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cityId = getCityId(req);
    const status = String(req.query.status || 'ongoing');
    const incidents = await OpsIncident.find({ cityId, status }).sort({ startTime: -1 }).lean();
    res.status(200).json({ success: true, count: incidents.length, data: incidents });
  } catch (err) {
    next(err);
  }
};

export const getIncidentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const incident = await OpsIncident.findById(req.params.id).lean();
    if (!incident) {
      res.status(404).json({ success: false, error: `Incident not found: ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: incident });
  } catch (err) {
    next(err);
  }
};

export const updateIncident = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const incident = await OpsIncident.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!incident) {
      res.status(404).json({ success: false, error: `Incident not found: ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: incident });
  } catch (err) {
    next(err);
  }
};

export const getExceptions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cityId = getCityId(req);
    const limit = parseInt(String(req.query.limit || '20'), 10) || 20;
    const exceptions = await OpsException.find({ cityId, status: 'open' }).sort({ createdAt: -1 }).limit(limit).lean();
    res.status(200).json({ success: true, data: exceptions });
  } catch (err) {
    next(err);
  }
};

export const resolveException = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as Request & { user?: Record<string, unknown> }).user?.id || (req as Request & { user?: Record<string, unknown> }).user?.email || 'unknown';
    const exception = await OpsException.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved', resolvedAt: new Date(), resolvedBy: String(userId), resolution: req.body?.resolution || '' },
      { new: true },
    );
    if (!exception) {
      res.status(404).json({ success: false, error: `Exception not found: ${req.params.id}` });
      return;
    }
    res.status(200).json({ success: true, data: exception });
  } catch (err) {
    next(err);
  }
};

export const getIntegrationHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cityId = getCityId(req);
    const health = await OpsIntegrationHealth.find({ cityId }).lean();
    res.status(200).json({ success: true, data: health });
  } catch (err) {
    next(err);
  }
};

export const getSurge = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cityId = getCityId(req);
    let surge = await OpsSurgeConfig.findOne({ cityId }).lean();
    if (!surge) {
      surge = (await OpsSurgeConfig.create({ cityId })).toObject();
    }
    res.status(200).json({ success: true, data: surge });
  } catch (err) {
    next(err);
  }
};

export const updateSurge = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cityId = getCityId(req);
    const userId = (req as Request & { user?: Record<string, unknown> }).user?.id || (req as Request & { user?: Record<string, unknown> }).user?.email || 'unknown';
    const surge = await OpsSurgeConfig.findOneAndUpdate(
      { cityId },
      { ...req.body, updatedBy: String(userId) },
      { new: true, upsert: true },
    );
    res.status(200).json({ success: true, data: surge });
  } catch (err) {
    next(err);
  }
};

export const endSurge = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cityId = getCityId(req);
    const surge = await OpsSurgeConfig.findOneAndUpdate(
      { cityId },
      { active: false, globalMultiplier: 1.0, startTime: null, estimatedEnd: null, reason: null },
      { new: true, upsert: true },
    );
    res.status(200).json({ success: true, data: surge });
  } catch (err) {
    next(err);
  }
};

export const executeSurgeAction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { action } = req.body || {};
    const validActions = ['increase_pricing', 'notify_customers', 'notify_riders'];
    if (!action || !validActions.includes(action)) {
      res.status(400).json({ success: false, error: `action must be one of: ${validActions.join(', ')}` });
      return;
    }
    res.status(200).json({ success: true, data: { action, message: `Action ${action} executed` } });
  } catch (err) {
    next(err);
  }
};

export const getDispatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cityId = getCityId(req);
    let config = await OpsDispatchConfig.findOne({ cityId }).lean();
    if (!config) {
      config = (await OpsDispatchConfig.create({ cityId })).toObject();
    }
    res.status(200).json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
};

export const updateDispatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cityId = getCityId(req);
    const userId = (req as Request & { user?: Record<string, unknown> }).user?.id || (req as Request & { user?: Record<string, unknown> }).user?.email || 'unknown';
    const config = await OpsDispatchConfig.findOneAndUpdate(
      { cityId },
      { ...req.body, updatedBy: String(userId) },
      { new: true, upsert: true },
    );
    res.status(200).json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
};

export const restartDispatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cityId = getCityId(req);
    const userId = (req as Request & { user?: Record<string, unknown> }).user?.id || (req as Request & { user?: Record<string, unknown> }).user?.email || 'unknown';
    const config = await OpsDispatchConfig.findOneAndUpdate(
      { cityId },
      {
        status: 'running',
        lastRestart: new Date(),
        updatedBy: String(userId),
        $push: {
          activityLog: { action: 'restart', message: 'Dispatch engine restarted', status: 'running', userId: String(userId), timestamp: new Date() },
        },
      },
      { new: true, upsert: true },
    );
    res.status(200).json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
};

export const manualOverrideDispatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cityId = getCityId(req);
    const userId = (req as Request & { user?: Record<string, unknown> }).user?.id || (req as Request & { user?: Record<string, unknown> }).user?.email || 'unknown';
    const { status, reason } = req.body || {};
    if (!status || !['running', 'paused'].includes(status)) {
      res.status(400).json({ success: false, error: 'status must be "running" or "paused"' });
      return;
    }
    const config = await OpsDispatchConfig.findOneAndUpdate(
      { cityId },
      {
        status,
        updatedBy: String(userId),
        $push: {
          activityLog: { action: 'manual_override', message: reason || `Status set to ${status}`, status, userId: String(userId), timestamp: new Date() },
        },
      },
      { new: true, upsert: true },
    );
    res.status(200).json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
};

export const getDispatchLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cityId = getCityId(req);
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 100);
    const config = await OpsDispatchConfig.findOne({ cityId }).lean();
    const logs = ((config as Record<string, unknown> | null)?.activityLog as unknown[] || []).slice(-limit).reverse();
    res.status(200).json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
};

export const getSla = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cityId = getCityId(req);
    let sla = await OpsSlaConfig.findOne({ cityId }).lean();
    if (!sla) {
      sla = (await OpsSlaConfig.create({ cityId })).toObject();
    }
    res.status(200).json({ success: true, data: sla });
  } catch (err) {
    next(err);
  }
};
