import { createServerSupabaseClient } from '@/lib/supabase/server';
import { BatchInput, StockAdjustmentInput } from '@/lib/validations';
import { isPlaceholderMode, getDemoProducts } from '@/services/products.service';

export async function getInventoryOverview(shopId: string, options: { search?: string, categoryId?: string, expiryStatus?: string, page?: number, limit?: number } = {}) {
  if (isPlaceholderMode()) {
    const products = getDemoProducts().filter(p => p.is_active !== false);
    let filtered = products;

    if (options.categoryId) {
      filtered = filtered.filter(p => p.category_id === options.categoryId || p.category?.id === options.categoryId);
    }
    if (options.search) {
      const q = options.search.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)));
    }

    const items = filtered.map((p: any) => {
      const currentStock = Number(p.current_stock || 0);
      const purchasePrice = Number(p.purchase_price || 0);
      const minStock = Number(p.min_stock || 0);
      const value = currentStock * purchasePrice;
      const isLowStock = currentStock <= minStock;

      return {
        ...p,
        sku: p.sku || 'N/A',
        total_stock: currentStock,
        min_stock: minStock,
        unit: p.unit || 'Piece',
        inventory_value: value,
        is_low_stock: isLowStock,
        status: isLowStock ? (currentStock === 0 ? 'Out of Stock' : 'Low Stock') : 'In Stock'
      };
    });

    const totalValue = items.reduce((sum, item) => sum + item.inventory_value, 0);
    const lowStockCount = items.filter(item => item.is_low_stock).length;

    return {
      items,
      total: items.length,
      summary: {
        totalValue,
        totalItems: items.length,
        lowStockCount
      }
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const limit = options.limit || 50;
    const page = options.page || 1;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('products')
      .select('*, category:categories(id, name), batches:product_batches(*)', { count: 'exact' })
      .eq('shop_id', shopId);
    
    if (options.categoryId) query = query.eq('category_id', options.categoryId);
    if (options.search) query = query.ilike('name', `%${options.search}%`);
    
    query = query.order('name', { ascending: true });

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      console.error("Error fetching inventory overview:", error);
      return { items: [], total: 0, summary: { totalValue: 0, totalItems: 0, lowStockCount: 0 } };
    }

    const items = (data || []).map((p: any) => {
      const currentStock = Number(p.current_stock || 0);
      const purchasePrice = Number(p.purchase_price || 0);
      const minStock = Number(p.min_stock || 0);
      const value = currentStock * purchasePrice;
      const isLowStock = currentStock <= minStock;
      
      return {
        ...p,
        sku: p.sku || 'N/A',
        total_stock: currentStock,
        min_stock: minStock,
        unit: p.unit || 'Piece',
        inventory_value: value,
        is_low_stock: isLowStock,
        status: isLowStock ? (currentStock === 0 ? 'Out of Stock' : 'Low Stock') : 'In Stock'
      };
    });

    const totalValue = items.reduce((sum, item) => sum + item.inventory_value, 0);
    const lowStockCount = items.filter(item => item.is_low_stock).length;

    return { 
      items, 
      total: count || 0,
      summary: {
        totalValue,
        totalItems: count || 0,
        lowStockCount
      }
    };
  } catch (error) {
    console.error("Failed to load inventory overview:", error);
    return { items: [], total: 0, summary: { totalValue: 0, totalItems: 0, lowStockCount: 0 } };
  }
}

export async function getLowStockProducts(shopId: string) {
  if (isPlaceholderMode()) {
    const products = getDemoProducts().filter(p => p.is_active !== false);
    return products.filter((p: any) => Number(p.current_stock || 0) <= Number(p.min_stock || 5));
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(name)')
      .eq('shop_id', shopId)
      .eq('is_active', true);

    if (error || !data) return [];
    return data.filter((p: any) => Number(p.current_stock || 0) <= Number(p.min_stock || 5));
  } catch (error) {
    console.error("Error fetching low stock products:", error);
    return [];
  }
}

export async function getBatchesForProduct(shopId: string, productId: string) {
  if (isPlaceholderMode()) {
    const products = getDemoProducts();
    const found = products.find(p => p.id === productId);
    return found?.batches || [];
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('product_batches')
      .select('*')
      .eq('shop_id', shopId)
      .eq('product_id', productId)
      .order('expiry_date', { ascending: true });

    if (error) {
      console.error("Error fetching batches for product:", error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error("Failed to load batches:", error);
    return [];
  }
}

export async function createBatch(shopId: string, data: BatchInput, userId?: string) {
  const supabase = await createServerSupabaseClient();
  
  // Create batch shell with initial quantity_available = 0
  const { data: batch, error } = await supabase
    .from('product_batches')
    .insert({ 
      ...data, 
      shop_id: shopId, 
      quantity_available: 0 
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating batch shell:", error);
    throw error;
  }

  // Route opening quantity through Central Stock Movement Engine
  if (data.quantity_received && data.quantity_received > 0) {
    const { error: stockErr } = await supabase.rpc('process_stock_movement', {
      p_shop_id: shopId,
      p_product_id: data.product_id,
      p_batch_id: batch.id,
      p_transaction_type: 'OPENING_STOCK',
      p_quantity_change: data.quantity_received,
      p_reason: 'Manual Batch Initialization',
      p_reference_type: 'BATCH_CREATE',
      p_reference_id: batch.id,
      p_user_id: userId || null
    });

    if (stockErr) {
      console.error("Failed to process stock movement for batch creation:", stockErr);
      throw stockErr;
    }
  }

  return batch;
}

export async function adjustStock(shopId: string, data: StockAdjustmentInput, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: result, error } = await supabase.rpc('adjust_stock', {
    p_shop_id: shopId,
    p_product_id: data.product_id,
    p_batch_id: data.batch_id || null,
    p_type: data.adjustment_type,
    p_quantity: data.quantity_change,
    p_reason: data.reason || 'Inventory Adjustment',
    p_user_id: userId
  });

  if (error) {
    console.error("Error adjusting stock:", error);
    throw error;
  }
  return result;
}

export async function getStockTransactions(shopId: string, options: { productId?: string, batchId?: string, type?: string, page?: number, limit?: number } = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('stock_transactions')
      .select('*, product:products(id, name, sku)', { count: 'exact' })
      .eq('shop_id', shopId);
    
    if (options.productId) query = query.eq('product_id', options.productId);
    if (options.batchId) query = query.eq('batch_id', options.batchId);
    if (options.type) query = query.eq('transaction_type', options.type);

    query = query.order('created_at', { ascending: false });

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      console.error("Error fetching stock transactions:", error);
      return { transactions: [], total: 0 };
    }
    
    return { transactions: data || [], total: count || 0 };
  } catch (error) {
    console.error("Failed to load stock transactions:", error);
    return { transactions: [], total: 0 };
  }
}

export async function getExpiringProducts(shopId: string, daysThreshold = 90) {
  try {
    const supabase = await createServerSupabaseClient();
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysThreshold);

    const { data, error } = await supabase
      .from('product_batches')
      .select('*, product:products(id, name, sku, unit)')
      .eq('shop_id', shopId)
      .gt('quantity_available', 0)
      .lte('expiry_date', targetDate.toISOString().split('T')[0])
      .order('expiry_date', { ascending: true });

    if (error) {
      console.error("Error fetching expiring batches:", error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error("Failed to load expiring batches:", error);
    return [];
  }
}

export async function getExpiredProducts(shopId: string) {
  return getExpiringProducts(shopId, 0);
}
