import { Banner } from './banners.model';
import { Product } from '../products/products.model';

export function findBannerById(id: string) {
  return Banner.findById(id).lean();
}

export function findSaleableProductsByIds(ids: unknown[]) {
  return Product.find({ _id: { $in: ids }, isActive: true, isSaleable: true, classification: 'Style' })
    .select({ name: 1, price: 1, mrp: 1, imageUrl: 1, images: 1 })
    .lean();
}
