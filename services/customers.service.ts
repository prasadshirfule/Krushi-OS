import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CustomerInput } from '@/lib/validations';

export async function getCustomers(shopId: string, options: { search?: string, page?: number, limit?: number } = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    let query = supabase.from('customers').select('*', { count: 'exact' }).eq('shop_id', shopId);
    
    if (options.search) {
      query = query.or(`name.ilike.%${options.search}%,mobile.ilike.%${options.search}%`);
    }
    
    query = query.order('created_at', { ascending: false });

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      console.error("Error fetching customers:", error);
      return { customers: [], total: 0 };
    }
    
    return { customers: data || [], total: count || 0 };
  } catch (error) {
    console.error("Failed to load customers:", error);
    return { customers: [], total: 0 };
  }
}

export async function getCustomerById(shopId: string, customerId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('customers').select('*').eq('shop_id', shopId).eq('id', customerId).single();
    if (error) {
      console.error("Error fetching customer by ID:", error);
      return null;
    }
    return data;
  } catch (error) {
    console.error("Failed to load customer by ID:", error);
    return null;
  }
}

export async function createCustomer(shopId: string, data: CustomerInput) {
  const supabase = await createServerSupabaseClient();
  const { data: customer, error } = await supabase.from('customers').insert({ ...data, shop_id: shopId }).select().single();
  if (error) {
    console.error("Error creating customer:", error);
    throw error;
  }
  return customer;
}

export async function updateCustomer(shopId: string, id: string, data: Partial<CustomerInput>) {
  const supabase = await createServerSupabaseClient();
  const { data: customer, error } = await supabase.from('customers').update(data).eq('shop_id', shopId).eq('id', id).select().single();
  if (error) {
    console.error("Error updating customer:", error);
    throw error;
  }
  return customer;
}

export async function getCustomerLedger(shopId: string, customerId: string, options: { page?: number, limit?: number } = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    const { data, count, error } = await supabase.from('customer_ledger')
      .select('*', { count: 'exact' })
      .eq('shop_id', shopId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
      
    if (error) {
      console.error("Error fetching customer ledger:", error);
      return { entries: [], total: 0, balance: 0 };
    }
    
    const cust = await getCustomerById(shopId, customerId);
    
    return { entries: data || [], total: count || 0, balance: Number(cust?.outstanding || 0) };
  } catch (error) {
    console.error("Failed to load customer ledger:", error);
    return { entries: [], total: 0, balance: 0 };
  }
}

export async function getCustomerSummary(shopId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('customers')
      .select('is_active, outstanding')
      .eq('shop_id', shopId);

    if (error || !data) {
      return { totalCustomers: 0, activeCustomers: 0, totalOutstandingCredit: 0 };
    }

    const totalCustomers = data.length;
    const activeCustomers = data.filter(c => c.is_active !== false).length;
    const totalOutstandingCredit = data.reduce((sum, c) => sum + Number(c.outstanding || 0), 0);

    return { totalCustomers, activeCustomers, totalOutstandingCredit };
  } catch (error) {
    console.error("Error fetching customer summary:", error);
    return { totalCustomers: 0, activeCustomers: 0, totalOutstandingCredit: 0 };
  }
}

export async function searchCustomers(shopId: string, queryText: string, limit = 10) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
      .or(`name.ilike.%${queryText}%,mobile.ilike.%${queryText}%`)
      .limit(limit);

    if (error) {
      console.error("Error searching customers:", error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error("Failed to search customers:", error);
    return [];
  }
}
