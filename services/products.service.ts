import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CreateProductInput, UpdateProductInput, ProductWithRelations, ProductListResponse } from '@/types/products';
import { MOCK_CATEGORIES, MOCK_PRODUCTS, MOCK_BRANDS } from '@/lib/mock-data';
import { getStoredDemoProducts, saveStoredDemoProducts } from '@/lib/demo-storage';

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
    category = { id: p.category_id || 'cat-1', name: category };
  } else if (!category && p.category_id) {
    category = { id: p.category_id, name: 'General' };
  }

  let brand = p.brand;
  if (typeof brand === 'string') {
    brand = { id: p.brand_id || 'brand-1', name: brand };
  }

  return {
    ...p,
    id: String(p.id),
    name: p.name,
    category_id: p.category_id || category?.id || 'cat-1',
    category: category || { id: 'cat-1', name: 'General' },
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
      .select('*, category:categories(id, name), brand:brands(id, name)', { count: 'exact' })
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
    const cat = allCats.find(c => c.id === data.category_id) || { id: data.category_id || 'cat-1', name: 'General' };

    const batch = {
      id: batchId,
      product_id: productId,
      batch_number: data.batch_number || `BAT-${Date.now().toString().slice(-4)}`,
      mfg_date: data.mfd_date || new Date().toISOString().split('T')[0],
      expiry_date: data.expiry_date || null,
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
      hsn_code: data.hsn_code || '',
      gst_rate: Number(data.gst_rate || 0),
      purchase_price: Number(data.purchase_price || 0),
      selling_price: Number(data.selling_price || 0),
      wholesale_price: Number(data.wholesale_price || data.selling_price || 0),
      mrp: Number(data.selling_price || 0),
      current_stock: Number(data.opening_stock || 0),
      stock_quantity: Number(data.opening_stock || 0),
      min_stock: Number(data.min_stock || 5),
      is_active: true,
      batches: [batch],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    all.unshift(newProd);
    saveStoredDemoProducts(all);
    return { product: newProd, batch };
  }

  const supabase = await createServerSupabaseClient();

  const rpcParams = {
    p_shop_id: shopId,
    p_user_id: userId || null,
    p_category_id: data.category_id,
    p_name: data.name,
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
    p_min_stock: Number(data.min_stock || 0),
    p_opening_stock: Number(data.opening_stock || 0),
    p_batch_tracking: Boolean(data.batch_tracking),
    p_expiry_tracking: Boolean(data.expiry_tracking),
    p_batch_number: data.batch_number || null,
    p_mfd_date: data.mfd_date || null,
    p_expiry_date: data.expiry_date || null,
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
    const updated = normalizeProduct({
      ...current,
      ...data,
      category,
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
      .select('*')
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
    if (!cleanQuery) return [];
    const all = getDemoProducts();
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
    if (!cleanQuery) return [];

    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(id, name), batches:product_batches(*)')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .or(`name.ilike.%${cleanQuery}%,sku.ilike.%${cleanQuery}%,barcode.ilike.%${cleanQuery}%`)
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
    return (data || []).map(c => ({ ...c, count: c.products?.[0]?.count || 0 }));
  } catch (error) {
    console.error("Failed to load categories:", error);
    return [];
  }
}

export async function createCategory(shopId: string, data: { name: string; description?: string | null }) {
  if (isPlaceholderMode()) {
    // Check for duplicate name in demo data
    const allDemo = [...MOCK_CATEGORIES, ...demoCategories];
    if (allDemo.some(c => c.name.toLowerCase() === data.name.toLowerCase())) {
      throw new Error(`Category "${data.name}" already exists`);
    }

    const newCategory = {
      id: `cat-demo-${Date.now()}`,
      name: data.name,
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
    .insert({ ...data, shop_id: shopId })
    .select()
    .single();

  if (error) {
    console.error("Error creating category:", error);
    throw new Error(error.message || 'Failed to create category');
  }
  return category;
}

export async function updateCategory(shopId: string, id: string, data: { name: string; description?: string | null }) {
  const supabase = await createServerSupabaseClient();
  const { data: category, error } = await supabase
    .from('categories')
    .update(data)
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
    return data || [];
  } catch (error) {
    console.error("Failed to load brands:", error);
    return [];
  }
}

export async function createBrand(shopId: string, data: { name: string; manufacturer?: string | null }) {
  if (isPlaceholderMode()) {
    const all = [...MOCK_BRANDS, ...demoBrands];
    const existing = all.find(b => b.name.toLowerCase() === data.name.trim().toLowerCase());
    if (existing) {
      return existing;
    }
    const newBrand = {
      id: `b-demo-${Date.now()}`,
      name: data.name.trim(),
      manufacturer: data.manufacturer?.trim() || null,
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
    .insert({ ...data, shop_id: shopId })
    .select()
    .single();

  if (error) {
    console.error("Error creating brand:", error);
    throw new Error(error.message || 'Failed to create brand');
  }
  return brand;
}
