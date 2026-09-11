import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CustomerInput } from '@/lib/validations';
import { MOCK_CUSTOMERS } from '@/lib/mock-data';
import { getStoredDemoCustomers, saveStoredDemoCustomers } from '@/lib/demo-storage';

/** Check if Supabase is running with placeholder credentials (demo mode). */
export function isPlaceholderMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
}

export function normalizeCustomer(c: any) {
  if (!c) return null;
  const phone = c.phone || c.mobile || '';
  const mobile = c.mobile || c.phone || '';
  const outstanding = Number(c.outstanding ?? c.outstanding_balance ?? 0);
  const creditLimit = Number(c.credit_limit ?? c.creditLimit ?? 50000);
  const totalPurchases = Number(c.total_purchases ?? c.totalPurchases ?? 0);
  const farmSize = c.farm_size || c.farmSize || (c.land_acres ? `${c.land_acres} Acres` : '');
  const crops = c.crops || c.crop_details || '';

  // Extract Aadhaar from column or notes if stored there
  let aadhaar = c.aadhaar || '';
  if (!aadhaar && c.notes && c.notes.includes('Aadhaar:')) {
    const match = c.notes.match(/Aadhaar:\s*(\d+)/i);
    if (match) aadhaar = match[1];
  }

  return {
    ...c,
    id: String(c.id),
    name: c.name,
    phone,
    mobile,
    aadhaar,
    village: c.village || '',
    address: c.address || '',
    farm_size: farmSize,
    farmSize,
    crops,
    notes: c.notes || '',
    credit_limit: creditLimit,
    creditLimit,
    outstanding,
    outstanding_balance: outstanding,
    total_purchases: totalPurchases,
    is_active: c.is_active !== false,
    shop_id: c.shop_id || '',
    created_at: c.created_at || new Date().toISOString(),
    updated_at: c.updated_at || new Date().toISOString(),
  };
}

export function getDemoCustomers(): any[] {
  return getStoredDemoCustomers(normalizeCustomer);
}

export async function getCustomers(shopId: string, options: { search?: string; page?: number; limit?: number } = {}) {
  if (isPlaceholderMode()) {
    const all = getDemoCustomers();
    let filtered = all.filter(c => c.is_active !== false);
    if (options.search) {
      const q = options.search.trim().toLowerCase();
      filtered = filtered.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.mobile && c.mobile.includes(q)) ||
        (c.aadhaar && c.aadhaar.includes(q)) ||
        (c.village && c.village.toLowerCase().includes(q))
      );
    }
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);
    return { customers: paginated, total: filtered.length };
  }

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
    
    return { customers: (data || []).map(normalizeCustomer), total: count || 0 };
  } catch (error) {
    console.error("Failed to load customers:", error);
    return { customers: [], total: 0 };
  }
}

export async function getCustomerById(shopId: string, customerId: string) {
  if (isPlaceholderMode()) {
    const store = getDemoCustomers();
    const found = store.find(c => c.id === customerId);
    return found ? normalizeCustomer(found) : null;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('customers').select('*').eq('shop_id', shopId).eq('id', customerId).single();
    if (error) {
      console.error("Error fetching customer by ID:", error);
      return null;
    }
    return data ? normalizeCustomer(data) : null;
  } catch (error) {
    console.error("Failed to load customer by ID:", error);
    return null;
  }
}

export async function createCustomer(shopId: string, data: CustomerInput, userId?: string) {
  const openingBalance = Number((data as any).previous_udhari || 0);

  if (isPlaceholderMode()) {
    const store = getStoredDemoCustomers(normalizeCustomer);
    const id = `cust-${Date.now()}`;
    const newCust = normalizeCustomer({
      id,
      shop_id: shopId,
      name: data.name,
      phone: data.mobile || data.phone || '',
      mobile: data.mobile || data.phone || '',
      aadhaar: (data as any).aadhaar || '',
      village: data.village || '',
      address: data.address || '',
      farm_size: data.farm_size || (data as any).farmSize || '',
      farmSize: data.farm_size || (data as any).farmSize || '',
      crops: data.crops || '',
      notes: data.notes || '',
      credit_limit: data.credit_limit || 50000,
      outstanding: openingBalance,
      outstanding_balance: openingBalance,
      total_purchases: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    // Add to top of persistent list
    store.unshift(newCust);
    saveStoredDemoCustomers(store);
    return newCust;
  }

  const supabase = await createServerSupabaseClient();
  const aadhaarVal = ((data as any).aadhaar || '').trim();

  let notesVal = data.notes?.trim() || null;
  if (aadhaarVal && (!notesVal || !notesVal.includes('Aadhaar:'))) {
    notesVal = notesVal ? `${notesVal} | Aadhaar: ${aadhaarVal}` : `Aadhaar: ${aadhaarVal}`;
  }

  const insertPayload: Record<string, any> = {
    shop_id: shopId,
    name: (data.name || '').trim().toUpperCase(),
    mobile: (data.mobile || data.phone || '').trim() || null,
    village: data.village?.trim() || null,
    address: data.address?.trim() || null,
    farm_size: (data.farm_size || (data as any).farmSize || '').trim() || null,
    crops: data.crops?.trim() || null,
    notes: notesVal,
    outstanding: openingBalance,
    total_purchases: 0,
    total_paid: 0,
    is_active: true,
  };

  let customer: any = null;

  if (aadhaarVal) {
    const withAadhaar = { ...insertPayload, aadhaar: aadhaarVal };
    const { data: resData, error: resError } = await supabase
      .from('customers')
      .insert(withAadhaar)
      .select()
      .single();

    if (!resError && resData) {
      customer = resData;
    } else if (resError && (resError.message?.includes('aadhaar') || resError.code === '42703' || resError.code === 'PGRST204')) {
      // aadhaar column does not exist in DB schema, insert without aadhaar column
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('customers')
        .insert(insertPayload)
        .select()
        .single();
      if (fallbackError) {
        console.error("Error creating customer in Supabase:", fallbackError);
        throw new Error(fallbackError.message || 'Failed to create customer');
      }
      customer = fallbackData;
    } else if (resError) {
      console.error("Error creating customer in Supabase:", resError);
      throw new Error(resError.message || 'Failed to create customer');
    }
  } else {
    const { data: resData, error: resError } = await supabase
      .from('customers')
      .insert(insertPayload)
      .select()
      .single();
    if (resError) {
      console.error("Error creating customer in Supabase:", resError);
      throw new Error(resError.message || 'Failed to create customer');
    }
    customer = resData;
  }

  // Create opening ledger record if previous_udhari > 0
  if (openingBalance > 0 && customer?.id) {
    try {
      await supabase.from('customer_ledger').insert({
        shop_id: shopId,
        customer_id: customer.id,
        date: new Date().toISOString(),
        description: 'Opening Balance (Previous Udhari)',
        reference_type: 'ADJUSTMENT',
        debit: openingBalance,
        credit: 0,
        balance: openingBalance,
        notes: 'Initial opening balance',
        created_by: userId || null,
      });
    } catch (ledgerErr) {
      console.warn("Notice: could not create opening customer_ledger entry:", ledgerErr);
    }
  }

  return normalizeCustomer(customer);
}

export async function updateCustomer(shopId: string, id: string, data: Partial<CustomerInput> | any) {
  if (isPlaceholderMode()) {
    const store = getStoredDemoCustomers(normalizeCustomer);
    const idx = store.findIndex(c => c.id === id);
    if (idx !== -1) {
      const updated = normalizeCustomer({
        ...store[idx],
        ...data,
        name: data.name !== undefined ? data.name : store[idx].name,
        phone: data.mobile !== undefined ? data.mobile : (data.phone !== undefined ? data.phone : store[idx].phone),
        mobile: data.mobile !== undefined ? data.mobile : (data.phone !== undefined ? data.phone : store[idx].mobile),
        updated_at: new Date().toISOString(),
      });
      store[idx] = updated;
      saveStoredDemoCustomers(store);
      return updated;
    }
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const updatePayload: any = {};
  if (data.name !== undefined) updatePayload.name = data.name.trim().toUpperCase();
  if (data.mobile !== undefined || data.phone !== undefined) {
    updatePayload.mobile = (data.mobile || data.phone || '').trim() || null;
  }
  if (data.village !== undefined) updatePayload.village = data.village?.trim() || null;
  if (data.address !== undefined) updatePayload.address = data.address?.trim() || null;
  if (data.farm_size !== undefined || data.farmSize !== undefined) {
    updatePayload.farm_size = (data.farm_size || data.farmSize || '').trim() || null;
  }
  if (data.crops !== undefined) updatePayload.crops = data.crops?.trim() || null;
  if (data.notes !== undefined) updatePayload.notes = data.notes?.trim() || null;
  if (data.is_active !== undefined) updatePayload.is_active = data.is_active;

  const aadhaarVal = (data.aadhaar || '').trim();
  if (aadhaarVal) {
    if (!updatePayload.notes || !updatePayload.notes.includes('Aadhaar:')) {
      updatePayload.notes = updatePayload.notes ? `${updatePayload.notes} | Aadhaar: ${aadhaarVal}` : `Aadhaar: ${aadhaarVal}`;
    }
  }

  let customer: any = null;
  if (aadhaarVal) {
    const withAadhaar = { ...updatePayload, aadhaar: aadhaarVal };
    const { data: resData, error: resError } = await supabase
      .from('customers')
      .update(withAadhaar)
      .eq('shop_id', shopId)
      .eq('id', id)
      .select()
      .single();

    if (!resError && resData) {
      customer = resData;
    } else if (resError && (resError.message?.includes('aadhaar') || resError.code === '42703' || resError.code === 'PGRST204')) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('customers')
        .update(updatePayload)
        .eq('shop_id', shopId)
        .eq('id', id)
        .select()
        .single();
      if (fallbackError) {
        console.error("Error updating customer in Supabase:", fallbackError);
        throw new Error(fallbackError.message || 'Failed to update customer');
      }
      customer = fallbackData;
    } else if (resError) {
      console.error("Error updating customer in Supabase:", resError);
      throw new Error(resError.message || 'Failed to update customer');
    }
  } else {
    const { data: resData, error: resError } = await supabase
      .from('customers')
      .update(updatePayload)
      .eq('shop_id', shopId)
      .eq('id', id)
      .select()
      .single();
    if (resError) {
      console.error("Error updating customer in Supabase:", resError);
      throw new Error(resError.message || 'Failed to update customer');
    }
    customer = resData;
  }

  return normalizeCustomer(customer);
}

export async function deleteCustomer(shopId: string, id: string) {
  if (isPlaceholderMode()) {
    const store = getStoredDemoCustomers(normalizeCustomer);
    const idx = store.findIndex(c => c.id === id);
    if (idx !== -1) {
      store.splice(idx, 1);
      saveStoredDemoCustomers(store);
      return { success: true };
    }
    return { success: false, error: 'Customer not found' };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('customers').delete().eq('shop_id', shopId).eq('id', id);
    if (error) {
      console.error("Error deleting customer:", error);
      throw error;
    }
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete customer:", error);
    throw error;
  }
}

export async function getCustomerLedger(shopId: string, customerId: string, options: { page?: number; limit?: number } = {}) {
  if (isPlaceholderMode()) {
    const cust = await getCustomerById(shopId, customerId);
    
    // We import this dynamically to avoid circular dependencies or server-side issues with localStorage
    let entries = [];
    if (typeof window !== 'undefined') {
       const { getDemoLedgerClient } = require('@/lib/client-demo-store');
       entries = getDemoLedgerClient(customerId);
    }

    return {
      entries,
      total: entries.length,
      balance: Number(cust?.outstanding || 0),
    };
  }

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
  if (isPlaceholderMode()) {
    const store = getDemoCustomers();
    const totalCustomers = store.length;
    const activeCustomers = store.filter(c => c.is_active !== false).length;
    const incomingOutstanding = store.reduce((sum, c) => {
      const bal = Number(c.outstanding || 0);
      return bal > 0 ? sum + bal : sum;
    }, 0);
    const outgoingOutstanding = store.reduce((sum, c) => {
      const bal = Number(c.outstanding || 0);
      return bal < 0 ? sum + Math.abs(bal) : sum;
    }, 0);
    const totalOutstandingCredit = incomingOutstanding;
    return { totalCustomers, activeCustomers, totalOutstandingCredit, incomingOutstanding, outgoingOutstanding };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('customers')
      .select('is_active, outstanding')
      .eq('shop_id', shopId);

    if (error || !data) {
      return { totalCustomers: 0, activeCustomers: 0, totalOutstandingCredit: 0, incomingOutstanding: 0, outgoingOutstanding: 0 };
    }

    const totalCustomers = data.length;
    const activeCustomers = data.filter(c => c.is_active !== false).length;
    const incomingOutstanding = data.reduce((sum, c) => {
      const bal = Number(c.outstanding || 0);
      return bal > 0 ? sum + bal : sum;
    }, 0);
    const outgoingOutstanding = data.reduce((sum, c) => {
      const bal = Number(c.outstanding || 0);
      return bal < 0 ? sum + Math.abs(bal) : sum;
    }, 0);
    const totalOutstandingCredit = incomingOutstanding;

    return { totalCustomers, activeCustomers, totalOutstandingCredit, incomingOutstanding, outgoingOutstanding };
  } catch (error) {
    console.error("Error fetching customer summary:", error);
    return { totalCustomers: 0, activeCustomers: 0, totalOutstandingCredit: 0, incomingOutstanding: 0, outgoingOutstanding: 0 };
  }
}

export async function searchCustomers(shopId: string, queryText: string, limit = 15) {
  if (isPlaceholderMode()) {
    const store = getDemoCustomers();
    const q = (queryText || '').trim().toLowerCase();
    if (!q) {
      return store.slice(0, limit);
    }
    return store
      .filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.mobile && c.mobile.includes(q)) ||
        (c.aadhaar && c.aadhaar.includes(q)) ||
        (c.village && c.village.toLowerCase().includes(q))
      )
      .slice(0, limit);
  }

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
    return (data || []).map(normalizeCustomer);
  } catch (error) {
    console.error("Failed to search customers:", error);
    return [];
  }
}

export async function getCreditCustomers(shopId: string, options: { search?: string; page?: number; limit?: number } = {}) {
  if (isPlaceholderMode()) {
    const store = getDemoCustomers();
    let withCredit = store.filter(c => Number(c.outstanding || 0) > 0);
    if (options.search) {
      const q = options.search.trim().toLowerCase();
      withCredit = withCredit.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.mobile && c.mobile.includes(q))
      );
    }
    return { customers: withCredit, total: withCredit.length };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    let query = supabase.from('customers')
      .select('*', { count: 'exact' })
      .eq('shop_id', shopId)
      .gt('outstanding', 0);
    
    if (options.search) {
      query = query.or(`name.ilike.%${options.search}%,mobile.ilike.%${options.search}%`);
    }
    
    query = query.order('outstanding', { ascending: false });

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      console.error("Error fetching credit customers:", error);
      return getCustomers(shopId, options);
    }
    
    return { customers: (data || []).map(normalizeCustomer), total: count || 0 };
  } catch (error) {
    console.error("Failed to load credit customers:", error);
    return { customers: [], total: 0 };
  }
}

export async function getCreditSummary(shopId: string) {
  if (isPlaceholderMode()) {
    const store = getDemoCustomers();
    const creditCustomers = store.filter(c => Number(c.outstanding || 0) > 0);
    const totalOutstanding = creditCustomers.reduce((sum, c) => sum + Number(c.outstanding || 0), 0);
    const customersWithCredit = creditCustomers.length;
    const overdueAmount = creditCustomers
      .filter(c => Number(c.outstanding || 0) > 5000)
      .reduce((sum, c) => sum + Number(c.outstanding || 0), 0);

    return { totalOutstanding, customersWithCredit, overdueAmount };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('customers')
      .select('outstanding, is_active')
      .eq('shop_id', shopId);

    if (error || !data) {
      return { totalOutstanding: 0, customersWithCredit: 0, overdueAmount: 0 };
    }

    const creditCustomers = data.filter(c => Number(c.outstanding || 0) > 0);
    const totalOutstanding = creditCustomers.reduce((sum, c) => sum + Number(c.outstanding || 0), 0);
    const customersWithCredit = creditCustomers.length;
    const overdueAmount = creditCustomers
      .filter(c => Number(c.outstanding || 0) > 5000)
      .reduce((sum, c) => sum + Number(c.outstanding || 0), 0);

    return { totalOutstanding, customersWithCredit, overdueAmount };
  } catch (error) {
    console.error("Error fetching credit summary:", error);
    return { totalOutstanding: 0, customersWithCredit: 0, overdueAmount: 0 };
  }
}
