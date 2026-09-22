import mongoose, { Document, Schema } from 'mongoose';

/**
 * Full customer-app config schema, faithfully ported from legacy `AppConfig.js`.
 * Only `checkout.*` is consumed so far (by `deliveryPricing.service.ts`) — the rest of the
 * schema (branding/otp/wallet/featureFlags/etc.) is ported for completeness and future
 * admin/settings + customer bootstrap modules, but has no service/controller wired yet.
 */

const paymentMethodSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const supportCategorySchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

export interface IAppConfig extends Document {
  key: string;
  branding: Record<string, unknown>;
  otp: Record<string, unknown>;
  checkout: {
    handlingCharge: number;
    deliveryFee: number;
    freeDeliveryMinAmount: number;
    minOrderAmount: number;
    tipAmounts: number[];
    deliveryInstructions: string[];
    cancelReasons: string[];
    ratingTags: string[];
    emptyCartTitle: string;
    emptyCartDescription: string;
    emptyCartCta: string;
    paymentInfoText: string;
  };
  wallet: Record<string, unknown>;
  catalog: Record<string, unknown>;
  paymentMethods: unknown[];
  featureFlags: Record<string, unknown>;
  appVersion: Record<string, unknown>;
  maintenance: Record<string, unknown>;
  supportCategories: unknown[];
  support: Record<string, unknown>;
  payment: Record<string, unknown>;
  images: Record<string, unknown>;
  search: Record<string, unknown>;
  notifications: Record<string, unknown>;
  locationTags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const appConfigSchema = new Schema<IAppConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'default' },

    branding: {
      splashTitle: { type: String, default: 'Avoid poison on your plate' },
      splashSubtitle: { type: String, default: "India's first lab-tested organic grocery app" },
      splashLogoUrl: { type: String, default: '' },
      splashBgColor: { type: String, default: '#034703' },
      splashDurationMs: { type: Number, default: 1500 },
      loginBrandName: { type: String, default: 'Selorg Organic' },
      loginSubtitle: { type: String, default: 'Fresh organic groceries delivered' },
      loginSectionTitle: { type: String, default: 'Login or Sign Up' },
      loginSectionSubtitle: { type: String, default: 'Enter your mobile number to continue' },
      loginOtpNote: { type: String, default: "We'll send you an OTP to verify your number" },
      primaryColor: { type: String, default: '#034703' },
      countryCode: { type: String, default: '+91' },
      phoneMaxLength: { type: Number, default: 10 },
    },

    otp: {
      length: { type: Number, default: 4 },
      timerDurationSec: { type: Number, default: 50 },
      maxRetries: { type: Number, default: 3 },
      headerTitle: { type: String, default: 'Verify OTP' },
      heading: { type: String, default: 'Enter Verification Code' },
      description: { type: String, default: "We've sent a 4-digit code to" },
      buttonText: { type: String, default: 'Verify & Continue' },
      resendText: { type: String, default: 'Resend OTP' },
    },

    checkout: {
      handlingCharge: { type: Number, default: 5.0 },
      deliveryFee: { type: Number, default: 0 },
      freeDeliveryMinAmount: { type: Number, default: 0 },
      minOrderAmount: { type: Number, default: 0 },
      tipAmounts: [{ type: Number }],
      deliveryInstructions: [{ type: String }],
      cancelReasons: [{ type: String }],
      ratingTags: [{ type: String }],
      emptyCartTitle: { type: String, default: "Don't Risk Your Health" },
      emptyCartDescription: { type: String, default: 'Avoid poison on your plate. Choose clean, organic food for your family.' },
      emptyCartCta: { type: String, default: 'Browse healthy products' },
      paymentInfoText: { type: String, default: 'All payments are secure and encrypted' },
    },

    wallet: {
      topUpAmounts: [{ type: Number }],
      maxTopUpAmount: { type: Number, default: 10000 },
      imageUrl: { type: String, default: '' },
    },

    catalog: {
      defaultCollectionKey: { type: String, default: '' },
    },

    paymentMethods: [paymentMethodSchema],

    featureFlags: {
      showSkipButtonOnLogin: { type: Boolean, default: true },
      enableReferral: { type: Boolean, default: true },
      enableWallet: { type: Boolean, default: true },
      enableChat: { type: Boolean, default: true },
      enableRatings: { type: Boolean, default: true },
      enableCoupons: { type: Boolean, default: true },
      enableNotifications: { type: Boolean, default: true },
      maxCartItems: { type: Number, default: 50 },
    },

    appVersion: {
      currentVersion: { type: String, default: '1.0.0' },
      minVersion: { type: String, default: '1.0.0' },
      forceUpdate: { type: Boolean, default: false },
      updateMessage: { type: String, default: 'A new version is available. Please update to continue.' },
      updateUrl: { type: String, default: '' },
    },

    maintenance: {
      isActive: { type: Boolean, default: false },
      message: { type: String, default: 'We are upgrading our systems. Please check back shortly.' },
      estimatedEndTime: { type: Date, default: null },
    },

    supportCategories: [supportCategorySchema],

    support: {
      contactPhone: { type: String, default: '+919444183378' },
      contactEmail: { type: String, default: 'support@selorg.com' },
      supportPhone: { type: String, default: '+919444183378' },
      supportEmail: { type: String, default: 'support@selorg.com' },
      whatsappNumber: { type: String, default: '+919444183378' },
      workingHours: { type: String, default: 'Mon–Sat, 9:00 AM – 8:00 PM IST' },
      responseTime: { type: String, default: 'Typically within 2–4 hours on business days' },
      liveChatEnabled: { type: Boolean, default: true },
    },

    payment: {
      upiMerchantId: { type: String, default: 'merchant@upi' },
      upiMerchantName: { type: String, default: 'SelOrg' },
      upiApps: [
        {
          id: { type: String },
          name: { type: String },
          scheme: { type: String, default: '' },
          isActive: { type: Boolean, default: true },
          order: { type: Number, default: 0 },
        },
      ],
      showOtherUpiOption: { type: Boolean, default: true },
    },

    images: {
      placeholderUrl: { type: String, default: '' },
      outOfStockImageUrl: { type: String, default: '' },
      emptyCartImageUrl: { type: String, default: '' },
      emptyOrdersImageUrl: { type: String, default: '' },
      emptyNotificationsImageUrl: { type: String, default: '' },
      emptySearchImageUrl: { type: String, default: '' },
      emptyWishlistImageUrl: { type: String, default: '' },
      errorImageUrl: { type: String, default: '' },
      noProductsImageUrl: { type: String, default: '' },
    },

    search: {
      placeholder: { type: String, default: 'Search products...' },
      popularSearches: [{ type: String }],
      emptyStateTitle: { type: String, default: 'Start typing to search for products' },
      emptyStateSubtitle: { type: String, default: 'Search by name, category, or keywords' },
    },

    notifications: {
      channelsAvailable: [
        {
          key: { type: String },
          label: { type: String },
          description: { type: String, default: '' },
          isActive: { type: Boolean, default: true },
        },
      ],
      dndStartHour: { type: Number, default: 22 },
      dndEndHour: { type: Number, default: 7 },
    },

    locationTags: [{ type: String }],
  },
  { timestamps: true },
);

appConfigSchema.index({ key: 1 }, { unique: true });

export const AppConfig =
  (mongoose.models.CustomerAppConfig as mongoose.Model<IAppConfig>) ||
  mongoose.model<IAppConfig>('CustomerAppConfig', appConfigSchema, 'systemconfigs');
