import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
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

/** Register an active banner into the matching home section definition so /home surfaces it. */
export async function registerBannerInHomeSection(banner: { _id: unknown; slot?: string; isActive?: boolean }): Promise<void> {
  if (banner.isActive === false) return;
  const slot = String(banner.slot || 'hero').toLowerCase();
  const sectionKey =
    slot === 'hero' || slot === 'banner_main' || slot === 'main'
      ? 'hero_banner'
      : slot === 'mid' || slot === 'banner_sub' || slot === 'sub'
        ? 'mid_banner'
        : null;
  if (!sectionKey) return;

  try {
    const { HomeSectionDefinition } = await import('../home/home.models');
    const bannerId = new mongoose.Types.ObjectId(String(banner._id));
    const existing = await HomeSectionDefinition.findOne({ key: sectionKey }).lean();
    if (existing) {
      const already = (existing.bannerIds || []).some((id) => String(id) === String(bannerId));
      if (already) return;
      await HomeSectionDefinition.updateOne(
        { key: sectionKey },
        {
          $addToSet: { bannerIds: bannerId },
          $set: {
            bannerSelectionMode: 'multiple',
            type: existing.type || (sectionKey === 'hero_banner' ? 'banner_main' : 'banner_sub'),
          },
        },
      );
    } else {
      await HomeSectionDefinition.create({
        key: sectionKey,
        label: sectionKey === 'hero_banner' ? 'Featured Offers' : 'Recommended for You',
        type: sectionKey === 'hero_banner' ? 'banner_main' : 'banner_sub',
        order: sectionKey === 'hero_banner' ? 0 : 2,
        bannerIds: [bannerId],
        bannerSelectionMode: 'multiple',
        useCarousel: true,
      });
    }
  } catch (err) {
    logger.warn('[banners] failed to register banner in home section', {
      bannerId: String(banner._id),
      error: (err as Error).message,
    });
  }
}

/** Remove a banner from home section definitions (on deactivate/delete). */
export async function unregisterBannerFromHomeSections(bannerId: string): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(bannerId)) return;
    const { HomeSectionDefinition } = await import('../home/home.models');
    await HomeSectionDefinition.updateMany({}, { $pull: { bannerIds: new mongoose.Types.ObjectId(bannerId) } });
  } catch (err) {
    logger.warn('[banners] failed to unregister banner from home sections', {
      bannerId,
      error: (err as Error).message,
    });
  }
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
