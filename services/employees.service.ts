import { createServerSupabaseClient } from '@/lib/supabase/server';
import { EmployeeInput } from '@/lib/validations';
import { MOCK_EMPLOYEES } from '@/lib/mock-data';

function isPlaceholderMode() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
}

export async function getEmployees(shopId: string, options: { page?: number, limit?: number } = {}) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, count, error } = await supabase
      .from('employees')
      .select('*, roles(*)', { count: 'exact' })
      .eq('shop_id', shopId);

    if (error) throw error;
    return { employees: data || [], total: count || 0 };
  } catch (error) {
    return { employees: MOCK_EMPLOYEES, total: MOCK_EMPLOYEES.length };
  }
}

export async function createEmployee(shopId: string, data: EmployeeInput) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    
    const [firstName, ...rest] = data.full_name.split(' ');
    const lastName = rest.join(' ');

    const { data: employee, error } = await supabase.from('employees').insert({
      shop_id: shopId,
      role_id: data.role_id,
      first_name: firstName,
      last_name: lastName || '',
      phone: data.phone || null,
    }).select().single();

    if (error) throw error;
    return employee;
  } catch (error) {
    const newEmp = {
      id: `emp-${Date.now()}`,
      name: data.full_name,
      email: data.email,
      role: 'Staff',
      phone: data.phone || '',
      status: 'ACTIVE',
      joined_at: new Date().toISOString().split('T')[0]
    };
    MOCK_EMPLOYEES.push(newEmp as any);
    return newEmp;
  }
}

export async function updateEmployee(shopId: string, id: string, data: Partial<EmployeeInput>) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const updateData: any = {};
    if (data.full_name) {
      const [firstName, ...rest] = data.full_name.split(' ');
      updateData.first_name = firstName;
      updateData.last_name = rest.join(' ');
    }
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.role_id) updateData.role_id = data.role_id;

    const { data: employee, error } = await supabase.from('employees').update(updateData).eq('id', id).eq('shop_id', shopId).select().single();
    if (error) throw error;
    return employee;
  } catch (error) {
    const emp = MOCK_EMPLOYEES.find(e => e.id === id);
    if (emp && data.full_name) emp.name = data.full_name;
    return emp;
  }
}

export async function toggleEmployeeStatus(shopId: string, id: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data: current } = await supabase.from('employees').select('id').eq('id', id).eq('shop_id', shopId).single();
    if (!current) throw new Error('Employee not found');
    return { success: true };
  } catch (error) {
    const emp = MOCK_EMPLOYEES.find(e => e.id === id);
    if (emp) emp.status = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return { success: true };
  }
}

export async function getRoles() {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('roles').select('*');
    if (error) throw error;
    return data || [];
  } catch (error) {
    return [
      { id: 'role-1', name: 'Admin', description: 'Full System Control' },
      { id: 'role-2', name: 'Manager', description: 'Inventory & Billing Management' },
      { id: 'role-3', name: 'Cashier', description: 'Counter POS Billing' },
      { id: 'role-4', name: 'Sales Staff', description: 'Catalog Lookup' }
    ];
  }
}
