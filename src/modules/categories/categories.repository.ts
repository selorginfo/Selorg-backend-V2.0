import mongoose from 'mongoose';
import { Category } from './categories.model';
import { Product } from '../products/products.model';
import { StoreInventory } from '../products/store-inventory.model';
import { Banner } from '../banners/banners.model';

export function findTopLevelActiveCategories() {
  return Category.find({ isActive: true, parentId: { $in: [null, undefined] } }).sort({ order: 1 }).lean();
}

export function findAllCategories() {
  return Category.find({}).sort({ order: 1 }).lean();
}

export function findCategoryByIdActive(id: string) {
  return Category.findOne({ _id: id, isActive: true }).lean();
}

export function findSubcategories(parentId: unknown) {
  return Category.find({ parentId, isActive: true }).sort({ order: 1 }).lean();
}

export function findCategoryBySlugL1(slugNorm: string) {
  return Category.findOne({ slug: slugNorm, isActive: true, level: 1 }).lean();
}

export function findCategoryByNameL1(nameRegex: RegExp) {
  return Category.findOne({ isActive: true, level: 1, name: nameRegex }).lean();
}

export function findTopCategoryByName(nameRegex: RegExp) {
  return Category.findOne({ isActive: true, parentId: { $in: [null, undefined] }, name: nameRegex }).lean();
}

export function findAliasTopCategoryIds(slug: string, nameRegex: RegExp, excludeId: unknown) {
  return Category.find({ parentId: { $in: [null, undefined] }, $or: [{ slug }, { name: nameRegex }] })
    .select('_id')
    .lean()
    .then((docs) => docs.map((c) => c._id).filter((id) => String(id) !== String(excludeId)));
}

export function findSubcategoriesByParentIds(parentIds: unknown[]) {
  return Category.find({ parentId: { $in: parentIds }, isActive: true }).select('_id name slug hierarchyCodes').lean();
}

export function findCategoryById(id: string) {
  return Category.findById(id).select('hierarchyCodes').lean();
}

export function findLevel3LeavesByParent(parentId: unknown) {
  return Category.find({ parentId, level: 3, isActive: true }).select('hierarchyCodes').lean();
}

export function findLevel3LeavesByParents(parentIds: unknown[]) {
  return Category.find({ parentId: { $in: parentIds }, level: 3, isActive: true }).select('parentId hierarchyCodes').lean();
}

export function findCategoryByIdBasic(id: string) {
  return Category.findById(id).select('_id name slug').lean();
}

export function countStyleProducts(filter: Record<string, unknown>) {
  return Product.countDocuments({ classification: 'Style', isActive: true, isSaleable: true, ...filter });
}

export function findProductsPaged(query: Record<string, unknown>, sort: Record<string, 1 | -1>, skip: number, limit: number) {
  return Product.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .select('_id sku name size tag price mrp taxPercent imageUrl thumbnailUrl cardImageUrl images isSaleable isActive status stock stockQuantity fixedStock categoryId subcategoryId maxOrderLimit')
    .lean();
}

export function countProducts(query: Record<string, unknown>) {
  return Product.countDocuments(query);
}

export function findAvailableStoreProductIds(storeId: string) {
  return StoreInventory.find({ storeId, isAvailable: true, quantity: { $gt: 0 } }).select('productId').lean();
}

export function findCategoryBanners(categoryId: unknown) {
  return Banner.find({ slot: 'category', categoryId, isActive: true }).sort({ order: 1 }).lean();
}

export function findProductsForCategoryPayload(filter: Record<string, unknown>, limit: number) {
  return Product.find(filter).sort({ sortOrder: 1, order: 1, createdAt: -1 }).limit(limit).lean();
}

export function isValidObjectId(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}
