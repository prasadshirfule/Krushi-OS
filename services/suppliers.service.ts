import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SupplierInput } from '@/lib/validations';

export async function getSuppliers(shopId: string, options: { search?: string, page?: number, limit?: number } = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    let query = supabase.from('suppliers').select('*', { count: 'exact' }).eq('shop_id', shopId).eq('is_active', true);
    
    if (options.search) {
      query = query.or(`name.ilike.%${options.search}%,company.ilike.%${options.search}%`);
    }
    
    query = query.order('created_at', { ascending: false });

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      console.error("Error fetching suppliers:", error);
      return { suppliers: [], total: 0 };
    }
    
    return { suppliers: data || [], total: count || 0 };
  } catch (error) {
    console.error("Failed to load suppliers:", error);
    return { suppliers: [], total: 0 };
  }
}

export async function getSupplierById(shopId: string, supplierId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('suppliers').select('*').eq('shop_id', shopId).eq('id', supplierId).single();
    if (error) {
      console.error("Error fetching supplier by ID:", error);
      return null;
    }
    return data;
  } catch (error) {
    console.error("Failed to load supplier by ID:", error);
    return null;
  }
}

export async function createSupplier(shopId: string, data: SupplierInput) {
  const supabase = await createServerSupabaseClient();
  const { data: supplier, error } = await supabase.from('suppliers').insert({ ...data, shop_id: shopId }).select().single();
  if (error) {
    console.error("Error creating supplier:", error);
    throw error;
  }
  return supplier;
}

export async function updateSupplier(shopId: string, id: string, data: Partial<SupplierInput>) {
  const supabase = await createServerSupabaseClient();
  const { data: supplier, error } = await supabase.from('suppliers').update(data).eq('shop_id', shopId).eq('id', id).select().single();
  if (error) {
    console.error("Error updating supplier:", error);
    throw error;
  }
  return supplier;
}

export async function getSupplierLedger(shopId: string, supplierId: string, options: { page?: number, limit?: number } = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    const { data, count, error } = await supabase.from('supplier_ledger')
      .select('*', { count: 'exact' })
      .eq('shop_id', shopId)
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
      
    if (error) {
      console.error("Error fetching supplier ledger:", error);
      return { entries: [], total: 0, balance: 0 };
    }
    
    const sup = await getSupplierById(shopId, supplierId);
    
    return { entries: data || [], total: count || 0, balance: Number(sup?.outstanding || 0) };
  } catch (error) {
    console.error("Failed to load supplier ledger:", error);
    return { entries: [], total: 0, balance: 0 };
  }
}

export async function searchSuppliers(shopId: string, queryText: string, limit = 10) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('shop_id', shopId)
      .or(`name.ilike.%${queryText}%,company.ilike.%${queryText}%`)
      .limit(limit);

    if (error) {
      console.error("Error searching suppliers:", error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error("Failed to search suppliers:", error);
    return [];
  }
}
