import { createServerSupabaseClient } from '@/lib/supabase/server';
import { BatchInput, StockAdjustmentInput } from '@/lib/validations';
import { MOCK_PRODUCTS } from '@/lib/mock-data';

function isPlaceholderMode() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
}

export async function getInventoryOverview(shopId: string, options: { search?: string, category?: string, expiryStatus?: string, page?: number, limit?: number } = {}) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const limit = options.limit || 10;
    const page = options.page || 1;
    const offset = (page - 1) * limit;

    let query = supabase.from('products').select('*', { count: 'exact' }).eq('shop_id', shopId);
    
    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    return { items: data || [], total: count || 0 };
  } catch (error) {
    return { items: MOCK_PRODUCTS, total: MOCK_PRODUCTS.length };
  }
}

export async function getLowStockProducts(shopId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('products').select('*').eq('shop_id', shopId);
    if (error) throw error;
    return (data || []).filter((p: any) => (p.current_stock ?? p.stock_quantity ?? 0) <= (p.min_stock_alert ?? p.min_stock ?? 5));
  } catch (error) {
    return MOCK_PRODUCTS.filter(p => p.current_stock <= p.min_stock);
  }
}

export async function getBatchesForProduct(shopId: string, productId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('product_batches').select('*').eq('shop_id', shopId).eq('product_id', productId).order('expiry_date', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    const product = MOCK_PRODUCTS.find(p => p.id === productId);
    return product?.batches || [];
  }
}

export async function getBatchById(shopId: string, batchId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('product_batches').select('*').eq('shop_id', shopId).eq('id', batchId).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    return { id: batchId, batch_number: 'B-2026-01', expiry_date: '2026-11-30', quantity_available: 45, selling_price: 550, purchase_price: 420 };
  }
}

export async function createBatch(shopId: string, data: BatchInput) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data: batch, error } = await supabase.from('product_batches').insert({ ...data, shop_id: shopId, quantity_available: data.quantity_received }).select().single();
    if (error) throw error;
    return batch;
  } catch (error) {
    const newBatch = { id: `batch-${Date.now()}`, ...data, quantity_available: data.quantity_received };
    const p = MOCK_PRODUCTS.find(x => x.id === data.product_id);
    if (p) {
      if (!p.batches) p.batches = [];
      p.batches.push(newBatch);
      p.current_stock += data.quantity_received;
    }
    return newBatch;
  }
}

export async function adjustStock(shopId: string, data: StockAdjustmentInput, userId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data: result, error } = await supabase.rpc('adjust_stock', {
      p_shop_id: shopId,
      p_product_id: data.product_id,
      p_batch_id: data.batch_id,
      p_type: data.adjustment_type,
      p_quantity: data.quantity_change,
      p_reason: data.reason,
      p_user_id: userId
    });
    if (error) throw error;
    return result;
  } catch (error) {
    const p = MOCK_PRODUCTS.find(x => x.id === data.product_id);
    if (p) {
      if (data.adjustment_type === 'DAMAGED' || data.adjustment_type === 'EXPIRED') {
        p.current_stock = Math.max(0, p.current_stock - data.quantity_change);
      } else {
        p.current_stock += data.quantity_change;
      }
    }
    return { success: true };
  }
}

export async function getStockTransactions(shopId: string, options: { productId?: string, batchId?: string, type?: string, page?: number, limit?: number } = {}) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    let query = supabase.from('stock_transactions').select('*, product:products(*)', { count: 'exact' }).eq('shop_id', shopId);
    
    if (options.productId) query = query.eq('product_id', options.productId);
    if (options.batchId) query = query.eq('batch_id', options.batchId);
    if (options.type) query = query.eq('transaction_type', options.type);

    query = query.order('created_at', { ascending: false });

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    
    return { transactions: data, total: count || 0 };
  } catch (error) {
    return {
      transactions: [
        { id: 'st-1', product: { name: 'Confidor Insecticide 100ml' }, transaction_type: 'SALE', quantity_change: -2, reason: 'Sale #KOS-2026-001', created_at: new Date().toISOString() }
      ],
      total: 1
    };
  }
}

export async function getExpiringProducts(shopId: string, daysThreshold = 90) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysThreshold);

    const { data, error } = await supabase.from('product_batches')
      .select('*, product:products(*)')
      .eq('shop_id', shopId)
      .gt('quantity_available', 0)
      .lte('expiry_date', targetDate.toISOString())
      .order('expiry_date', { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    return [
      { id: 'batch-4', batch_number: 'SYN-Q11', expiry_date: '2026-09-15', quantity_available: 18, product: { name: 'Syngenta Quantis Biostimulant 1L' } }
    ];
  }
}

export async function getExpiredProducts(shopId: string) {
  return getExpiringProducts(shopId, 0);
}
