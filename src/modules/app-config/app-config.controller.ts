import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import { AppConfig } from './app-config.model';
import { CancellationPolicy } from './cancellation-policy.model';
import { resolveFromCheckout } from '../../services/deliveryPricing.service';

// ─── Public app-config ────────────────────────────────────────────────────────

export async function getPublicConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let config: any = await AppConfig.findOne({ key: 'default' }).lean();
    if (!config) {
      config = await AppConfig.create({ key: 'default' }).then((d) => d.toObject()).catch(() => ({}));
    }
    if (config?.checkout) {
      const pricing = resolveFromCheckout(config.checkout);
      config = {
        ...config,
        checkout: { ...config.checkout, deliveryFee: pricing.deliveryFee, freeDeliveryMinAmount: pricing.freeDeliveryThreshold, handlingCharge: pricing.handlingCharge },
      };
    }
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
}

// ─── Admin app-config ─────────────────────────────────────────────────────────

export async function adminGetConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let config: any = await AppConfig.findOne({ key: 'default' }).lean();
    if (!config) {
      config = await AppConfig.create({ key: 'default' }).then((d) => d.toObject()).catch(() => null);
    }
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
}

export async function adminUpdateConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = { ...req.body };
    delete body._id;
    delete body.key;
    const updated = await AppConfig.findOneAndUpdate({ key: 'default' }, { $set: body }, { new: true, upsert: true }).lean();
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

export async function adminUpdateSection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { section } = req.params;
    const validSections = ['branding', 'otp', 'checkout', 'wallet', 'catalog', 'appVersion', 'maintenance', 'support', 'payment', 'images', 'supportCategories', 'paymentMethods', 'search', 'notifications', 'locationTags'];
    if (!validSections.includes(section)) {
      return next(new AppError(`Invalid section: ${section}`, 400, 'BAD_REQUEST'));
    }
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(req.body)) {
      update[`${section}.${key}`] = value;
    }
    const updated = await AppConfig.findOneAndUpdate({ key: 'default' }, { $set: update }, { new: true, upsert: true }).lean();
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

export async function adminResetConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await AppConfig.deleteOne({ key: 'default' });
    const fresh = await AppConfig.create({ key: 'default' }).then((d) => d.toObject());
    res.status(200).json({ success: true, data: fresh, message: 'Config reset to defaults' });
  } catch (error) {
    next(error);
  }
}

// ─── Cancellation Policies ────────────────────────────────────────────────────

export async function listPolicies(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = await CancellationPolicy.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function getPolicyById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await CancellationPolicy.findById(req.params.id).lean();
    if (!item) return next(new AppError('Policy not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function createPolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const created = await CancellationPolicy.create(req.body);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
}

export async function updatePolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = { ...req.body };
    delete body._id;
    const updated = await CancellationPolicy.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true }).lean();
    if (!updated) return next(new AppError('Policy not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

export async function deletePolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const deleted = await CancellationPolicy.findByIdAndDelete(req.params.id);
    if (!deleted) return next(new AppError('Policy not found', 404, 'NOT_FOUND'));
    res.status(200).json({ success: true, message: 'Policy deleted' });
  } catch (error) {
    next(error);
  }
}
