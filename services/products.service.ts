import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CreateProductInput, UpdateProductInput, ProductWithRelations, ProductListResponse } from '@/types/products';
import { MOCK_CATEGORIES, MOCK_PRODUCTS, MOCK_BRANDS } from '@/lib/mock-data';
import { getStoredDemoProducts, saveStoredDemoProducts, getStoredDemoSales } from '@/lib/demo-storage';
import { formatDDMMYYYYtoDB } from '@/lib/validations';
import { DEFAULT_POPULAR_CATEGORIES, DEFAULT_POPULAR_BRANDS } from '@/lib/constants';

const demoBrands: Array<{ id: string; name: string; manufacturer?: string | null; shop_id: string; is_active: boolean; created_at: string }> = [];

/** Check if Supabase is running with placeholder credentials (demo mode). */
export function isPlaceholderMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
}

/** Normalize product object consistently */
export function normalizeProduct(p: any): ProductWithRelations {
  const sellingPrice = Number(p.selling_price ?? p.price ?? 0);
  const purchasePrice = Number(p.purchase_price ?? 0);
  const mrp = Number(p.mrp ?? sellingPrice);
  const stock = Number(p.current_stock ?? p.stock_quantity ?? p.stock ?? 0);
  const minStock = Number(p.min_stock ?? 5);

  let category = p.category;
  if (typeof category === 'string') {
    category = { id: p.category_id || '', name: category };
  } else if (!category && p.category_id) {
    category = { id: p.category_id, name: 'General' };
  }

  let brand = p.brand;
  if (typeof brand === 'string') {
    brand = { id: p.brand_id || '', name: brand };
  }

  return {
    ...p,
    id: String(p.id),
    name: p.name,
    category_id: p.category_id || category?.id || '',
    category: category || (p.category_id ? { id: p.category_id, name: 'General' } : null),
    brand_id: p.brand_id || brand?.id || null,
    brand: brand || null,
    sku: p.sku || '',
    barcode: p.barcode || '',
    description: p.description || '',
    unit: p.unit || 'Piece',
    hsn_code: p.hsn_code || '',
    gst_rate: Number(p.gst_rate ?? 0),
    purchase_price: purchasePrice,
    selling_price: sellingPrice,
    wholesale_price: Number(p.wholesale_price ?? sellingPrice),
    mrp: mrp,
    current_stock: stock,
    stock_quantity: stock,
    min_stock: minStock,
    is_active: p.is_active !== false,
    batches: p.batches || [],
    created_at: p.created_at || new Date().toISOString(),
    updated_at: p.updated_at || new Date().toISOString(),
  };
}

export function getDemoProducts(): ProductWithRelations[] {
  return getStoredDemoProducts(normalizeProduct);
}

/**
 * In-memory store for categories created during a demo session.
 * These persist across server-action calls within the same server process
 * but are reset on server restart — acceptable for demo/placeholder mode.
 */
const demoCategories: Array<{ id: string; name: string; description: string | null; shop_id: string; is_active: boolean; created_at: string; count: number }> = [];

export async function getProducts(
  shopId: string, 
  options: { search?: string; category?: string; page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}
): Promise<ProductListResponse> {
  if (isPlaceholderMode()) {
    const all = getDemoProducts();
    let filtered = all.filter(p => p.is_active !== false);

    if (options.search) {
      const q = options.search.replace(/[,().\\]/g, '').trim().toLowerCase();
      if (q) {
        filtered = filtered.filter(p =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.includes(q)) ||
          (p.category?.name && p.category.name.toLowerCase().includes(q))
        );
      }
    }

    if (options.category && options.category !== 'all') {
      filtered = filtered.filter(p => p.category_id === options.category || p.category?.id === options.category);
    }

    if (options.sortBy) {
      const field = options.sortBy;
      const asc = options.sortOrder === 'asc';
      filtered.sort((a: any, b: any) => {
        const valA = a[field] ?? '';
        const valB = b[field] ?? '';
        if (valA < valB) return asc ? -1 : 1;
        if (valA > valB) return asc ? 1 : -1;
        return 0;
      });
    }

    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      products: paginated,
      total: filtered.length,
      pages: Math.ceil(filtered.length / limit)
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('products')
      .select('*, category:categories(id, name), brand:brands(id, name, manufacturer), batches:product_batches(*)', { count: 'exact' })
      .eq('shop_id', shopId)
      .eq('is_active', true);
    
    if (options.search) {
      const q = options.search.replace(/[,().\\]/g, '').trim();
      if (q) {
        query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`);
      }
    }

    if (options.category) query = query.eq('category_id', options.category);
    if (options.sortBy) query = query.order(options.sortBy, { ascending: options.sortOrder === 'asc' });
    else query = query.order('created_at', { ascending: false });
    
    const { data: products, count, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      console.error("Error fetching products:", error);
      return { products: [], total: 0, pages: 0 };
    }
    
    return { products: (products as ProductWithRelations[]) || [], total: count || 0, pages: Math.ceil((count || 0) / limit) };
  } catch (error) {
    console.error("Failed to load products:", error);
    return { products: [], total: 0, pages: 0 };
  }
}

export async function getProductById(shopId: string, productId: string): Promise<ProductWithRelations | null> {
  if (isPlaceholderMode()) {
    const list = getDemoProducts();
    const found = list.find(p => p.id === productId);
    return found ? normalizeProduct(found) : null;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*), brand:brands(*), batches:product_batches(*)')
      .eq('shop_id', shopId)
      .eq('id', productId)
      .single();

    if (error) {
      console.error("Error fetching product by ID:", error);
      return null;
    }
    return data as ProductWithRelations;
  } catch (error) {
    console.error("Failed to load product by ID:", error);
    return null;
  }
}

export async function createProduct(shopId: string, data: CreateProductInput, userId?: string) {
  if (isPlaceholderMode()) {
    const all = getStoredDemoProducts(normalizeProduct);
    const productId = `prod-${Date.now()}`;
    const batchId = `batch-${Date.now()}`;

    // Find category info
    const allCats = [...MOCK_CATEGORIES, ...demoCategories];
    const cat = allCats.find(c => c.id === data.category_id) || { id: data.category_id || '', name: 'General' };

    const dbExpiry = formatDDMMYYYYtoDB(data.expiry_date) || data.expiry_date || null;
    const batchNumber = data.batch_number || `BAT-${Date.now().toString().slice(-4)}`;

    const batch = {
      id: batchId,
      product_id: productId,
      batch_number: batchNumber,
      mfg_date: data.mfd_date || new Date().toISOString().split('T')[0],
      expiry_date: dbExpiry,
      purchase_price: Number(data.purchase_price || 0),
      selling_price: Number(data.selling_price || 0),
      mrp: Number(data.selling_price || 0),
      quantity_available: Number(data.opening_stock || 0),
      is_active: true,
      shop_id: shopId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newProd: ProductWithRelations = normalizeProduct({
      id: productId,
      name: data.name,
      category_id: cat.id,
      category: { id: cat.id, name: cat.name },
      brand_id: data.brand_id || null,
      sku: data.sku || `SKU-${Date.now().toString().slice(-4)}`,
      barcode: data.barcode || '',
      description: data.description || '',
      unit: data.unit || 'Piece',
      pack_size: data.pack_size || ((data as any).product_size_value ? `${(data as any).product_size_value} ${(data as any).product_size_unit || 'KG'}` : (data.unit || '')),
      product_size_value: (data as any).product_size_value ?? null,
      product_size_unit: (data as any).product_size_unit ?? null,
      hsn_code: data.hsn_code || '',
      gst_rate: Number(data.gst_rate || 0),
      purchase_price: Number(data.purchase_price || 0),
      selling_price: Number(data.selling_price || 0),
      wholesale_price: Number(data.wholesale_price || data.selling_price || 0),
      mrp: Number(data.selling_price || 0),
      current_stock: Number(data.opening_stock || 0),
      stock_quantity: Number(data.opening_stock || 0),
      min_stock: Number(data.min_stock !== undefined && data.min_stock !== null ? data.min_stock : 5),
      is_active: true,
      batch_number: batchNumber,
      expiry_date: dbExpiry,
      batches: [batch],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });



    all.unshift(newProd);
    saveStoredDemoProducts(all);
    return { product: newProd, batch };
  }

  const supabase = await createServerSupabaseClient();
  const normalizedProductName = (data.name || '').trim().toUpperCase();
  const rawBatch = (data.batch_number || '').trim();
  const rawExpStr = (data.expiry_date || '').trim();
  const dbExpiry = rawExpStr ? (formatDDMMYYYYtoDB(rawExpStr) || rawExpStr) : null;
  const hasBatch = Boolean(rawBatch);
  const hasExpiry = Boolean(dbExpiry);

  const rpcParams = {
    p_shop_id: shopId,
    p_user_id: userId || null,
    p_category_id: data.category_id,
    p_name: normalizedProductName,
    p_selling_price: Number(data.selling_price || 0),
    p_unit: data.unit,
    p_brand_id: data.brand_id || null,
    p_sku: data.sku || null,
    p_barcode: data.barcode || null,
    p_description: data.description || null,
    p_purchase_price: Number(data.purchase_price || 0),
    p_wholesale_price: Number(data.wholesale_price || 0),
    p_gst_rate: Number(data.gst_rate || 0),
    p_hsn_code: data.hsn_code || null,
    p_min_stock: Number(data.min_stock !== undefined && data.min_stock !== null ? data.min_stock : 5),
    p_opening_stock: Number(data.opening_stock || 0),
    p_batch_tracking: hasBatch,
    p_expiry_tracking: hasExpiry,
    p_batch_number: hasBatch ? rawBatch : null,
    p_mfd_date: data.mfd_date || null,
    p_expiry_date: dbExpiry,
    p_product_type: data.product_type || null,
    p_active_ingredient: data.active_ingredient || null,
    p_formulation: data.formulation || null,
    p_crop: data.crop || null,
    p_target_pest: data.target_pest || null,
    p_pack_size: data.pack_size || null,
    p_licence_number: data.licence_number || null,
  };

  // Execute atomic PL/pgSQL function - NO DIRECT FALLBACK TO PRESERVE TRANSACTION SAFETY
  const { data: res, error } = await supabase.rpc('create_product_with_stock', rpcParams);

  if (error) {
    console.error("Atomic create_product_with_stock RPC error:", error);
    throw new Error(error.message || 'Failed to create product atomically');
  }

  return res;
}

export async function updateProduct(shopId: string, productId: string, data: UpdateProductInput) {
  if (isPlaceholderMode()) {
    const all = getStoredDemoProducts(normalizeProduct);
    const idx = all.findIndex(p => p.id === productId);
    if (idx === -1) {
      throw new Error(`Product not found with id ${productId}`);
    }
    const current = all[idx];
    let category = current.category;
    if (data.category_id && data.category_id !== current.category_id) {
      const allCats = [...MOCK_CATEGORIES, ...demoCategories];
      const foundCat = allCats.find(c => c.id === data.category_id);
      if (foundCat) category = { id: foundCat.id, name: foundCat.name };
    }
    const dbExpiry = data.expiry_date ? (formatDDMMYYYYtoDB(data.expiry_date) || data.expiry_date) : current.expiry_date;
    const batchNum = data.batch_number || current.batch_number || current.batches?.[0]?.batch_number;
    const initialStock = (data as any).opening_stock !== undefined 
      ? Number((data as any).opening_stock) 
      : ((data as any).current_stock !== undefined ? Number((data as any).current_stock) : current.current_stock);

    let updatedBatches = current.batches ? [...current.batches] : [];
    if (batchNum || dbExpiry) {
      if (updatedBatches.length > 0) {
        updatedBatches[0] = {
          ...updatedBatches[0],
          batch_number: batchNum || updatedBatches[0].batch_number,
          expiry_date: dbExpiry,
          quantity_available: initialStock,
        };
      } else if (batchNum) {
        updatedBatches = [
          {
            id: `batch-${Date.now()}`,
            product_id: productId,
            shop_id: shopId,
            batch_number: batchNum,
            expiry_date: dbExpiry,
            purchase_price: Number(data.purchase_price ?? current.purchase_price ?? 0),
            selling_price: Number(data.selling_price ?? current.selling_price ?? 0),
            quantity_available: initialStock,
          } as any
        ];
      }
    }

    const updated = normalizeProduct({
      ...current,
      ...data,
      category,
      batch_number: batchNum,
      expiry_date: dbExpiry,
      batches: updatedBatches,
      current_stock: initialStock,
      stock_quantity: initialStock,
      updated_at: new Date().toISOString(),
    });
    all[idx] = updated;
    saveStoredDemoProducts(all);
    return updated;
  }


  const supabase = await createServerSupabaseClient();

  // Explicit typed allowlist pick of product metadata fields
  const allowedFields = {
    name: data.name,
    category_id: data.category_id,
    brand_id: data.brand_id,
    description: data.description,
    sku: data.sku,
    barcode: data.barcode,
    purchase_price: data.purchase_price,
    selling_price: data.selling_price,
    wholesale_price: data.wholesale_price,
    gst_rate: data.gst_rate,
    hsn_code: data.hsn_code,
    unit: data.unit,
    min_stock: data.min_stock,
    max_stock: data.max_stock,
    batch_tracking: data.batch_tracking,
    expiry_tracking: data.expiry_tracking,
    product_type: data.product_type,
    active_ingredient: data.active_ingredient,
    formulation: data.formulation,
    crop: data.crop,
    target_pest: data.target_pest,
    pack_size: data.pack_size,
    licence_number: data.licence_number,
  };

  const cleanPayload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(allowedFields)) {
    if (value !== undefined) {
      cleanPayload[key] = value;
    }
  }

  const { data: product, error } = await supabase
    .from('products')
    .update(cleanPayload)
    .eq('shop_id', shopId)
    .eq('id', productId)
    .select()
    .single();

  if (error) {
    console.error("Error updating product metadata:", error);
    throw new Error(error.message || 'Failed to update product');
  }

  // Synchronize batch tracking information in Supabase product_batches table
  if (data.batch_number || data.expiry_date) {
    const dbExpiry = data.expiry_date ? (formatDDMMYYYYtoDB(data.expiry_date) || data.expiry_date) : null;
    const { data: existingBatch } = await supabase
      .from('product_batches')
      .select('id')
      .eq('shop_id', shopId)
      .eq('product_id', productId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingBatch?.id) {
      const batchUpdate: Record<string, any> = {};
      if (data.batch_number) batchUpdate.batch_number = data.batch_number.trim();
      if (dbExpiry) batchUpdate.expiry_date = dbExpiry;
      if (data.selling_price !== undefined) batchUpdate.selling_price = Number(data.selling_price);
      if (data.purchase_price !== undefined) batchUpdate.purchase_price = Number(data.purchase_price);
      if (Object.keys(batchUpdate).length > 0) {
        await supabase.from('product_batches').update(batchUpdate).eq('id', existingBatch.id);
      }
    } else if (data.batch_number) {
      await supabase.from('product_batches').insert({
        shop_id: shopId,
        product_id: productId,
        batch_number: data.batch_number.trim(),
        expiry_date: dbExpiry,
        purchase_price: Number(data.purchase_price || 0),
        selling_price: Number(data.selling_price || 0),
        quantity_available: Number((data as any).opening_stock || (data as any).current_stock || 0),
        is_active: true,
      });
    }
  }

  return product;
}

export async function deleteProduct(shopId: string, productId: string): Promise<void> {
  if (isPlaceholderMode()) {
    const all = getStoredDemoProducts(normalizeProduct);
    const idx = all.findIndex(p => p.id === productId);
    if (idx !== -1) {
      all[idx].is_active = false;
      saveStoredDemoProducts(all);
    }
    return;
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('shop_id', shopId)
    .eq('id', productId);

  if (error) {
    console.error("Error deleting product:", error);
    throw new Error(error.message || 'Failed to delete product');
  }
}

export async function getProductByBarcode(shopId: string, barcode: string): Promise<ProductWithRelations | null> {
  if (isPlaceholderMode()) {
    const all = getDemoProducts();
    const found = all.find(p => p.is_active !== false && p.barcode === barcode);
    return found ? normalizeProduct(found) : null;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(id, name), brand:brands(*), batches:product_batches(*)')
      .eq('shop_id', shopId)
      .eq('barcode', barcode)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error("Error fetching product by barcode:", error);
      return null;
    }
    return data as ProductWithRelations;
  } catch (error) {
    console.error("Failed to load product by barcode:", error);
    return null;
  }
}

export async function searchProducts(shopId: string, queryText: string, limit = 20): Promise<ProductWithRelations[]> {
  if (isPlaceholderMode()) {
    const cleanQuery = queryText.replace(/[,().\\]/g, '').trim().toLowerCase();
    const all = getDemoProducts();
    if (!cleanQuery) return all.filter(p => p.is_active !== false).slice(0, limit);
    const matches = all.filter(p =>
      p.is_active !== false &&
      (
        (p.name && p.name.toLowerCase().includes(cleanQuery)) ||
        (p.sku && p.sku.toLowerCase().includes(cleanQuery)) ||
        (p.barcode && p.barcode.includes(cleanQuery)) ||
        (p.category?.name && p.category.name.toLowerCase().includes(cleanQuery))
      )
    );
    return matches.slice(0, limit);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const cleanQuery = queryText.replace(/[,().\\]/g, '').trim();

    let queryBuilder = supabase
      .from('products')
      .select('*, category:categories(id, name), brand:brands(id, name, manufacturer), batches:product_batches(*)')
      .eq('shop_id', shopId)
      .eq('is_active', true);

    if (cleanQuery) {
      queryBuilder = queryBuilder.or(`name.ilike.%${cleanQuery}%,sku.ilike.%${cleanQuery}%,barcode.ilike.%${cleanQuery}%,pack_size.ilike.%${cleanQuery}%`);
    }

    const { data, error } = await queryBuilder
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error searching products by Name/SKU/Barcode:", error);
      return [];
    }
    return (data as ProductWithRelations[]) || [];
  } catch (error) {
    console.error("Failed to search products:", error);
    return [];
  }
}

export async function getCategories(shopId: string) {
  if (isPlaceholderMode()) {
    // Return seed mock categories + any created during this demo session
    return [...MOCK_CATEGORIES, ...demoCategories].sort((a, b) => a.name.localeCompare(b.name));
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('categories')
      .select('*, products(count)')
      .eq('shop_id', shopId)
      .order('name');

    if (error) {
      console.error("Error fetching categories:", error);
      return [];
    }

    // If shop has no categories in database, auto-seed popular categories with real UUIDs
    if (!data || data.length === 0) {
      try {
        const toInsert = DEFAULT_POPULAR_CATEGORIES.map(c => ({
          shop_id: shopId,
          name: c.name.toUpperCase(),
          description: c.description,
          is_active: true,
        }));
        const { data: inserted } = await supabase
          .from('categories')
          .insert(toInsert)
          .select('*, products(count)');
        if (inserted && inserted.length > 0) {
          return inserted.map(c => ({ ...c, count: 0 }));
        }
      } catch (seedErr) {
        console.warn("Could not auto-seed categories:", seedErr);
      }
    }

    return (data || []).map(c => ({ ...c, count: c.products?.[0]?.count || 0 }));
  } catch (error) {
    console.error("Failed to load categories:", error);
    return [];
  }
}

export async function createCategory(shopId: string, data: { name: string; description?: string | null }) {
  const normName = data.name.trim().toUpperCase();
  if (isPlaceholderMode()) {
    // Check for duplicate name in demo data
    const allDemo = [...MOCK_CATEGORIES, ...demoCategories];
    if (allDemo.some(c => c.name.toLowerCase() === normName.toLowerCase())) {
      throw new Error(`Category "${normName}" already exists`);
    }

    const newCategory = {
      id: `cat-demo-${Date.now()}`,
      name: normName,
      description: data.description || null,
      shop_id: shopId,
      is_active: true,
      created_at: new Date().toISOString(),
      count: 0,
    };
    demoCategories.push(newCategory);
    return newCategory;
  }

    const supabase = await createServerSupabaseClient();
    const { data: category, error } = await supabase
    .from('categories')
    .insert({ ...data, name: normName, shop_id: shopId })
    .select()
    .single();

  if (error) {
    console.error("Error creating category:", error);
    throw new Error(error.message || 'Failed to create category');
  }
  return category;
}

export async function getCategoryById(shopId: string, id: string) {
  if (isPlaceholderMode()) {
    const all = [...MOCK_CATEGORIES, ...demoCategories];
    return all.find(c => String(c.id) === String(id)) || null;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('shop_id', shopId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching category by id:", error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("Failed to load category:", err);
    return null;
  }
}

export async function updateCategory(shopId: string, id: string, data: { name: string; description?: string | null }) {
  const supabase = await createServerSupabaseClient();
  const payload = {
    ...data,
    name: data.name !== undefined ? data.name.trim().toUpperCase() : undefined,
  };
  const { data: category, error } = await supabase
    .from('categories')
    .update(payload)
    .eq('shop_id', shopId)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("Error updating category:", error);
    throw new Error(error.message || 'Failed to update category');
  }
  return category;
}

export async function getBrands(shopId: string) {
  if (isPlaceholderMode()) {
    const all = [...MOCK_BRANDS, ...demoBrands];
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('shop_id', shopId)
      .order('name');

    if (error) {
      console.error("Error fetching brands:", error);
      return [];
    }

    // If shop has no brands in database, auto-seed popular manufacturers with real UUIDs
    if (!data || data.length === 0) {
      try {
        const toInsert = DEFAULT_POPULAR_BRANDS.map(b => ({
          shop_id: shopId,
          name: b.name.toUpperCase(),
          manufacturer: b.manufacturer.toUpperCase(),
          is_active: true,
        }));
        const { data: inserted } = await supabase
          .from('brands')
          .insert(toInsert)
          .select('*');
        if (inserted && inserted.length > 0) {
          return inserted;
        }
      } catch (seedErr) {
        console.warn("Could not auto-seed brands:", seedErr);
      }
    }

    return data || [];
  } catch (error) {
    console.error("Failed to load brands:", error);
    return [];
  }
}

/**
 * Fetches the most recently sold / used products for a shop (limit 4).
 * Used by Billing product selector to show fast relevant options before searching.
 */
export async function getRecentBillingProducts(shopId: string, limit: number = 4): Promise<ProductWithRelations[]> {
  if (isPlaceholderMode()) {
    try {
      const demoSales = getStoredDemoSales((s: any) => s);
      const allDemo = getStoredDemoProducts((p: any) => p);
      const usedIds = new Set<string>();
      const orderedProds: any[] = [];

      for (const s of demoSales) {
        const items = s.items || s.sale_items || [];
        for (const it of items) {
          const pid = String(it.product_id || it.id);
          if (pid && !usedIds.has(pid)) {
            usedIds.add(pid);
            const found = allDemo.find((p: any) => String(p.id) === pid);
            if (found && found.is_active !== false) {
              orderedProds.push(found);
            }
          }
          if (orderedProds.length >= limit) break;
        }
        if (orderedProds.length >= limit) break;
      }

      // If fewer than limit, supplement with active demo products
      if (orderedProds.length < limit) {
        for (const p of allDemo) {
          if (p.is_active !== false && !usedIds.has(String(p.id))) {
            orderedProds.push(p);
            usedIds.add(String(p.id));
          }
          if (orderedProds.length >= limit) break;
        }
      }

      return orderedProds.map(normalizeProduct);
    } catch (err) {
      console.warn("Error getting recent demo billing products:", err);
      return [];
    }
  }

  try {
    const supabase = await createServerSupabaseClient();
    
    // 1. Fetch recent sale items for this shop
    const { data: recentItems } = await supabase
      .from('sale_items')
      .select('product_id, created_at')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(100);

    const recentProductIds: string[] = [];
    const seen = new Set<string>();

    if (Array.isArray(recentItems)) {
      for (const item of recentItems) {
        if (item.product_id && !seen.has(item.product_id)) {
          seen.add(item.product_id);
          recentProductIds.push(item.product_id);
          if (recentProductIds.length >= limit) break;
        }
      }
    }

    let products: any[] = [];

    if (recentProductIds.length > 0) {
      const { data: prodData } = await supabase
        .from('products')
        .select('*, category:categories(id, name), brand:brands(id, name, manufacturer), batches:product_batches(*)')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .in('id', recentProductIds);

      if (Array.isArray(prodData)) {
        // Preserve recency order
        const map = new Map<string, any>(prodData.map(p => [p.id, p]));
        for (const id of recentProductIds) {
          const p = map.get(id);
          if (p) products.push(p);
        }
      }
    }

    // 2. If fewer than limit, supplement with recently added/updated active products
    if (products.length < limit) {
      const remainingNeeded = limit - products.length;
      let query = supabase
        .from('products')
        .select('*, category:categories(id, name), brand:brands(id, name, manufacturer), batches:product_batches(*)')
        .eq('shop_id', shopId)
        .eq('is_active', true);

      if (seen.size > 0) {
        query = query.not('id', 'in', `(${Array.from(seen).join(',')})`);
      }

      const { data: fallbackProds } = await query
        .order('created_at', { ascending: false })
        .limit(remainingNeeded);

      if (Array.isArray(fallbackProds)) {
        products = [...products, ...fallbackProds];
      }
    }

    return (products as ProductWithRelations[]) || [];
  } catch (error) {
    console.error("Failed to load recent billing products:", error);
    return [];
  }
}

export async function createBrand(shopId: string, data: { name: string; manufacturer?: string | null }) {
  const normName = data.name.trim().toUpperCase();
  const normMfg = data.manufacturer ? data.manufacturer.trim().toUpperCase() : normName;

  if (isPlaceholderMode()) {
    const all = [...MOCK_BRANDS, ...demoBrands];
    const existing = all.find(b => b.name.toLowerCase() === normName.toLowerCase());
    if (existing) {
      return existing;
    }
    const newBrand = {
      id: `b-demo-${Date.now()}`,
      name: normName,
      manufacturer: normMfg,
      shop_id: shopId,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    demoBrands.push(newBrand);
    return newBrand;
  }

  const supabase = await createServerSupabaseClient();
  const { data: brand, error } = await supabase
    .from('brands')
    .insert({ ...data, name: normName, manufacturer: normMfg, shop_id: shopId })
    .select()
    .single();

  if (error) {
    console.error("Error creating brand:", error);
    throw new Error(error.message || 'Failed to create brand');
  }
  return brand;
}
