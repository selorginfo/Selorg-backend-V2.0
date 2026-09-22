import { Page } from './pages.model';
import { Banner } from '../banners/banners.model';
import { Category } from '../categories/categories.model';
import { HomeConfig, LifestyleItem, PromoBlock } from '../home/home.models';
import { resolveCollectionProducts } from '../collections/collections.service';
import mongoose from 'mongoose';

function isWithinSchedule(schedule?: { startDate?: Date; endDate?: Date }): boolean {
  if (!schedule) return true;
  const now = new Date();
  if (schedule.startDate && schedule.startDate > now) return false;
  if (schedule.endDate && schedule.endDate < now) return false;
  return true;
}

function applyMaxItems<T>(arr: T[], maxItems?: number): T[] {
  if (!Array.isArray(arr)) return arr;
  if (!maxItems || maxItems <= 0) return arr;
  return arr.slice(0, maxItems);
}

async function resolveBlockData(block: any, siteId?: string | null): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};
  const type: string = block.type;
  const config = block.config || {};
  const maxItems: number | undefined = config.maxItems;

  if (type === 'heroBanner' || type === 'bannerCarousel') {
    const slot = type === 'heroBanner' ? 'hero' : 'mid';
    const query: Record<string, unknown> = { slot, isActive: true };
    if (siteId) query.siteId = siteId;
    const banners = await Banner.find(query).sort({ order: 1 }).lean();
    const active = banners.filter((b) => {
      const ba = b as any;
      return (!ba.startDate || ba.startDate <= new Date()) && (!ba.endDate || ba.endDate >= new Date());
    });
    data.banners = applyMaxItems(active, maxItems ?? 5);

  } else if (type === 'categoryGrid') {
    const categoryIds = block.dataSource?.categoryIds;
    if (Array.isArray(categoryIds) && categoryIds.length > 0) {
      const cats = await Category.find({ _id: { $in: categoryIds }, isActive: true }).lean();
      const orderMap = new Map(categoryIds.map((id: any, i: number) => [String(id), i]));
      data.categories = cats.sort((a, b) => (orderMap.get(String(a._id)) ?? 99) - (orderMap.get(String(b._id)) ?? 99));
    } else {
      const homeConfig = await HomeConfig.findOne({ key: 'main' }).lean();
      const ids = ((homeConfig as any)?.categoryIds || []).map((id: any) =>
        typeof id === 'object' && id?._id ? id._id : id,
      ).filter(Boolean);
      if (ids.length > 0) {
        const cats = await Category.find({ _id: { $in: ids }, isActive: true }).lean();
        const orderMap = new Map(ids.map((id: any, i: number) => [String(id), i]));
        data.categories = applyMaxItems(
          cats.sort((a, b) => (Number(orderMap.get(String(a._id)) ?? 99)) - (Number(orderMap.get(String(b._id)) ?? 99))),
          maxItems,
        );
      } else {
        data.categories = applyMaxItems(
          await Category.find({ isActive: true }).sort({ order: 1 }).lean(),
          maxItems ?? 12,
        );
      }
    }

  } else if (type === 'productCarousel' || type === 'collectionCarousel') {
    const collectionId = block.dataSource?.collectionId;
    if (collectionId) {
      const { products } = await resolveCollectionProducts(new mongoose.Types.ObjectId(String(collectionId)), {
        limit: maxItems || 20,
      });
      data.products = products;
    }

  } else if (type === 'lifestyleGrid') {
    const items = await LifestyleItem.find({ isActive: true }).sort({ order: 1 }).lean();
    data.items = applyMaxItems(items, maxItems ?? 6);

  } else if (type === 'promoImage') {
    const referenceId = block.referenceId;
    if (referenceId) {
      const promo = await PromoBlock.findById(referenceId).lean();
      if (promo) data.promo = promo;
    }
  }

  return data;
}

export async function getPageBySlug(slug: string, siteId?: string | null) {
  const query: Record<string, unknown> = { slug, status: 'published' };
  if (siteId) query.siteId = siteId;
  else query.siteId = null;

  const page = await Page.findOne(query).lean();
  if (!page) return null;

  const now = new Date();
  const activeBlocks = page.blocks
    .filter((b) => isWithinSchedule(b.schedule))
    .sort((a, b) => a.order - b.order);

  const blocksWithData = await Promise.all(
    activeBlocks.map(async (block) => {
      const blockData = await resolveBlockData(block, siteId);
      return { ...block, data: blockData };
    }),
  );

  return {
    id: String(page._id),
    slug: page.slug,
    title: page.title,
    status: page.status,
    version: page.version,
    publishedAt: page.publishedAt,
    blocks: blocksWithData,
  };
}
