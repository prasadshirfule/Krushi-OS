import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ProductInput } from '@/lib/validations';
import { MOCK_PRODUCTS, MOCK_CATEGORIES, MOCK_BRANDS } from '@/lib/mock-data';

function isPlaceholderMode() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
}

export async function getProducts(shopId: string, options: { search?: string, category?: string, page?: number, limit?: number, sortBy?: string, sortOrder?: 'asc' | 'desc' } = {}) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    let query = supabase.from('products').select('*, category:categories(*), brand:brands(*)', { count: 'exact' }).eq('shop_id', shopId).eq('is_active', true);
    
    if (options.search) query = query.ilike('name', `%${options.search}%`);
    if (options.category) query = query.eq('category_id', options.category);
    if (options.sortBy) query = query.order(options.sortBy, { ascending: options.sortOrder === 'asc' });
    else query = query.order('created_at', { ascending: false });
    
    const { data: products, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    
    return { products, total: count || 0, pages: Math.ceil((count || 0) / limit) };
  } catch (error) {
    let filtered = [...MOCK_PRODUCTS];
    if (options.search) {
      const q = options.search.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(q));
    }
    if (options.category) {
      filtered = filtered.filter(p => p.category_id === options.category);
    }
    return { products: filtered, total: filtered.length, pages: 1 };
  }
}

export async function getProductById(shopId: string, productId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('products').select('*, batches(*)').eq('shop_id', shopId).eq('id', productId).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    return MOCK_PRODUCTS.find(p => p.id === productId) || MOCK_PRODUCTS[0];
  }
}

export async function createProduct(shopId: string, data: ProductInput) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data: product, error } = await supabase.from('products').insert({ ...data, shop_id: shopId }).select().single();
    if (error) throw error;
    return product;
  } catch (error) {
    const newProduct = { id: `p-${Date.now()}`, ...data, is_active: true, shop_id: shopId };
    MOCK_PRODUCTS.push(newProduct as any);
    return newProduct;
  }
}

export async function updateProduct(shopId: string, productId: string, data: Partial<ProductInput>) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data: product, error } = await supabase.from('products').update(data).eq('shop_id', shopId).eq('id', productId).select().single();
    if (error) throw error;
    return product;
  } catch (error) {
    const p = MOCK_PRODUCTS.find(x => x.id === productId);
    if (p) Object.assign(p, data);
    return p;
  }
}

export async function deleteProduct(shopId: string, productId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('products').update({ is_active: false }).eq('shop_id', shopId).eq('id', productId);
    if (error) throw error;
  } catch (error) {
    const index = MOCK_PRODUCTS.findIndex(x => x.id === productId);
    if (index !== -1) MOCK_PRODUCTS.splice(index, 1);
  }
}

export async function getProductByBarcode(shopId: string, barcode: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('products').select('*').eq('shop_id', shopId).eq('barcode', barcode).eq('is_active', true).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    return MOCK_PRODUCTS.find(p => p.barcode === barcode) || null;
  }
}

export async function searchProducts(shopId: string, queryText: string, limit = 10) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('products').select('*').eq('shop_id', shopId).eq('is_active', true).ilike('name', `%${queryText}%`).limit(limit);
    if (error) throw error;
    return data;
  } catch (error) {
    const q = queryText.toLowerCase();
    return MOCK_PRODUCTS.filter(p => p.name.toLowerCase().includes(q) || p.barcode.includes(q)).slice(0, limit);
  }
}

export async function getLowStockProducts(shopId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc('get_low_stock_products', { p_shop_id: shopId });
    if (error) throw error;
    return data;
  } catch (error) {
    return MOCK_PRODUCTS.filter(p => p.current_stock <= p.min_stock);
  }
}

export async function getCategories(shopId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('categories').select('*, products(count)').eq('shop_id', shopId).order('name');
    if (error) throw error;
    return data.map(c => ({ ...c, count: c.products[0]?.count || 0 }));
  } catch (error) {
    return MOCK_CATEGORIES;
  }
}

export async function createCategory(shopId: string, data: any) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data: category, error } = await supabase.from('categories').insert({ ...data, shop_id: shopId }).select().single();
    if (error) throw error;
    return category;
  } catch (error) {
    const newCat = { id: `cat-${Date.now()}`, ...data, count: 0 };
    MOCK_CATEGORIES.push(newCat);
    return newCat;
  }
}

export async function updateCategory(shopId: string, id: string, data: any) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data: category, error } = await supabase.from('categories').update(data).eq('shop_id', shopId).eq('id', id).select().single();
    if (error) throw error;
    return category;
  } catch (error) {
    const cat = MOCK_CATEGORIES.find(x => x.id === id);
    if (cat) Object.assign(cat, data);
    return cat;
  }
}

export async function getBrands(shopId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('brands').select('*').eq('shop_id', shopId).order('name');
    if (error) throw error;
    return data;
  } catch (error) {
    return MOCK_BRANDS;
  }
}

export async function createBrand(shopId: string, data: any) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data: brand, error } = await supabase.from('brands').insert({ ...data, shop_id: shopId }).select().single();
    if (error) throw error;
    return brand;
  } catch (error) {
    const newBrand = { id: `b-${Date.now()}`, ...data };
    MOCK_BRANDS.push(newBrand);
    return newBrand;
  }
}
