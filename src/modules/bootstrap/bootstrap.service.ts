import { AppConfig } from '../app-config/app-config.model';
import { CustomerFeatureFlag, CustomerFlowConfig, CustomerPromotionRule } from './bootstrap.models';
import { HomeConfig } from '../home/home.models';
import { getHomePayload } from '../home/home.service';
import { resolveFromCheckout } from '../../services/deliveryPricing.service';

function isPromotionActive(rule: any, now: Date): boolean {
  if (!rule || !rule.isActive) return false;
  if (rule.schedule) {
    if (rule.schedule.startDate && rule.schedule.startDate > now) return false;
    if (rule.schedule.endDate && rule.schedule.endDate < now) return false;
  }
  if (rule.usageLimit != null && rule.usageCount >= rule.usageLimit) return false;
  return true;
}

export async function getBootstrapPayload(userId?: string) {
  const now = new Date();

  const [featureFlagsList, flowConfigList, promoRules, homeConfigDoc, appConfigDoc, legacy] =
    await Promise.all([
      CustomerFeatureFlag.find({ isActive: true }).lean(),
      CustomerFlowConfig.find().lean(),
      CustomerPromotionRule.find({ isActive: true }).lean(),
      HomeConfig.findOne({ key: 'main' }).lean(),
      AppConfig.findOne({ key: 'default' }).lean(),
      getHomePayload(userId),
    ]);

  const featureFlags: Record<string, unknown> = {};
  for (const f of featureFlagsList) {
    featureFlags[f.key] = f.value;
  }

  const flowConfig: Record<string, unknown> = {};
  for (const f of flowConfigList) {
    flowConfig[f.key] = f.value;
  }

  const activePromotions = promoRules
    .filter((r) => isPromotionActive(r, now))
    .map((r: any) => ({
      id: String(r._id),
      name: r.name,
      type: r.type,
      targetType: r.targetType,
      targetId: r.targetId ? String(r.targetId) : null,
      discountValue: r.discountValue,
      minCartValue: r.minCartValue,
      maxDiscountCap: r.maxDiscountCap,
      autoApply: r.autoApply,
      couponCode: r.couponCode,
    }));

  const homeConfig = homeConfigDoc
    ? {
        searchPlaceholder: (homeConfigDoc as any).searchPlaceholder,
        heroVideoUrl: (homeConfigDoc as any).heroVideoUrl,
        categorySectionTitle: (homeConfigDoc as any).categorySectionTitle,
        organicTagline: (homeConfigDoc as any).organicTagline,
        organicIconUrl: (homeConfigDoc as any).organicIconUrl,
        deliveryTypeLabel: (homeConfigDoc as any).deliveryTypeLabel,
      }
    : null;

  let resolvedAppConfig: any = appConfigDoc;
  if (!resolvedAppConfig) {
    resolvedAppConfig = await AppConfig.create({ key: 'default' })
      .then((d) => d.toObject())
      .catch(() => null);
  }

  // Inject effective delivery pricing into appConfig.checkout so client uses correct numbers
  if (resolvedAppConfig?.checkout) {
    const pricing = resolveFromCheckout(resolvedAppConfig.checkout);
    resolvedAppConfig = {
      ...resolvedAppConfig,
      checkout: {
        ...resolvedAppConfig.checkout,
        deliveryFee: pricing.deliveryFee,
        freeDeliveryMinAmount: pricing.freeDeliveryThreshold,
        handlingCharge: pricing.handlingCharge,
      },
    };
  }

  return {
    pages: { home: legacy },
    legacy,
    homeConfig,
    appConfig: resolvedAppConfig,
    featureFlags,
    flowConfig,
    activePromotions,
    defaultAddress: null,
  };
}
