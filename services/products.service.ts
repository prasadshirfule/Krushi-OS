import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ProductInput } from '@/lib/validations';

export async function getProducts(shopId: string, options: { search?: string, category?: string, page?: number, limit?: number, sortBy?: string, sortOrder?: 'asc' | 'desc' } = {}) {
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
    
    if (options.search) query = query.ilike('name', `%${options.search}%`);
    if (options.category) query = query.eq('category_id', options.category);
    if (options.sortBy) query = query.order(options.sortBy, { ascending: options.sortOrder === 'asc' });
    else query = query.order('created_at', { ascending: false });
    
    const { data: products, count, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      console.error("Error fetching products:", error);
      return { products: [], total: 0, pages: 0 };
    }
    
    return { products: products || [], total: count || 0, pages: Math.ceil((count || 0) / limit) };
  } catch (error) {
    console.error("Failed to load products:", error);
    return { products: [], total: 0, pages: 0 };
  }
}

export async function getProductById(shopId: string, productId: string) {
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
    return data;
  } catch (error) {
    console.error("Failed to load product by ID:", error);
    return null;
  }
}

export async function createProduct(shopId: string, data: any) {
  const supabase = await createServerSupabaseClient();
  const {
    opening_stock,
    batch_tracking,
    expiry_tracking,
    batch_number,
    mfd_date,
    expiry_date,
    ...productFields
  } = data;

  const initialStock = Number(opening_stock || 0);

  // 1. Create Product
  const { data: product, error } = await supabase
    .from('products')
    .insert({
      ...productFields,
      shop_id: shopId,
      current_stock: initialStock,
      batch_tracking: Boolean(batch_tracking),
      expiry_tracking: Boolean(expiry_tracking)
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating product:", error);
    throw error;
  }

  // 2. Handle Opening Stock (Flow A & Flow B)
  if (initialStock > 0 && product) {
    const batchNum = batch_number || `BATCH-${Date.now().toString().slice(-6)}`;
    const expDate = expiry_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Insert Batch
    const { data: batch } = await supabase
      .from('product_batches')
      .insert({
        shop_id: shopId,
        product_id: product.id,
        batch_number: batchNum,
        manufacturing_date: mfd_date || null,
        expiry_date: expDate,
        purchase_price: product.purchase_price || 0,
        selling_price: product.selling_price || 0,
        quantity_received: initialStock,
        quantity_available: initialStock
      })
      .select()
      .single();

    // Insert Stock Transaction
    await supabase
      .from('stock_transactions')
      .insert({
        shop_id: shopId,
        product_id: product.id,
        batch_id: batch?.id || null,
        transaction_type: 'PURCHASE_IN',
        previous_quantity: 0,
        quantity_change: initialStock,
        new_quantity: initialStock,
        reason: 'Opening Stock Initialization'
      });
  }

  return product;
}

export async function updateProduct(shopId: string, productId: string, data: Partial<ProductInput>) {
  const supabase = await createServerSupabaseClient();
  const { data: product, error } = await supabase
    .from('products')
    .update(data)
    .eq('shop_id', shopId)
    .eq('id', productId)
    .select()
    .single();
  if (error) {
    console.error("Error updating product:", error);
    throw error;
  }
  return product;
}

export async function deleteProduct(shopId: string, productId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('shop_id', shopId)
    .eq('id', productId);
  if (error) {
    console.error("Error deleting product:", error);
    throw error;
  }
}

export async function getProductByBarcode(shopId: string, barcode: string) {
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
    return data;
  } catch (error) {
    console.error("Failed to load product by barcode:", error);
    return null;
  }
}

export async function searchProducts(shopId: string, queryText: string, limit = 10) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .ilike('name', `%${queryText}%`)
      .limit(limit);
    if (error) {
      console.error("Error searching products:", error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error("Failed to search products:", error);
    return [];
  }
}

export async function getCategories(shopId: string) {
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

export async function createCategory(shopId: string, data: any) {
  const supabase = await createServerSupabaseClient();
  const { data: category, error } = await supabase
    .from('categories')
    .insert({ ...data, shop_id: shopId })
    .select()
    .single();
  if (error) {
    console.error("Error creating category:", error);
    throw error;
  }
  return category;
}

export async function updateCategory(shopId: string, id: string, data: any) {
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
    throw error;
  }
  return category;
}

export async function getBrands(shopId: string) {
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

export async function createBrand(shopId: string, data: any) {
  const supabase = await createServerSupabaseClient();
  const { data: brand, error } = await supabase
    .from('brands')
    .insert({ ...data, shop_id: shopId })
    .select()
    .single();
  if (error) {
    console.error("Error creating brand:", error);
    throw error;
  }
  return brand;
}
