import mongoose, { Document, Schema } from 'mongoose';

/**
 * Schema-only port (faithful field-for-field). Full Worldline/Paynimo gateway integration
 * (session init, webhook verification, reconciliation — `worldlinePaymentsService.js`) is a
 * separate future `payments` module. Ported now because `orderService.js` writes a row here
 * when creating an order and the orders module needs the model to exist.
 */
export interface IWorldlinePayment extends Document {
  userId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  idempotencyKey: string;
  merchantId: string;
  schemeCode: string;
  platform: 'android' | 'ios' | 'web';
  deviceId: 'AndroidSH1' | 'AndroidSH2' | 'iOSSH1' | 'iOSSH2' | 'WEBSH1' | 'WEBSH2';
  txnId: string;
  attemptNo: number;
  amountInr: number;
  currency: string;
  standaloneCheckout: boolean;
  externalOrderRef: string;
  purpose: 'order' | 'wallet_topup';
  walletCredited: boolean;
  walletCreditedAt: Date | null;
  status: 'created' | 'initiated' | 'success' | 'failed' | 'cancelled' | 'pending' | 'unknown';
  statusCode: string;
  statusMessage: string;
  verificationSource: 'app_complete' | 'gateway_return' | 'reconciliation' | 'client_abort' | 'none';
  verificationError: 'hash_mismatch' | 'amount_mismatch' | 'none';
  sessionExpiresAt?: Date;
  timeoutNotified: boolean;
  tpslTxnId: string;
  bankTxnId: string;
  tpslBankCd: string;
  tpslTxnTime: string;
  token: string;
  responseHash: string;
  rawSessionRequest: unknown;
  rawGatewayResponse: unknown;
  rawGatewayReturn: unknown;
  checkoutOrigin: string;
  createdAt: Date;
  updatedAt: Date;
}

const worldlinePaymentSchema = new Schema<IWorldlinePayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'CustomerUser', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'CustomerOrder', required: true },

    idempotencyKey: { type: String, required: true },

    merchantId: { type: String, required: true },
    schemeCode: { type: String, required: true }, // itemId in Paynimo request (e.g. FIRST)

    platform: { type: String, enum: ['android', 'ios', 'web'], required: true },
    deviceId: { type: String, enum: ['AndroidSH1', 'AndroidSH2', 'iOSSH1', 'iOSSH2', 'WEBSH1', 'WEBSH2'], required: true },

    txnId: { type: String, required: true }, // merchant txn id
    attemptNo: { type: Number, default: 1 },
    amountInr: { type: Number, required: true },
    currency: { type: String, default: 'INR' },

    /** Checkout without a row in `customer_orders` (e.g. /api/payment/initiate with string orderId). */
    standaloneCheckout: { type: Boolean, default: false },
    /** Client reference when standaloneCheckout (e.g. TEST_001). */
    externalOrderRef: { type: String, default: '' },

    /**
     * `order` — grocery CustomerOrder checkout.
     * `wallet_topup` — Paynimo payment that credits Selorg Wallet after verification.
     */
    purpose: { type: String, enum: ['order', 'wallet_topup'], default: 'order', index: true },
    walletCredited: { type: Boolean, default: false },
    walletCreditedAt: { type: Date, default: null },

    status: { type: String, enum: ['created', 'initiated', 'success', 'failed', 'cancelled', 'pending', 'unknown'], default: 'created', index: true },
    statusCode: { type: String, default: '' },
    statusMessage: { type: String, default: '' },

    verificationSource: { type: String, enum: ['app_complete', 'gateway_return', 'reconciliation', 'client_abort', 'none'], default: 'none' },
    verificationError: { type: String, enum: ['hash_mismatch', 'amount_mismatch', 'none'], default: 'none' },

    sessionExpiresAt: { type: Date },
    timeoutNotified: { type: Boolean, default: false },
    tpslTxnId: { type: String, default: '' },
    bankTxnId: { type: String, default: '' },
    tpslBankCd: { type: String, default: '' },
    tpslTxnTime: { type: String, default: '' },

    token: { type: String, default: '' }, // request hash token
    responseHash: { type: String, default: '' },

    rawSessionRequest: { type: Schema.Types.Mixed, default: null },
    rawGatewayResponse: { type: Schema.Types.Mixed, default: null },
    rawGatewayReturn: { type: Schema.Types.Mixed, default: null },

    /**
     * Browser origin where web checkout started (e.g. https://www.selorg.com).
     * Used to redirect gateway return to the same origin so localStorage auth survives.
     */
    checkoutOrigin: { type: String, default: '' },
  },
  { timestamps: true },
);

worldlinePaymentSchema.index({ userId: 1, orderId: 1, createdAt: -1 });
worldlinePaymentSchema.index({ orderId: 1, attemptNo: 1 }, { unique: true });
worldlinePaymentSchema.index({ txnId: 1 }, { unique: true });
worldlinePaymentSchema.index({ txnId: 1, orderId: 1 });
worldlinePaymentSchema.index({ idempotencyKey: 1 });
worldlinePaymentSchema.index({ standaloneCheckout: 1, externalOrderRef: 1, platform: 1, attemptNo: 1 });

export const WorldlinePayment =
  (mongoose.models.WorldlinePayment as mongoose.Model<IWorldlinePayment>) ||
  mongoose.model<IWorldlinePayment>('WorldlinePayment', worldlinePaymentSchema, 'worldline_payments');
