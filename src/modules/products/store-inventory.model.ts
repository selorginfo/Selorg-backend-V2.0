import mongoose, { Document, Schema } from 'mongoose';

// ── Warehouse-level inventory ─────────────────────────────────────────────────

export interface IWarehouseInventory extends Document {
  warehouseId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  quantity: number;
  reservedQty: number;
  isAvailable: boolean;
  lowStockThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

const warehouseInventorySchema = new Schema<IWarehouseInventory>(
  {
    warehouseId: { type: Schema.Types.ObjectId, ref: 'WarehouseLocation', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'CustomerProduct', required: true },
    quantity: { type: Number, default: 0, min: 0 },
    reservedQty: { type: Number, default: 0, min: 0 },
    isAvailable: { type: Boolean, default: true },
    lowStockThreshold: { type: Number, default: 5 },
  },
  { timestamps: true },
);
warehouseInventorySchema.index({ warehouseId: 1, productId: 1 }, { unique: true });
warehouseInventorySchema.index({ warehouseId: 1, isAvailable: 1 });

export const WarehouseInventory =
  (mongoose.models.WarehouseInventory as mongoose.Model<IWarehouseInventory>) ||
  mongoose.model<IWarehouseInventory>('WarehouseInventory', warehouseInventorySchema, 'warehouse_inventory');

// ── Dark-store-level inventory ────────────────────────────────────────────────

export interface IStoreInventory extends Document {
  storeId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  quantity: number;
  isAvailable: boolean;
  reservedQty: number;
  lowStockThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

const storeInventorySchema = new Schema<IStoreInventory>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'DarkStore', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'CustomerProduct', required: true },
    quantity: { type: Number, default: 0, min: 0 },
    isAvailable: { type: Boolean, default: true },
    reservedQty: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5 },
  },
  { timestamps: true },
);
storeInventorySchema.index({ storeId: 1, productId: 1 }, { unique: true });
storeInventorySchema.index({ storeId: 1, isAvailable: 1 });

export const StoreInventory =
  (mongoose.models.StoreInventory as mongoose.Model<IStoreInventory>) ||
  mongoose.model<IStoreInventory>('StoreInventory', storeInventorySchema, 'store_inventory');
