import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { Product } from './products.model';
import { AppError } from '../../utils/AppError';
import { normalizeSelorgCdnUrl } from '../../utils/mediaEnrichment';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
export const uploadMiddleware = upload.single('file');

const uploadImage = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
export const uploadImageMiddleware = uploadImage.single('image');

export async function uploadProductImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) throw AppError.badRequest('No image file provided');
    const { uploadBufferToS3 } = await import('../../services/s3.service');
    const { randomUUID } = await import('crypto');
    const ext = req.file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const bucket = process.env.AWS_S3_BUCKET_PRODUCT_IMAGES || 'selorg-product-images';
    const url = await uploadBufferToS3(
      req.file.buffer,
      bucket,
      'products',
      `${randomUUID()}.${ext}`,
      req.file.mimetype,
    );
    res.status(200).json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
}

// Mastersheet header row — used for template generation
const MASTERSHEET_HEADERS = [
  'SKU Code', 'SKU Name', 'Priority', 'SKU Classification', 'SKU Sub-Classification',
  'SKU Source', 'Similar Products', 'Primary Vendor', 'Brand Code', 'Mfg SKU Code',
  'Size', 'SKU UOM', 'Colour', 'Material', 'Weight(kg)', 'Height(cm)', 'Length(cm)',
  'Width(cm)', 'Cube', 'Primary UPC/EAN', 'Country Of Origin', 'Hierarchy Code',
  'MSRP/MRP', 'Sale Price', 'Base Cost', 'HSN Code', 'Tax %', 'SGST %', 'CGST %',
  'IGST %', 'Cess %', 'SGST Amount (₹)', 'CGST Amount (₹)', 'IGST Amount (₹)',
  'Cess Amount (₹)', 'Price incl. GST (₹)', 'About', 'Nutrition', 'Origin of Place',
  'Health Benefits', 'Shipping & Returns', 'SKU Rotation', 'Rotate By',
  'Receiving Validation Code', 'Picking Instructions', 'Shipping Instructions',
  'Threshold Alert Required', 'Threshold Qty', 'Shipping Charges', 'Handling Charges',
  'Is ARS Applicable?', 'Follow Style', 'ARS Calculation Method', 'Fixed Stock',
  'Model Stock', 'SKUimgURL', 'Image URL 2', 'Image URL 3', 'Image URL 4', 'Image URL 5', 'Search Keywords', 'Order Limit Type',
  'Min Qty Per Order', 'Max Qty Per Order', 'Max Weight Per Order',
  'Cart Limit Per Order', 'Max Order Value', 'Max Cart Qty', 'Max Cart Weight',
  'Allow Mixed Pack', 'Restriction Type', 'Warehouse Code',
];

export async function listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.categoryId) filter.categoryId = req.query.categoryId;
    if (req.query.q) {
      const regex = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: regex }, { sku: regex }, { brand: regex }];
    }

    // Filter by warehouse: only return products that have a WarehouseInventory entry for this warehouse
    if (req.query.warehouseId) {
      const { WarehouseInventory } = await import('./store-inventory.model');
      const productIds = await WarehouseInventory.distinct('productId', { warehouseId: req.query.warehouseId });
      filter._id = { $in: productIds };
    }

    const [products, total] = await Promise.all([
      Product.find(filter).select('-udf -styleAttributes -storeLinks').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);
    res.status(200).json({ success: true, data: products, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) throw AppError.notFound('Product not found');
    res.status(200).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const { sku, name } = body as { sku?: string; name?: string };
    if (!sku || !name) throw AppError.badRequest('sku and name are required');
    const exists = await Product.findOne({ sku }).lean();
    if (exists) throw AppError.badRequest(`Product with SKU "${sku}" already exists`);

    // Strip warehouse fields + convert description string before saving product
    const warehouseStock = (body.warehouseStock ?? []) as Array<{ warehouseId: string; quantity: number }>;
    const { warehouseStock: _ws, warehouseIds: _wids, totalWarehouseQty: _wqty, ...productFields } = body;
    if (productFields.description !== undefined && typeof productFields.description === 'string') {
      productFields.description = { about: productFields.description };
    }
    if (Array.isArray(productFields.images) && productFields.images.length > 0 && !productFields.imageUrl) {
      productFields.imageUrl = productFields.images[0];
    }
    const product = await Product.create({ ...productFields, status: (productFields.status as string) ?? 'draft' });

    // Create per-warehouse inventory entries from explicit rows
    const validRows = Array.isArray(warehouseStock)
      ? warehouseStock.filter((r) => r.warehouseId)
      : [];
    if (validRows.length > 0) {
      const { WarehouseInventory } = await import('./store-inventory.model');
      await Promise.all(
        validRows.map((row) =>
          WarehouseInventory.create({
            warehouseId: row.warehouseId,
            productId: product._id,
            quantity: Math.max(0, Number(row.quantity) || 0),
            reservedQty: 0,
            isAvailable: true,
            lowStockThreshold: 5,
          }).catch(() => {}),
        ),
      );
    }

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = { ...req.body as Record<string, unknown> };
    // Strip warehouse fields — not stored on the Product doc
    delete body.warehouseStock;
    delete body.warehouseIds;
    delete body.totalWarehouseQty;
    delete body.warehouseId;
    delete body.initialWarehouseQty;
    // Convert plain description string to nested object
    if (body.description !== undefined && typeof body.description === 'string') {
      body.description = { about: body.description };
    }
    if (Array.isArray(body.images) && (body.images as string[]).length > 0 && !body.imageUrl) {
      body.imageUrl = (body.images as string[])[0];
    }
    // Keep status ↔ isActive in sync so customer catalog filters stay consistent.
    if (body.status !== undefined && body.isActive === undefined) {
      const s = String(body.status).toLowerCase();
      body.isActive = s === 'active';
    }
    if (body.isActive !== undefined && body.status === undefined) {
      body.status = body.isActive ? 'active' : 'inactive';
    }
    const product = await Product.findByIdAndUpdate(req.params.id, { $set: body }, { new: true, runValidators: false }).lean();
    if (!product) throw AppError.notFound('Product not found');
    res.status(200).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { $set: { status: 'inactive', isActive: false } }, { new: true }).lean();
    if (!product) throw AppError.notFound('Product not found');
    res.status(200).json({ success: true, data: { message: 'Product deactivated' } });
  } catch (err) {
    next(err);
  }
}

// hint text per column — parallel to MASTERSHEET_HEADERS
const MASTERSHEET_HINTS = [
  'Mandatory, Unique', 'Mandatory', 'Optional', 'Style | Variant', 'Optional',
  'Optional', 'Comma-separated SKUs', 'Vendor Code', 'Optional', 'Optional',
  'e.g. 500g', 'e.g. EACH / KG / PCS', 'Optional', 'Optional', 'kg', 'cm', 'cm',
  'cm', '', 'Barcode / EAN', 'e.g. India', 'Cat1|Cat2|Cat3', 'MRP price', 'Sale price',
  'Cost price', 'HSN Code', 'Tax %', '', '', '', '', '', '', '', '', '',
  'Product description', 'Nutrition info', 'Origin region', 'Health benefits',
  'Shipping policy', '', '', '', '', '', 'Yes / No', '', '', '', 'Yes / No', '', '',
  '', '', 'Image URL', 'Image URL 2 (optional)', 'Image URL 3 (optional)', 'Image URL 4 (optional)', 'Image URL 5 (optional)', 'Comma-separated keywords', 'None / Qty / Weight / Value',
  '', '', '', '', '', '', '', 'Yes / No', '', 'e.g. WH-01',
];

const MASTERSHEET_SAMPLE = [
  'S001', 'Sample Product 500g', 1, 'Style', 'Organic', '', '', '', 'BrandX', 'MFG001',
  '500g', 'EACH', '', '', 0.5, 10, 15, 10, '', '', 'India', 'Fruits|Native Fruits|Mango',
  99, 79, 45, '0804', 5, '', '', '', '', '', '', '', '', '',
  'About this product', '', '', '', '', '', '', '', '', '', 'No', 0, 0, 0, 'No', '', '',
  0, 0, 'https://example.com/img.jpg', '', '', '', '', 'mango,fruit', 'None', '', '', '', '', '', '', '', 'No', '', 'WH-01',
];

// Columns where the hint says "Mandatory" (0-based indexes into MASTERSHEET_HEADERS)
const MANDATORY_COL_INDEXES = new Set(
  MASTERSHEET_HINTS.map((h, i) => (h.startsWith('Mandatory') ? i : -1)).filter((i) => i >= 0),
);

export async function downloadTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('SKU Master');

    // Column widths
    ws.columns = MASTERSHEET_HEADERS.map((header) => ({ header: '', width: Math.max(header.length + 4, 18) }));

    // Row 1 — column headers (dark background, white bold text)
    const headerRow = ws.addRow(MASTERSHEET_HEADERS);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { vertical: 'middle', wrapText: false };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF374151' } } };
    });

    // Row 2 — validation hints (red bg for Mandatory, grey for others)
    const hintsRow = ws.addRow(MASTERSHEET_HINTS);
    hintsRow.height = 18;
    hintsRow.eachCell((cell, colNumber) => {
      const isMandatory = MANDATORY_COL_INDEXES.has(colNumber - 1);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isMandatory ? 'FFEF4444' : 'FFF3F4F6' },
      };
      cell.font = {
        bold: isMandatory,
        color: { argb: isMandatory ? 'FFFFFFFF' : 'FF6B7280' },
        size: 9,
        italic: !isMandatory,
      };
      cell.alignment = { vertical: 'middle' };
    });

    // Row 3 — sample data (light yellow background)
    const sampleRow = ws.addRow(MASTERSHEET_SAMPLE);
    sampleRow.height = 18;
    sampleRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEFCE8' } };
      cell.font = { color: { argb: 'FF374151' }, size: 10 };
      cell.alignment = { vertical: 'middle' };
    });

    // Freeze the header and hint rows so columns are always visible
    ws.views = [{ state: 'frozen', ySplit: 2 }];

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="selorg_product_upload_template.xlsx"');
    res.send(buf);
  } catch (err) {
    next(err);
  }
}

// Detects mastersheet metadata rows (rows 2-4: validation hints & repeated headers)
// These rows have text like "Mandatory", "SKU Code", "Not Null, Unique" in the SKU Code column
export function isMetaRow(sku: string): boolean {
  if (!sku) return true;
  const lower = sku.toLowerCase();
  return (
    lower === 'sku code' ||
    lower === 'mandatory' ||
    lower.includes('not null') ||
    lower.includes('null') ||
    lower.includes('unique') ||
    lower === 'nan'
  );
}

export async function bulkUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) throw AppError.badRequest('No file uploaded');
    const ext = req.file.originalname.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) throw AppError.badRequest('Only .xlsx, .xls, and .csv files are supported');

    let rows: Record<string, unknown>[] = [];

    if (ext === 'csv') {
      const text = req.file.buffer.toString('utf-8');
      const lines = text.split(/\r?\n/).filter(Boolean);
      const headers = lines[0]!.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      rows = lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
        return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
      });
    } else {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = wb.SheetNames.includes('SKU Master') ? 'SKU Master' : wb.SheetNames[0]!;
      const ws = wb.Sheets[sheetName]!;
      rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    }

    if (rows.length === 0) throw AppError.badRequest('File contains no data rows');
    if (rows.length > 2000) throw AppError.badRequest('Maximum 2000 rows per upload');

    const { WarehouseInventory } = await import('./store-inventory.model');
    const { WarehouseLocation } = await import('../warehouse/warehouse.models');

    // Cache warehouse lookups to avoid repeated DB hits per row
    const warehouseCache = new Map<string, string | null>();
    async function resolveWarehouseId(code: string): Promise<string | null> {
      const key = code.toUpperCase();
      if (warehouseCache.has(key)) return warehouseCache.get(key)!;
      const wh = await WarehouseLocation.findOne({ code: key }).select('_id').lean();
      const id = wh ? String(wh._id) : null;
      warehouseCache.set(key, id);
      return id;
    }

    const results = { created: 0, updated: 0, skipped: 0, errors: [] as { row: number; sku: string; error: string }[] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const sku = String(row['SKU Code'] ?? row.sku ?? row.SKU ?? '').trim();

      if (isMetaRow(sku)) { results.skipped++; continue; }

      const name = String(row['SKU Name'] ?? row.name ?? row.Name ?? '').trim();
      if (!name) { results.errors.push({ row: i + 2, sku, error: 'Missing SKU Name' }); continue; }

      try {
        const payload = normalizeRow(row);
        if (payload.price === undefined || payload.price === null) payload.price = 0;

        let productId: string;
        const existing = await Product.findOne({ sku });
        if (existing) {
          await Product.updateOne({ sku }, { $set: payload });
          productId = String(existing._id);
          results.updated++;
        } else {
          const created = await Product.create({ ...payload, sku, name, status: 'active' });
          productId = String(created._id);
          results.created++;
        }

        // Create/upsert WarehouseInventory if warehouse_code is provided
        const whCode = String(row['Warehouse Code'] ?? row.warehouse_code ?? '').trim();
        if (whCode) {
          const warehouseId = await resolveWarehouseId(whCode);
          if (warehouseId) {
            await WarehouseInventory.updateOne(
              { warehouseId, productId },
              { $setOnInsert: { warehouseId, productId, quantity: 0, reservedQty: 0, isAvailable: true, lowStockThreshold: 5 } },
              { upsert: true },
            );
          }
        }
      } catch (err) {
        results.errors.push({ row: i + 2, sku, error: (err as Error).message });
      }
    }

    res.status(200).json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

function g(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '' && row[k] !== null) return row[k];
  }
  return undefined;
}

export function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const num = (v: unknown) => (v !== '' && v !== undefined && v !== null && !Number.isNaN(Number(v)) ? Number(v) : undefined);
  const str = (v: unknown) => (v !== undefined && v !== '' && v !== null ? String(v).trim() : undefined);
  const bool = (v: unknown) => { const s = String(v ?? '').toLowerCase().trim(); return s === 'yes' || s === 'true' || s === '1' ? true : s === 'no' || s === 'false' || s === '0' ? false : undefined; };

  // Mastersheet column → Product field mapping (all 67 columns)
  const classification = str(g(row, 'SKU Classification', 'classification'));
  const normClass = classification?.toLowerCase().startsWith('var') ? 'Variant' : classification ? 'Style' : undefined;

  const keywords = str(g(row, 'Search Keywords', 'searchKeywords', 'search_keywords'));
  const keywordArr = keywords ? keywords.split(',').map((k) => k.trim()).filter(Boolean) : undefined;

  const payload: Record<string, unknown> = {
    sku: str(g(row, 'SKU Code', 'sku', 'SKU')),
    name: str(g(row, 'SKU Name', 'name', 'Name')),
    sortOrder: num(g(row, 'Priority', 'priority')),
    classification: normClass,
    subClassification: str(g(row, 'SKU Sub-Classification', 'subClassification')),
    skuSource: str(g(row, 'SKU Source', 'skuSource')),
    similarProducts: str(g(row, 'Similar Products', 'similarProducts')),
    vendorCode: str(g(row, 'Primary Vendor', 'vendorCode')),
    brandCode: str(g(row, 'Brand Code', 'brandCode')),
    brand: str(g(row, 'Brand Code', 'brand', 'Brand')),
    mfgSkuCode: str(g(row, 'Mfg SKU Code', 'mfgSkuCode')),
    size: str(g(row, 'Size', 'size')),
    uom: str(g(row, 'SKU UOM', 'uom', 'UOM')),
    colour: str(g(row, 'Colour', 'colour')),
    material: str(g(row, 'Material', 'material')),
    upcEan: str(g(row, 'Primary UPC/EAN', 'upcEan')),
    countryOfOrigin: str(g(row, 'Country Of Origin', 'countryOfOrigin')) ?? 'India',
    hierarchyCode: str(g(row, 'Hierarchy Code', 'hierarchyCode')),
    mrp: num(g(row, 'MSRP/MRP', 'mrp', 'MRP', 'MSRP')),
    price: num(g(row, 'Sale Price', 'price', 'Price')),
    baseCost: num(g(row, 'Base Cost', 'baseCost', 'base_cost')),
    hsnCode: str(g(row, 'HSN Code', 'hsnCode', 'hsn_code', 'HSN')),
    taxPercent: num(g(row, 'Tax %', 'taxPercent', 'tax_percent')),
    shippingAndReturns: str(g(row, 'Shipping & Returns', 'shippingAndReturns')),
    skuRotation: str(g(row, 'SKU Rotation', 'skuRotation')),
    rotateBy: str(g(row, 'Rotate By', 'rotateBy')),
    recvValidationCode: str(g(row, 'Receiving Validation Code', 'recvValidationCode')),
    pickingInstructions: str(g(row, 'Picking Instructions', 'pickingInstructions')),
    shippingInstructions: str(g(row, 'Shipping Instructions', 'shippingInstructions')),
    thresholdAlertRequired: bool(g(row, 'Threshold Alert Required', 'thresholdAlertRequired')),
    thresholdQty: num(g(row, 'Threshold Qty', 'thresholdQty')),
    shippingCharges: num(g(row, 'Shipping Charges', 'shippingCharges')),
    handlingCharges: num(g(row, 'Handling Charges', 'handlingCharges')),
    isArsApplicable: bool(g(row, 'Is ARS Applicable?', 'isArsApplicable')),
    followStyle: str(g(row, 'Follow Style', 'followStyle')),
    arsCalculationMethod: str(g(row, 'ARS Calculation Method', 'arsCalculationMethod')),
    fixedStock: num(g(row, 'Fixed Stock', 'fixedStock')),
    modelStock: num(g(row, 'Model Stock', 'modelStock')),
    imageUrl: (() => {
      const raw = str(g(row, 'SKUimgURL', 'imageUrl', 'image_url'));
      if (!raw) return undefined;
      return normalizeSelorgCdnUrl(raw) || raw;
    })(),
    images: (() => {
      const urls = [
        str(g(row, 'SKUimgURL', 'imageUrl', 'image_url')),
        str(g(row, 'Image URL 2', 'imageUrl2')),
        str(g(row, 'Image URL 3', 'imageUrl3')),
        str(g(row, 'Image URL 4', 'imageUrl4')),
        str(g(row, 'Image URL 5', 'imageUrl5')),
      ]
        .filter(Boolean)
        .map((u) => normalizeSelorgCdnUrl(u as string) || (u as string));
      return urls.length > 0 ? urls : undefined;
    })(),
    searchKeywords: keywordArr,
    orderLimitType: str(g(row, 'Order Limit Type', 'orderLimitType')),
    minOrderQty: num(g(row, 'Min Qty Per Order', 'minOrderQty')),
    maxOrderLimit: num(g(row, 'Max Qty Per Order', 'maxOrderLimit')),
    orderRestrictionType: str(g(row, 'Restriction Type', 'orderRestrictionType')),
  };

  // Nested: dimensions
  const wkg = num(g(row, 'Weight(kg)', 'weightKg'));
  const hcm = num(g(row, 'Height(cm)', 'heightCm'));
  const lcm = num(g(row, 'Length(cm)', 'lengthCm'));
  const wcm = num(g(row, 'Width(cm)', 'widthCm'));
  const cube = num(g(row, 'Cube', 'cube'));
  if (wkg !== undefined || hcm !== undefined || lcm !== undefined || wcm !== undefined || cube !== undefined) {
    payload['dimensions'] = { weightKg: wkg ?? 0, heightCm: hcm ?? 0, lengthCm: lcm ?? 0, widthCm: wcm ?? 0, cube: cube ?? 0 };
  }

  // Nested: description
  const about = str(g(row, 'About', 'about'));
  const nutrition = str(g(row, 'Nutrition', 'nutrition'));
  const originOfPlace = str(g(row, 'Origin of Place', 'originOfPlace'));
  const healthBenefits = str(g(row, 'Health Benefits', 'healthBenefits'));
  if (about || nutrition || originOfPlace || healthBenefits) {
    payload['description'] = { about: about ?? '', nutrition: nutrition ?? '', originOfPlace: originOfPlace ?? '', healthBenefits: healthBenefits ?? '', raw: '' };
  }

  // Nested: taxBreakup
  const sgstP = num(g(row, 'SGST %'));
  const cgstP = num(g(row, 'CGST %'));
  const igstP = num(g(row, 'IGST %'));
  const cessP = num(g(row, 'Cess %'));
  const sgstA = num(g(row, 'SGST Amount (₹)'));
  const cgstA = num(g(row, 'CGST Amount (₹)'));
  const igstA = num(g(row, 'IGST Amount (₹)'));
  const cessA = num(g(row, 'Cess Amount (₹)'));
  const priceGst = num(g(row, 'Price incl. GST (₹)'));
  if ([sgstP, cgstP, igstP, cessP, sgstA, cgstA, igstA, cessA, priceGst].some((v) => v !== undefined)) {
    payload['taxBreakup'] = {
      sgstPercent: sgstP ?? 0, cgstPercent: cgstP ?? 0, igstPercent: igstP ?? 0, cessPercent: cessP ?? 0,
      sgstAmount: sgstA ?? 0, cgstAmount: cgstA ?? 0, igstAmount: igstA ?? 0, cessAmount: cessA ?? 0, priceInclGst: priceGst ?? 0,
    };
  }

  // Extended order-limit fields (no dedicated schema field — preserved in additionalImportedFields.orderLimits)
  const maxWeightPerOrder = str(g(row, 'Max Weight Per Order', 'maxWeightPerOrder'));
  const cartLimitPerOrder = str(g(row, 'Cart Limit Per Order', 'cartLimitPerOrder'));
  const maxOrderValue = str(g(row, 'Max Order Value', 'maxOrderValue'));
  const maxCartQty = num(g(row, 'Max Cart Qty', 'maxCartQty'));
  const maxCartWeight = str(g(row, 'Max Cart Weight', 'maxCartWeight'));
  const allowMixedPack = bool(g(row, 'Allow Mixed Pack', 'allowMixedPack'));
  const orderLimits: Record<string, unknown> = {};
  if (maxWeightPerOrder !== undefined) orderLimits['maxWeightPerOrder'] = maxWeightPerOrder;
  if (cartLimitPerOrder !== undefined) orderLimits['cartLimitPerOrder'] = cartLimitPerOrder;
  if (maxOrderValue !== undefined) orderLimits['maxOrderValue'] = maxOrderValue;
  if (maxCartQty !== undefined) orderLimits['maxCartQty'] = maxCartQty;
  if (maxCartWeight !== undefined) orderLimits['maxCartWeight'] = maxCartWeight;
  if (allowMixedPack !== undefined) orderLimits['allowMixedPack'] = allowMixedPack;
  if (Object.keys(orderLimits).length > 0) payload['additionalImportedFields'] = { orderLimits };

  // Legacy short-name fallbacks (non-mastersheet uploads)
  if (payload['price'] === undefined) payload['price'] = num(g(row, 'price', 'Price'));
  if (payload['mrp'] === undefined) payload['mrp'] = num(g(row, 'mrp', 'MRP'));
  if (payload['brand'] === undefined) payload['brand'] = str(g(row, 'brand', 'Brand'));

  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== null));
}
