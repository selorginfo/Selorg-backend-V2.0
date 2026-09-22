import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { filterCatalogLabels } from '../../utils/catalogHygiene';
import { enrichBanner, enrichCategory, enrichProduct } from '../../utils/mediaEnrichment';
import { pickCategoryMediaFields, pickMaxOrderLimit } from '../../utils/catalogMediaFields';
import { enrichProductsWithVariants, pickImageFields } from '../products/products.variants';
import { attachLiveSellableStock } from '../products/products.stock';
import { Banner } from '../banners/banners.model';
import * as categoriesRepo from './categories.repository';
import {
  normalizeCategoryName,
  pickCanonicalSubcategory,
  dedupeSubcategoriesByName,
  dedupeTopCategoriesByFingerprint,
  findSameNamedSubcategoryTwins,
  CanonicalCandidate,
} from './categories.taxonomy';

const DEFAULT_PRODUCT_LIMIT = 50;

function escapeRegex(s: string): string {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Hierarchy code resolution (ported from legacy categoriesService.js) ---------------------

/** Hierarchy code strings for a level-2 subcategory: its own codes plus every level-3 leaf under it. */
export async function collectHierarchyCodesForSubcategory(subCategoryId?: unknown): Promise<string[]> {
  if (subCategoryId == null || subCategoryId === '') return [];
  if (!mongoose.Types.ObjectId.isValid(String(subCategoryId))) return [];
  const subOid = new mongoose.Types.ObjectId(String(subCategoryId));
  const [subDoc, leaves] = await Promise.all([categoriesRepo.findCategoryById(String(subOid)), categoriesRepo.findLevel3LeavesByParent(subOid)]);
  const set = new Set<string>();
  for (const c of subDoc?.hierarchyCodes || []) {
    const t = String(c || '').trim();
    if (t) set.add(t);
  }
  for (const leaf of leaves) {
    for (const c of leaf.hierarchyCodes || []) {
      const t = String(c || '').trim();
      if (t) set.add(t);
    }
  }
  return [...set];
}

/** Batch hierarchy-code collection for many subcategories (2 queries total instead of 2N). */
export async function collectHierarchyCodesForSubcategories(subCategoryIds: unknown[] = []): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const oids: mongoose.Types.ObjectId[] = [];
  for (const id of subCategoryIds) {
    if (id == null || id === '') continue;
    if (!mongoose.Types.ObjectId.isValid(String(id))) continue;
    oids.push(new mongoose.Types.ObjectId(String(id)));
    map.set(String(id), []);
  }
  if (oids.length === 0) return map;

  const [subs, leaves] = await Promise.all([categoriesRepo.findSubcategoriesByParentIds(oids), categoriesRepo.findLevel3LeavesByParents(oids)]);

  for (const sub of subs) {
    const set = new Set(map.get(String(sub._id)) || []);
    for (const c of sub.hierarchyCodes || []) {
      const t = String(c || '').trim();
      if (t) set.add(t);
    }
    map.set(String(sub._id), [...set]);
  }
  for (const leaf of leaves as Array<{ parentId: unknown; hierarchyCodes?: string[] }>) {
    const parentKey = String(leaf.parentId);
    const set = new Set(map.get(parentKey) || []);
    for (const c of leaf.hierarchyCodes || []) {
      const t = String(c || '').trim();
      if (t) set.add(t);
    }
    map.set(parentKey, [...set]);
  }
  return map;
}

/** Matches products whose stored taxonomy is missing (never set during import). */
const MISSING_SUBCATEGORY = { $or: [{ subcategoryId: null }, { subcategoryId: { $exists: false } }] };

/**
 * Strict subcategory filter: stored `subcategoryId` is authoritative. `hierarchyCode` is
 * only consulted for products with NO stored subcategory, so a product explicitly linked
 * elsewhere can never leak into this subcategory.
 */
export function productTaxonomyOrForSubcategory(subCategoryId: unknown, hierarchyCodes: string[]) {
  const subOid = new mongoose.Types.ObjectId(String(subCategoryId));
  const or: Record<string, unknown>[] = [{ subcategoryId: subOid }];
  if (Array.isArray(hierarchyCodes) && hierarchyCodes.length > 0) {
    or.push({ $and: [MISSING_SUBCATEGORY, { hierarchyCode: { $in: hierarchyCodes } }] });
  }
  return or;
}

async function collectHierarchyCodesForMainCategory(mainCategoryId: unknown, subcategoryDocs: Array<{ _id: unknown }>): Promise<string[]> {
  const set = new Set<string>();
  if (mainCategoryId != null && mongoose.Types.ObjectId.isValid(String(mainCategoryId))) {
    const main = await categoriesRepo.findCategoryById(String(mainCategoryId));
    for (const c of main?.hierarchyCodes || []) {
      const t = String(c || '').trim();
      if (t) set.add(t);
    }
  }
  for (const sub of subcategoryDocs || []) {
    const codes = await collectHierarchyCodesForSubcategory(sub._id);
    for (const c of codes) set.add(c);
  }
  return [...set];
}

/**
 * Strict main-category filter: stored `categoryId`/`subcategoryId` are authoritative.
 * `hierarchyCode` is only consulted for products with NO stored taxonomy at all.
 */
function productTaxonomyOrForMainCategory(mainCategoryId: unknown, subcategoryDocs: Array<{ _id: unknown }>, hierarchyCodes: string[] = [], aliasCategoryIds: unknown[] = []) {
  const subIds = (subcategoryDocs || []).map((s) => s._id);
  const categoryIds = [mainCategoryId, ...(aliasCategoryIds || []).filter(Boolean)];
  const or: Record<string, unknown>[] = [{ categoryId: { $in: categoryIds } }, { subcategoryId: { $in: subIds } }];
  if (Array.isArray(hierarchyCodes) && hierarchyCodes.length > 0) {
    or.push({ $and: [{ $or: [{ categoryId: null }, { categoryId: { $exists: false } }] }, MISSING_SUBCATEGORY, { hierarchyCode: { $in: hierarchyCodes } }] });
  }
  return or;
}

/** Full category payload for the Category Detail screen: category, subcategories, banners, products. */
export async function getCategoryPayload(categoryId: string, subCategoryId?: string) {
  const category = await categoriesRepo.findCategoryByIdActive(categoryId);
  if (!category) return null;

  const catId = category._id;
  const subcategories = await categoriesRepo.findSubcategories(catId);
  let banners: any[] = [];
  if (subCategoryId != null && String(subCategoryId).trim() !== '' && mongoose.Types.ObjectId.isValid(String(subCategoryId))) {
    banners = await categoriesRepo.findCategoryBanners(subCategoryId);
  } else {
    const childIds = subcategories.map((s) => s._id);
    banners = childIds.length
      ? await Banner.find({ slot: 'category', categoryId: { $in: childIds }, isActive: true }).sort({ order: 1 }).lean()
      : await categoriesRepo.findCategoryBanners(catId);
  }

  const productQueryBase = { isActive: true, isSaleable: true, classification: 'Style' };

  let productFilter: Record<string, unknown>;
  if (subCategoryId != null && String(subCategoryId).trim() !== '') {
    if (!mongoose.Types.ObjectId.isValid(String(subCategoryId))) {
      productFilter = { ...productQueryBase, _id: { $in: [] } };
    } else {
      const selected = subcategories.find((s) => String(s._id) === String(subCategoryId)) || (await categoriesRepo.findCategoryByIdBasic(subCategoryId));
      const twins = findSameNamedSubcategoryTwins(selected, subcategories);
      const taxonomyOr: Record<string, unknown>[] = [];
      for (const twin of twins.length ? twins : [{ _id: subCategoryId }]) {
        const hierarchyCodes = await collectHierarchyCodesForSubcategory(twin._id);
        taxonomyOr.push(...productTaxonomyOrForSubcategory(twin._id, hierarchyCodes));
      }
      productFilter = { ...productQueryBase, $or: taxonomyOr };
    }
  } else {
    const hierarchyCodes = await collectHierarchyCodesForMainCategory(catId, subcategories);
    productFilter = { ...productQueryBase, $or: productTaxonomyOrForMainCategory(catId, subcategories, hierarchyCodes) };
  }

  // NOTE: no fallback to the whole category when a subcategory is empty — that used to leak
  // unrelated products into subcategory views.
  const rawProducts = await categoriesRepo.findProductsForCategoryPayload(productFilter, DEFAULT_PRODUCT_LIMIT);
  const products = await attachLiveSellableStock(await enrichProductsWithVariants(rawProducts));

  const categoryOut = enrichCategory(category);
  const bannerBySubId = new Map<string, any>();
  for (const b of banners) {
    if (!b.categoryId) continue;
    const key = String(b.categoryId);
    if (!bannerBySubId.has(key)) bannerBySubId.set(key, enrichBanner(b as any));
  }
  return {
    category: {
      id: String(category._id),
      name: category.name,
      slug: category.slug,
      imageUrl: categoryOut.imageUrl || categoryOut.thumbnailUrl || null,
      thumbnailUrl: categoryOut.thumbnailUrl || null,
      cardImageUrl: categoryOut.cardImageUrl || null,
    },
    subcategories: subcategories.map((s) => {
      const sub = enrichCategory(s);
      const media = pickCategoryMediaFields(s as any);
      const fromBanner = bannerBySubId.get(String(s._id));
      return {
        id: String(s._id),
        name: s.name,
        slug: s.slug,
        imageUrl: sub.imageUrl || sub.thumbnailUrl || null,
        thumbnailUrl: sub.thumbnailUrl || null,
        cardImageUrl: sub.cardImageUrl || null,
        ...media,
        bannerImage: media.bannerImage || fromBanner?.imageUrl || fromBanner?.bannerImageUrl || null,
        bannerId: media.bannerId || fromBanner?.bannerId || null,
      };
    }),
    banners: banners.map((b) => {
      const enriched = enrichBanner(b as any);
      return {
        id: String(b._id),
        imageUrl: enriched.imageUrl || enriched.bannerImageUrl || null,
        videoUrl: b.videoUrl || null,
        link: b.link || null,
        redirectType: b.redirectType || null,
        redirectValue: b.redirectValue || null,
        title: b.title || null,
        categoryId: b.categoryId ? String(b.categoryId) : null,
        bannerId: b.bannerId || null,
      };
    }),
    products: products.map((p) => {
      const enriched = enrichProduct(p);
      const media = pickImageFields(enriched);
      return {
        id: String(p._id),
        name: p.name,
        imageUrl: media.imageUrl || null,
        thumbnailUrl: media.thumbnailUrl || null,
        cardImageUrl: media.cardImageUrl || null,
        images: Array.isArray(media.images) ? media.images : [],
        price: p.price,
        mrp: p.mrp,
        originalPrice: p.originalPrice,
        discount: p.discount,
        brand: p.brand,
        size: p.size || p.quantity || (Array.isArray(p.variants) && p.variants[0] ? p.variants[0].size : '') || '',
        quantity: p.quantity || p.size || (Array.isArray(p.variants) && p.variants[0] ? p.variants[0].size : ''),
        variants: Array.isArray(p.variants) ? p.variants : [],
        stock: p.stock,
        stockQuantity: p.stockQuantity,
        availableStock: p.availableStock,
        storeStock: p.storeStock,
        catalogStockQuantity: p.catalogStockQuantity,
        isSaleable: p.isSaleable,
        isActive: p.isActive,
        status: p.status,
        maxOrderLimit: pickMaxOrderLimit(p),
      };
    }),
  };
}

// --- Controller-level business logic (ported from legacy categoriesController.js) ---------

export async function listAllCategories() {
  const categories = await categoriesRepo.findAllCategories();
  const { Product } = await import('../products/products.model');

  const styleFilter = { classification: 'Style', isActive: true, isSaleable: true };
  const [bySubAgg, byCatAgg] = await Promise.all([
    Product.aggregate([
      { $match: { ...styleFilter, subcategoryId: { $ne: null } } },
      { $group: { _id: '$subcategoryId', count: { $sum: 1 } } },
    ]),
    Product.aggregate([
      { $match: { ...styleFilter, categoryId: { $ne: null } } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]),
  ]);
  const bySub = new Map<string, number>(bySubAgg.map((g: { _id: unknown; count: number }) => [String(g._id), g.count]));
  const byCat = new Map<string, number>(byCatAgg.map((g: { _id: unknown; count: number }) => [String(g._id), g.count]));

  const childrenByParent = new Map<string, string[]>();
  for (const c of categories) {
    if (c.parentId) {
      const p = String(c.parentId);
      if (!childrenByParent.has(p)) childrenByParent.set(p, []);
      childrenByParent.get(p)!.push(String(c._id));
    }
  }

  return categories.map((c) => {
    const media = enrichCategory(c);
    const id = String(c._id);
    let products: number;
    if (!c.parentId) {
      products = byCat.get(id) || 0;
      for (const childId of childrenByParent.get(id) || []) products += bySub.get(childId) || 0;
    } else {
      products = bySub.get(id) || 0;
    }
    return {
      id,
      name: c.name,
      slug: c.slug,
      parentId: c.parentId ? String(c.parentId) : null,
      isActive: c.isActive,
      order: c.order ?? 0,
      imageUrl: media.imageUrl || '',
      thumbnailUrl: media.thumbnailUrl || '',
      cardImageUrl: media.cardImageUrl || '',
      emoji: c.emoji || '',
      products,
    };
  });
}

export async function listCategories() {
  const categories = await categoriesRepo.findTopLevelActiveCategories();
  // Dedupe case + plural/singular L1 twins ("Millet Mandi" / "Millets Mandi"). The legacy
  // background self-heal (consolidateDuplicateTopCategories via setImmediate) that would
  // permanently merge these in the DB is deliberately not ported — see categories.taxonomy.ts.
  const deduped = dedupeTopCategoriesByFingerprint(categories);
  return filterCatalogLabels(
    deduped.map((c) => {
      const media = enrichCategory(c);
      return { id: String(c._id), name: c.name, slug: c.slug, imageUrl: media.imageUrl || '', thumbnailUrl: media.thumbnailUrl || '', cardImageUrl: media.cardImageUrl || '', emoji: c.emoji || '', order: c.order ?? 0 };
    }),
  );
}

export async function getCategoryDetail(id: string, subCategoryId?: string) {
  if (!id) throw AppError.badRequest('Category id required');
  if (!categoriesRepo.isValidObjectId(id)) throw AppError.badRequest('Invalid category id');
  if (subCategoryId != null && subCategoryId !== '' && !categoriesRepo.isValidObjectId(subCategoryId)) {
    throw AppError.badRequest('Invalid subCategoryId');
  }
  const payload = await getCategoryPayload(id, subCategoryId || undefined);
  if (!payload) throw AppError.notFound('Category');
  return payload;
}

async function resolveTopCategoryBySlug(slug: string) {
  const slugNorm = String(slug || '').trim().toLowerCase();
  const nameFromSlug = slugNorm.replace(/-/g, ' ');
  return (
    (await categoriesRepo.findCategoryBySlugL1(slugNorm)) ||
    (await categoriesRepo.findCategoryByNameL1(new RegExp(`^${escapeRegex(nameFromSlug)}$`, 'i'))) ||
    (await categoriesRepo.findTopCategoryByName(new RegExp(`^${escapeRegex(nameFromSlug)}$`, 'i')))
  );
}

function mapSubcategoriesWithCounts(
  subcategories: Array<{ _id: unknown; name: string; slug: string; emoji?: string; imageUrl?: string; thumbnailUrl?: string; cardImageUrl?: string; bannerImage?: string; bannerId?: string; bannerVideo?: string; youtubeUrl?: string }>,
  countMap: Map<string, number>,
  bannerByCategoryId?: Map<string, { imageUrl?: string; bannerId?: string }>,
) {
  return subcategories.map((s) => {
    const media = enrichCategory(s);
    const catMedia = pickCategoryMediaFields(s as any);
    const fromBanner = bannerByCategoryId?.get(String(s._id));
    const bannerImage = catMedia.bannerImage || fromBanner?.imageUrl || null;
    const bannerId = catMedia.bannerId || fromBanner?.bannerId || null;
    return {
      _id: String(s._id),
      name: s.name,
      slug: s.slug,
      emoji: s.emoji || '',
      imageUrl: media.imageUrl || '',
      thumbnailUrl: media.thumbnailUrl || '',
      cardImageUrl: media.cardImageUrl || '',
      productCount: countMap.get(String(s._id)) || 0,
      ...catMedia,
      bannerImage,
      bannerId,
    };
  });
}

export async function getCategoryProductsBySlug(
  slug: string,
  options: { sort?: string; page?: number; limit?: number; inStock?: string; subcategory?: string; storeId?: string },
) {
  const sort = options.sort || 'sortOrder';
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 20));
  const subcategory = String(options.subcategory || '').trim();

  const category = await resolveTopCategoryBySlug(slug);
  if (!category) throw AppError.notFound('Category');

  const subcategories = await categoriesRepo.findSubcategories(category._id);
  const subcategoryLower = subcategory.toLowerCase();

  let subcategoryId: unknown = null;
  if (subcategory) {
    const nameFromSubSlug = normalizeCategoryName(subcategoryLower.replace(/-\d+$/, '').replace(/-/g, ' '));
    const nameMatches = subcategories.filter((s) => s.slug === subcategory || s.slug === subcategoryLower || normalizeCategoryName(s.name) === nameFromSubSlug || normalizeCategoryName(s.name) === normalizeCategoryName(subcategoryLower.replace(/-/g, ' ')));
    if (nameMatches.length === 1) {
      subcategoryId = nameMatches[0]._id;
    } else if (nameMatches.length > 1) {
      const scored: CanonicalCandidate[] = await Promise.all(
        nameMatches.map(async (s) => {
          const codes = await collectHierarchyCodesForSubcategory(s._id);
          const n = await categoriesRepo.countStyleProducts({ $or: productTaxonomyOrForSubcategory(s._id, codes) });
          return { ...s, productCount: n };
        }),
      );
      subcategoryId = pickCanonicalSubcategory(scored)?._id || nameMatches[0]._id;
    }
  }

  // Include prior/duplicate L1 docs with the same slug or name (case-insensitive) so
  // products still linked to legacy ObjectIds remain visible.
  const aliasCategoryIds = await categoriesRepo.findAliasTopCategoryIds(category.slug, new RegExp(`^${escapeRegex(category.name)}$`, 'i'), category._id);
  const aliasSubs = aliasCategoryIds.length > 0 ? await categoriesRepo.findSubcategoriesByParentIds(aliasCategoryIds) : [];
  const allSubsForTaxonomy = [...subcategories, ...aliasSubs];

  let taxonomyOr: Record<string, unknown>[];
  if (subcategoryId) {
    const subDoc = subcategories.find((s) => String(s._id) === String(subcategoryId)) || allSubsForTaxonomy.find((s) => String(s._id) === String(subcategoryId));
    const twinSubs = findSameNamedSubcategoryTwins(subDoc, allSubsForTaxonomy);
    taxonomyOr = [];
    const allCodes = new Set<string>();
    for (const twin of twinSubs) {
      const codes = await collectHierarchyCodesForSubcategory(twin._id);
      for (const c of codes) allCodes.add(c);
      taxonomyOr.push(...productTaxonomyOrForSubcategory(twin._id, codes));
    }
    if (taxonomyOr.length === 0) {
      const codes = await collectHierarchyCodesForSubcategory(subcategoryId);
      taxonomyOr = productTaxonomyOrForSubcategory(subcategoryId, codes);
    }
    if (allCodes.size > 0) {
      taxonomyOr.push(...productTaxonomyOrForSubcategory(subcategoryId, [...allCodes]).filter((clause) => '$and' in clause));
    }
  } else {
    const codes = await collectHierarchyCodesForMainCategory(category._id, allSubsForTaxonomy);
    taxonomyOr = productTaxonomyOrForMainCategory(category._id, allSubsForTaxonomy, codes, aliasCategoryIds);
  }

  const storeId = String(options.storeId || '').trim();
  let query: Record<string, unknown> = { classification: 'Style', isActive: true, isSaleable: true, $or: taxonomyOr };

  if (storeId) {
    const availableItems = await categoriesRepo.findAvailableStoreProductIds(storeId);
    query._id = { $in: availableItems.map((i) => i.productId) };
  }
  if (String(options.inStock).toLowerCase() === 'true') {
    query = { $and: [query, { $or: [{ stock: { $gt: 0 } }, { stockQuantity: { $gt: 0 } }] }] };
  }

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    sortOrder: { sortOrder: 1, order: 1, createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    name_asc: { name: 1 },
    newest: { createdAt: -1 },
  };
  const dbSort = sortMap[sort] || sortMap.sortOrder;
  const skip = (page - 1) * limit;
  const [rawProducts, total] = await Promise.all([categoriesRepo.findProductsPaged(query, dbSort, skip, limit), categoriesRepo.countProducts(query)]);
  const products = await enrichProductsWithVariants(rawProducts, { dedupeProductLines: false });
  const productsWithStock = await attachLiveSellableStock(products, { storeId: storeId || null });

  const codesBySub = await collectHierarchyCodesForSubcategories(subcategories.map((s) => s._id));
  const productCountEntries = await Promise.all(
    subcategories.map(async (s) => {
      const codes = codesBySub.get(String(s._id)) || [];
      const count = await categoriesRepo.countStyleProducts({ $or: productTaxonomyOrForSubcategory(s._id, codes) });
      return [String(s._id), count] as const;
    }),
  );
  const countMap = new Map(productCountEntries);
  const subIds = subcategories.map((s) => s._id);
  const categoryBanners = subIds.length
    ? await Banner.find({ slot: 'category', categoryId: { $in: subIds }, isActive: true })
      .sort({ order: 1 })
      .lean()
    : [];
  const bannerByCategoryId = new Map<string, { imageUrl?: string; bannerId?: string }>();
  for (const b of categoryBanners) {
    const key = String(b.categoryId);
    if (bannerByCategoryId.has(key)) continue;
    const enriched = enrichBanner(b as any);
    bannerByCategoryId.set(key, {
      imageUrl: enriched.imageUrl || enriched.bannerImageUrl || undefined,
      bannerId: b.bannerId || undefined,
    });
  }
  // Resolve Category.bannerId → Banner doc when categoryId link is missing on the banner.
  const bannerIdRefs = subcategories
    .map((s) => String((s as any).bannerId || '').trim())
    .filter(Boolean);
  if (bannerIdRefs.length) {
    const byCode = await Banner.find({ bannerId: { $in: bannerIdRefs }, isActive: true }).lean();
    const codeMap = new Map(byCode.map((b) => [String(b.bannerId), b]));
    for (const s of subcategories) {
      const key = String(s._id);
      if (bannerByCategoryId.has(key)) continue;
      const code = String((s as any).bannerId || '').trim();
      const b = code ? codeMap.get(code) : undefined;
      if (!b) continue;
      const enriched = enrichBanner(b as any);
      bannerByCategoryId.set(key, {
        imageUrl: enriched.imageUrl || enriched.bannerImageUrl || undefined,
        bannerId: b.bannerId || code,
      });
    }
  }
  const mappedSubs = mapSubcategoriesWithCounts(subcategories, countMap, bannerByCategoryId);

  return {
    category: {
      _id: String(category._id),
      name: category.name,
      slug: category.slug,
      imageUrl: enrichCategory(category as any).imageUrl || category.imageUrl || '',
      emoji: category.emoji || '',
      bannerImage: pickCategoryMediaFields(category as any).bannerImage,
    },
    subcategories: filterCatalogLabels(dedupeSubcategoriesByName(mappedSubs)),
    products: productsWithStock.map((p) => {
      const enriched = enrichProduct(p);
      const media = pickImageFields(enriched);
      const subcategoryId = p.subcategoryId ? String(p.subcategoryId) : '';
      const subcategoryName =
        (subcategories.find((s) => String(s._id) === subcategoryId)?.name as string | undefined) ||
        (allSubsForTaxonomy.find((s) => String(s._id) === subcategoryId)?.name as string | undefined) ||
        '';
      return {
        id: String(p._id),
        name: p.name,
        size: p.size,
        tag: p.tag,
        price: p.price,
        mrp: p.mrp,
        imageUrl: media.imageUrl || null,
        thumbnailUrl: media.thumbnailUrl || null,
        cardImageUrl: media.cardImageUrl || null,
        images: Array.isArray(media.images) ? media.images : [],
        variants: Array.isArray(p.variants) ? p.variants : [],
        stock: p.stock,
        stockQuantity: p.stockQuantity,
        availableStock: p.availableStock,
        storeStock: p.storeStock,
        catalogStockQuantity: p.catalogStockQuantity,
        isSaleable: p.isSaleable,
        isActive: p.isActive,
        status: p.status,
        maxOrderLimit: pickMaxOrderLimit(p),
        categoryId: p.categoryId ? String(p.categoryId) : String(category._id),
        subcategoryId: subcategoryId || undefined,
        subcategoryName: subcategoryName || undefined,
      };
    }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getSubcategoriesByCategorySlug(slug: string) {
  const category = await resolveTopCategoryBySlug(slug);
  if (!category) throw AppError.notFound('Category');

  const subcategories = await categoriesRepo.findSubcategories(category._id);
  const codesBySub = await collectHierarchyCodesForSubcategories(subcategories.map((s) => s._id));
  const countEntries = await Promise.all(
    subcategories.map(async (s) => {
      const codes = codesBySub.get(String(s._id)) || [];
      const count = await categoriesRepo.countStyleProducts({ $or: productTaxonomyOrForSubcategory(s._id, codes) });
      return [String(s._id), count] as const;
    }),
  );
  const countMap = new Map(countEntries);
  const mappedSubs = mapSubcategoriesWithCounts(subcategories, countMap);
  // Legacy self-heal (consolidateDuplicateSubcategories / deactivateLegacySeedProducts via
  // setImmediate) deliberately not ported — see categories.taxonomy.ts.
  return filterCatalogLabels(dedupeSubcategoriesByName(mappedSubs));
}
