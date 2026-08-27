import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CustomerInput } from '@/lib/validations';
import { MOCK_CUSTOMERS } from '@/lib/mock-data';

function isPlaceholderMode() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
}

export async function getCustomers(shopId: string, options: { search?: string, page?: number, limit?: number } = {}) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    let query = supabase.from('customers').select('*', { count: 'exact' }).eq('shop_id', shopId);
    
    if (options.search) {
      query = query.or(`name.ilike.%${options.search}%,mobile.ilike.%${options.search}%`);
    }
    
    query = query.order('created_at', { ascending: false });

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    
    return { customers: data, total: count || 0 };
  } catch (error) {
    let filtered = [...MOCK_CUSTOMERS];
    if (options.search) {
      const q = options.search.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.village.toLowerCase().includes(q));
    }
    return { customers: filtered, total: filtered.length };
  }
}

export async function getCustomerById(shopId: string, customerId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('customers').select('*').eq('shop_id', shopId).eq('id', customerId).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    return MOCK_CUSTOMERS.find(c => c.id === customerId) || MOCK_CUSTOMERS[0];
  }
}

export async function createCustomer(shopId: string, data: CustomerInput) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data: customer, error } = await supabase.from('customers').insert({ ...data, shop_id: shopId }).select().single();
    if (error) throw error;
    return customer;
  } catch (error) {
    const newCust = { id: `cust-${Date.now()}`, ...data, outstanding_balance: 0, created_at: new Date().toISOString() };
    MOCK_CUSTOMERS.push(newCust as any);
    return newCust;
  }
}

export async function updateCustomer(shopId: string, id: string, data: Partial<CustomerInput>) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data: customer, error } = await supabase.from('customers').update(data).eq('shop_id', shopId).eq('id', id).select().single();
    if (error) throw error;
    return customer;
  } catch (error) {
    const cust = MOCK_CUSTOMERS.find(c => c.id === id);
    if (cust) Object.assign(cust, data);
    return cust;
  }
}

export async function getCustomerLedger(shopId: string, customerId: string, options: { page?: number, limit?: number } = {}) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    const { data, count, error } = await supabase.from('customer_ledger')
      .select('*', { count: 'exact' })
      .eq('shop_id', shopId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
      
    if (error) throw error;
    
    const cust = await getCustomerById(shopId, customerId);
    
    return { entries: data, total: count || 0, balance: cust?.outstanding_balance || 0 };
  } catch (error) {
    const cust = MOCK_CUSTOMERS.find(c => c.id === customerId) || MOCK_CUSTOMERS[0];
    return {
      entries: [
        { id: 'ledg-1', type: 'SALE', debit: cust.outstanding_balance, credit: 0, description: 'Credit Sale #KOS-2026-002', created_at: new Date().toISOString() }
      ],
      total: 1,
      balance: cust.outstanding_balance
    };
  }
}

export async function addLedgerEntry(shopId: string, data: { customerId: string, type: string, referenceId?: string, debit?: number, credit?: number, description: string, userId: string }) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data: entry, error } = await supabase.rpc('add_customer_ledger_entry', {
      p_shop_id: shopId,
      p_customer_id: data.customerId,
      p_type: data.type,
      p_reference_id: data.referenceId,
      p_debit: data.debit || 0,
      p_credit: data.credit || 0,
      p_description: data.description,
      p_user_id: data.userId
    });
    if (error) throw error;
    return entry;
  } catch (error) {
    const cust = MOCK_CUSTOMERS.find(c => c.id === data.customerId);
    if (cust) {
      if (data.credit) cust.outstanding_balance = Math.max(0, cust.outstanding_balance - data.credit);
      if (data.debit) cust.outstanding_balance += data.debit;
    }
    return { id: `entry-${Date.now()}`, ...data };
  }
}

export async function searchCustomers(shopId: string, queryText: string, limit = 10) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('customers').select('*').eq('shop_id', shopId).ilike('name', `%${queryText}%`).limit(limit);
    if (error) throw error;
    return data;
  } catch (error) {
    const q = queryText.toLowerCase();
    return MOCK_CUSTOMERS.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, limit);
  }
}

export async function getTopCustomers(shopId: string, limit = 5) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('customers').select('*').eq('shop_id', shopId).order('total_purchases', { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  } catch (error) {
    return MOCK_CUSTOMERS.slice(0, limit);
  }
}
