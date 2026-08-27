'use server';

import { revalidatePath } from 'next/cache';
import { getAuthAndPermissions } from '@/lib/auth-helper';
import { expenseSchema } from '@/lib/validations';
import * as expensesService from '@/services/expenses.service';
import { ActionResult } from './types';

export async function getExpensesAction(params: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('expenses.view');
    const result = await expensesService.getExpenses(userData.shop_id, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function createExpenseAction(data: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('expenses.create');
    const validated = expenseSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0].message };
    }
    const result = await expensesService.createExpense(userData.shop_id, validated.data, userData.id);
    revalidatePath('/expenses');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function updateExpenseAction(id: string, data: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('expenses.edit');
    const result = await expensesService.updateExpense(userData.shop_id, id, data);
    revalidatePath('/expenses');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function deleteExpenseAction(id: string): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('expenses.delete');
    const result = await expensesService.deleteExpense(userData.shop_id, id);
    revalidatePath('/expenses');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getExpenseCategoriesAction(): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('expenses.view');
    const result = await expensesService.getExpenseCategories(userData.shop_id);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
