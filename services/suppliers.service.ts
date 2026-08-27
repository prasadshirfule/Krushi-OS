import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SupplierInput } from '@/lib/validations';
import { MOCK_SUPPLIERS } from '@/lib/mock-data';

function isPlaceholderMode() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
}

export async function getSuppliers(shopId: string, options: { search?: string, page?: number, limit?: number } = {}) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    let query = supabase.from('suppliers').select('*', { count: 'exact' }).eq('shop_id', shopId);
    
    if (options.search) {
      query = query.or(`name.ilike.%${options.search}%,company.ilike.%${options.search}%`);
    }
    
    query = query.order('name', { ascending: true });

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    
    return { suppliers: data, total: count || 0 };
  } catch (error) {
    let filtered = [...MOCK_SUPPLIERS];
    if (options.search) {
      const q = options.search.toLowerCase();
      filtered = filtered.filter(s => s.name.toLowerCase().includes(q) || s.contact_person.toLowerCase().includes(q));
    }
    return { suppliers: filtered, total: filtered.length };
  }
}

export async function getSupplierById(shopId: string, supplierId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('suppliers').select('*').eq('shop_id', shopId).eq('id', supplierId).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    return MOCK_SUPPLIERS.find(s => s.id === supplierId) || MOCK_SUPPLIERS[0];
  }
}

export async function createSupplier(shopId: string, data: SupplierInput) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data: supplier, error } = await supabase.from('suppliers').insert({ ...data, shop_id: shopId }).select().single();
    if (error) throw error;
    return supplier;
  } catch (error) {
    const newSup = { id: `sup-${Date.now()}`, ...data, outstanding_balance: 0 };
    MOCK_SUPPLIERS.push(newSup as any);
    return newSup;
  }
}

export async function updateSupplier(shopId: string, id: string, data: Partial<SupplierInput>) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data: supplier, error } = await supabase.from('suppliers').update(data).eq('shop_id', shopId).eq('id', id).select().single();
    if (error) throw error;
    return supplier;
  } catch (error) {
    const sup = MOCK_SUPPLIERS.find(s => s.id === id);
    if (sup) Object.assign(sup, data);
    return sup;
  }
}

export async function getSupplierLedger(shopId: string, supplierId: string, options: { page?: number, limit?: number } = {}) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    const { data, count, error } = await supabase.from('supplier_ledger')
      .select('*', { count: 'exact' })
      .eq('shop_id', shopId)
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
      
    if (error) throw error;
    
    const sup = await getSupplierById(shopId, supplierId);
    
    return { entries: data, total: count || 0, balance: sup?.outstanding_balance || 0 };
  } catch (error) {
    const sup = MOCK_SUPPLIERS.find(s => s.id === supplierId) || MOCK_SUPPLIERS[0];
    return {
      entries: [
        { id: 'supledg-1', type: 'PURCHASE', debit: 0, credit: sup.outstanding_balance, description: 'Inward Invoice #PUR-2026-001', created_at: new Date().toISOString() }
      ],
      total: 1,
      balance: sup.outstanding_balance
    };
  }
}

export async function addLedgerEntry(shopId: string, data: { supplierId: string, type: string, referenceId?: string, debit?: number, credit?: number, description: string, userId: string }) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data: entry, error } = await supabase.rpc('add_supplier_ledger_entry', {
      p_shop_id: shopId,
      p_supplier_id: data.supplierId,
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
    const sup = MOCK_SUPPLIERS.find(s => s.id === data.supplierId);
    if (sup) {
      if (data.debit) sup.outstanding_balance = Math.max(0, sup.outstanding_balance - data.debit);
      if (data.credit) sup.outstanding_balance += data.credit;
    }
    return { id: `supledg-${Date.now()}`, ...data };
  }
}

export async function searchSuppliers(shopId: string, queryText: string, limit = 10) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('suppliers').select('*').eq('shop_id', shopId).ilike('name', `%${queryText}%`).limit(limit);
    if (error) throw error;
    return data;
  } catch (error) {
    const q = queryText.toLowerCase();
    return MOCK_SUPPLIERS.filter(s => s.name.toLowerCase().includes(q) || s.contact_person.toLowerCase().includes(q)).slice(0, limit);
  }
}
