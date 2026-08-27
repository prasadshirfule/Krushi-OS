import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ExpenseInput } from '@/lib/validations';

export async function getExpenses(shopId: string, options: { dateFrom?: string, dateTo?: string, category?: string, page?: number, limit?: number } = {}) {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from('expenses').select('*, expense_categories(*)', { count: 'exact' }).eq('shop_id', shopId);
  
  if (options.dateFrom) query = query.gte('expense_date', options.dateFrom);
  if (options.dateTo) query = query.lte('expense_date', options.dateTo);
  if (options.category) query = query.eq('category_id', options.category);

  const page = options.page || 1;
  const limit = options.limit || 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, count, error } = await query.order('expense_date', { ascending: false }).range(from, to);
  if (error) throw error;
  return { expenses: data || [], total: count || 0 };
}

export async function createExpense(shopId: string, data: ExpenseInput, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: expense, error } = await supabase.from('expenses').insert({
    shop_id: shopId,
    user_id: userId,
    amount: data.amount,
    expense_date: data.date.toISOString(),
    payment_method: data.payment_method,
    description: data.description,
    category_id: data.category_id || null,
  }).select().single();

  if (error) throw error;
  return expense;
}

export async function updateExpense(shopId: string, id: string, data: Partial<ExpenseInput>) {
  const supabase = await createServerSupabaseClient();
  const updateData: any = { ...data };
  if (data.date) updateData.expense_date = data.date.toISOString();
  delete updateData.date;

  const { data: expense, error } = await supabase.from('expenses').update(updateData).eq('id', id).eq('shop_id', shopId).select().single();
  if (error) throw error;
  return expense;
}

export async function deleteExpense(shopId: string, id: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('expenses').delete().eq('id', id).eq('shop_id', shopId);
  if (error) throw error;
}

export async function getExpenseCategories(shopId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('expense_categories').select('*').eq('shop_id', shopId);
  if (error) throw error;
  return data || [];
}
