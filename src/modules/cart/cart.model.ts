import mongoose, { Document, Schema } from 'mongoose';

export interface ICartItem {
  _id: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  variantId: string;
  variantSize: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  gstRate: number;
  productName: string;
  image: string;
}

export interface ICart extends Document {
  userId: mongoose.Types.ObjectId;
  items: mongoose.Types.DocumentArray<ICartItem>;
  /**
   * Client-generated idempotency keys of guest-cart merges already applied.
   * Guarantees a guest cart is merged exactly once even when the client
   * retries (page refresh, remount, multiple tabs, network retry).
   */
  appliedMergeKeys: string[];
  createdAt: Date;
  updatedAt: Date;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'CustomerProduct', required: true },
    variantId: { type: String, default: '' },
    variantSize: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    originalPrice: { type: Number },
    gstRate: { type: Number, default: 0 },
    productName: { type: String, default: '' },
    image: { type: String, default: '' },
  },
  { _id: true },
);

const cartSchema = new Schema<ICart>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'CustomerUser', required: true, unique: true },
    items: [cartItemSchema],
    appliedMergeKeys: { type: [String], default: [] },
  },
  { timestamps: true },
);
cartSchema.index({ userId: 1 });

export const Cart =
  (mongoose.models.CustomerCart as mongoose.Model<ICart>) ||
  mongoose.model<ICart>('CustomerCart', cartSchema, 'customer_carts');
