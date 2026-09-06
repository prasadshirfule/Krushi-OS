import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function getEmployees(shopId: string, options: { search?: string, page?: number, limit?: number } = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    let query = supabase.from('users').select('*, role:roles(name)', { count: 'exact' }).eq('shop_id', shopId);
    
    if (options.search) {
      query = query.ilike('full_name', `%${options.search}%`);
    }
    
    query = query.order('created_at', { ascending: false });

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) {
      console.error("Error fetching employees:", error);
      return { employees: [], total: 0 };
    }
    
    return { employees: data || [], total: count || 0 };
  } catch (error) {
    console.error("Failed to load employees:", error);
    return { employees: [], total: 0 };
  }
}

export async function getEmployeeById(shopId: string, id: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('users').select('*, role:roles(name)').eq('shop_id', shopId).eq('id', id).single();
    if (error) {
      console.error("Error fetching employee by ID:", error);
      return null;
    }
    return data;
  } catch (error) {
    console.error("Failed to load employee by ID:", error);
    return null;
  }
}

export async function createEmployee(shopId: string, data: any) {
  const supabase = await createServerSupabaseClient();
  const payload = {
    ...data,
    full_name: data.full_name ? data.full_name.trim().toUpperCase() : (data.name ? data.name.trim().toUpperCase() : undefined),
    shop_id: shopId,
  };
  const { data: employee, error } = await supabase.from('users').insert(payload).select().single();
  if (error) {
    console.error("Error creating employee:", error);
    throw error;
  }
  return employee;
}

export async function updateEmployee(shopId: string, id: string, data: any, userId?: string) {
  const supabase = await createServerSupabaseClient();
  const payload = {
    ...data,
    full_name: data.full_name !== undefined ? (data.full_name ? data.full_name.trim().toUpperCase() : null) : (data.name !== undefined ? (data.name ? data.name.trim().toUpperCase() : null) : undefined),
  };
  const { data: employee, error } = await supabase.from('users').update(payload).eq('shop_id', shopId).eq('id', id).select().single();
  if (error) {
    console.error("Error updating employee:", error);
    throw error;
  }
  return employee;
}

export async function toggleEmployeeStatus(shopId: string, id: string, isActive?: boolean) {
  const supabase = await createServerSupabaseClient();
  let nextState = isActive;
  if (nextState === undefined) {
    const emp = await getEmployeeById(shopId, id);
    nextState = !emp?.is_active;
  }
  const { data: employee, error } = await supabase.from('users').update({ is_active: nextState }).eq('shop_id', shopId).eq('id', id).select().single();
  if (error) {
    console.error("Error toggling employee status:", error);
    throw error;
  }
  return employee;
}

export async function getRoles() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('roles').select('*').order('name');
    if (error) {
      console.error("Error fetching roles:", error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error("Failed to load roles:", error);
    return [];
  }
}
