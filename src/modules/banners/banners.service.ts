import { AppError } from '../../utils/AppError';
import * as bannersRepo from './banners.repository';
import { IContentItem } from './banners.model';

type LeanContentItem = IContentItem & { products?: unknown[] };

function collectProductIds(items: LeanContentItem[]): unknown[] {
  let ids: unknown[] = [];
  for (const c of items || []) {
    if (c.type === 'products' && Array.isArray(c.productIds)) {
      ids = ids.concat(c.productIds);
    }
    if (Array.isArray(c.nestedContentItems) && c.nestedContentItems.length > 0) {
      ids = ids.concat(collectProductIds(c.nestedContentItems as LeanContentItem[]));
    }
  }
  return ids;
}

/** Resolves productIds within banner content blocks (including nested sub-page blocks) for the landing page. */
export async function getBannerById(id: string) {
  const banner = await bannersRepo.findBannerById(id);
  if (!banner) throw AppError.notFound('Banner');

  const contentItems = (banner.contentItems || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) as LeanContentItem[];

  const productIds = collectProductIds(contentItems);
  const products = productIds.length ? await bannersRepo.findSaleableProductsByIds(productIds) : [];
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  function attachProducts(items: LeanContentItem[]): LeanContentItem[] {
    return (items || [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((item) => {
        let out: LeanContentItem = { ...item };
        if (item.type === 'products' && Array.isArray(item.productIds)) {
          out = { ...out, products: item.productIds.map((pid) => productMap.get(String(pid))).filter(Boolean) };
        }
        if (Array.isArray(item.nestedContentItems) && item.nestedContentItems.length > 0) {
          out = { ...out, nestedContentItems: attachProducts(item.nestedContentItems as LeanContentItem[]) };
        }
        return out;
      });
  }

  return {
    _id: banner._id,
    title: banner.title,
    imageUrl: banner.imageUrl,
    contentItems: attachProducts(contentItems),
  };
}
