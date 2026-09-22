/** Canonical notification categories for Selorg customer notifications. */
export const CATEGORIES = {
  ORDER: 'order',
  OFFERS: 'offers',
  PROMOTIONAL: 'promotional',
  WALLET: 'wallet',
  SYSTEM: 'system',
  WELCOME: 'welcome',
} as const;

export type NotificationCategory = (typeof CATEGORIES)[keyof typeof CATEGORIES];

export const CATEGORY_LIST: NotificationCategory[] = Object.values(CATEGORIES);

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  [CATEGORIES.ORDER]: 'Order Updates',
  [CATEGORIES.OFFERS]: 'Offers & Discounts',
  [CATEGORIES.PROMOTIONAL]: 'Promotional Notifications',
  [CATEGORIES.WALLET]: 'Wallet Notifications',
  [CATEGORIES.SYSTEM]: 'System Notifications',
  [CATEGORIES.WELCOME]: 'Welcome Notifications',
};

/** Channels that can be toggled per category (and globally). */
export const CHANNELS = ['push', 'inApp', 'sms', 'whatsapp', 'email'] as const;
export type NotificationChannel = (typeof CHANNELS)[number];

export const DEFAULT_CATEGORY_CHANNELS: Record<NotificationChannel, boolean> = {
  push: true,
  inApp: true,
  sms: true,
  whatsapp: true,
  email: true,
};

/** Map transactional notification type -> category. */
export const TYPE_TO_CATEGORY: Record<string, NotificationCategory> = {
  ORDER_PLACED: CATEGORIES.ORDER,
  ORDER_AWAITING_PAYMENT: CATEGORIES.ORDER,
  COD_ORDER_PLACED: CATEGORIES.ORDER,
  WALLET_ORDER_PLACED: CATEGORIES.ORDER,
  ORDER_CONFIRMED: CATEGORIES.ORDER,
  ORDER_PACKED: CATEGORIES.ORDER,
  ORDER_ON_WAY: CATEGORIES.ORDER,
  ORDER_ARRIVED: CATEGORIES.ORDER,
  ORDER_DELIVERED: CATEGORIES.ORDER,
  ORDER_CANCELLED: CATEGORIES.ORDER,
  ORDER_CANCELLED_BY_STORE: CATEGORIES.ORDER,
  DELIVERY_DELAYED: CATEGORIES.ORDER,
  DELIVERY_SLA_BREACH: CATEGORIES.ORDER,
  MISSING_ITEMS: CATEGORIES.ORDER,
  PAYMENT_FAILED: CATEGORIES.ORDER,
  PAYMENT_CANCELLED: CATEGORIES.ORDER,
  PAYMENT_TIMEOUT: CATEGORIES.ORDER,
  PAYMENT_PENDING: CATEGORIES.ORDER,
  PAYMENT_RETRY_AVAILABLE: CATEGORIES.ORDER,
  PAYMENT_SUCCESS: CATEGORIES.ORDER,
  WALLET_PAYMENT_FAILED: CATEGORIES.WALLET,
  REFUND_INITIATED: CATEGORIES.WALLET,
  REFUND_APPROVED: CATEGORIES.WALLET,
  REFUND_COMPLETED: CATEGORIES.WALLET,
  REFUND_REJECTED: CATEGORIES.WALLET,
  WALLET_CREDIT: CATEGORIES.WALLET,
  WALLET_DEBIT: CATEGORIES.WALLET,
  SUPPORT_REPLY: CATEGORIES.SYSTEM,
  SYSTEM_ANNOUNCEMENT: CATEGORIES.SYSTEM,
  WELCOME: CATEGORIES.WELCOME,
  CAMPAIGN: CATEGORIES.PROMOTIONAL,
  NEW_OFFER: CATEGORIES.OFFERS,
  OFFER_CAMPAIGN: CATEGORIES.OFFERS,
  PROMOTIONAL_CAMPAIGN: CATEGORIES.PROMOTIONAL,
};

/** Admin template category aliases -> canonical category. */
export const TEMPLATE_CATEGORY_MAP: Record<string, NotificationCategory> = {
  transactional: CATEGORIES.ORDER,
  order: CATEGORIES.ORDER,
  offers: CATEGORIES.OFFERS,
  promotional: CATEGORIES.PROMOTIONAL,
  wallet: CATEGORIES.WALLET,
  system: CATEGORIES.SYSTEM,
  welcome: CATEGORIES.WELCOME,
};

export function resolveCategory(typeOrCategory?: string, explicitCategory?: string): NotificationCategory {
  if (explicitCategory && (CATEGORY_LIST as string[]).includes(explicitCategory)) {
    return explicitCategory as NotificationCategory;
  }
  const raw = String(typeOrCategory || '').trim();
  if ((CATEGORY_LIST as string[]).includes(raw)) return raw as NotificationCategory;
  if (TEMPLATE_CATEGORY_MAP[raw]) return TEMPLATE_CATEGORY_MAP[raw];
  if (TYPE_TO_CATEGORY[raw]) return TYPE_TO_CATEGORY[raw];
  const upper = raw.toUpperCase();
  if (TYPE_TO_CATEGORY[upper]) return TYPE_TO_CATEGORY[upper];
  return CATEGORIES.SYSTEM;
}

export function defaultCategoriesPreferences(): Record<NotificationCategory, Record<NotificationChannel, boolean>> {
  const out = {} as Record<NotificationCategory, Record<NotificationChannel, boolean>>;
  for (const cat of CATEGORY_LIST) {
    out[cat] = { ...DEFAULT_CATEGORY_CHANNELS };
  }
  return out;
}
