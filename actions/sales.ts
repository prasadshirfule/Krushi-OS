'use server';

import { revalidatePath } from 'next/cache';
import { getAuthAndPermissions } from '@/lib/auth-helper';
import { saleSchema } from '@/lib/validations';
import * as salesService from '@/services/sales.service';
import { ActionResult } from './types';

function isPlaceholderMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
}

function safeRevalidatePath(path: string, type?: 'page' | 'layout') {
  try {
    if (type) {
      revalidatePath(path, type);
    } else {
      revalidatePath(path);
    }
  } catch {
    // Invariant safe-guard when called outside static generation store
  }
}

export async function completeSaleAction(data: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('sales.create');
    
    if (!isPlaceholderMode()) {
      const validated = saleSchema.safeParse(data);
      if (!validated.success) {
        return { success: false, error: validated.error.errors[0]?.message || 'Invalid sale data' };
      }
    }
    
    const result = await salesService.completeSale(userData.shop_id, data, userData.id);
    
    safeRevalidatePath('/sales');
    safeRevalidatePath('/sales', 'page');
    safeRevalidatePath('/dashboard');
    safeRevalidatePath('/dashboard', 'page');
    safeRevalidatePath('/billing');
    safeRevalidatePath('/billing', 'page');
    safeRevalidatePath('/inventory');
    safeRevalidatePath('/reports');
    return { success: true, data: result };
  } catch (error: any) {
    console.error('completeSaleAction error:', error);
    return { success: false, error: error.message || 'Unable to complete bill. Please try again.' };
  }
}

export async function getSalesAction(params: any = {}): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('sales.view');
    const result = await salesService.getSales(userData.shop_id, params || {});
    return { success: true, data: result };
  } catch (error: any) {
    console.error('getSalesAction error:', error);
    return { success: false, error: error.message || 'Unable to load sales history from database' };
  }
}

export async function getSaleAction(id: string): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('sales.view');
    const result = await salesService.getSaleById(userData.shop_id, id);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function cancelSaleAction(id: string, reason: string): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('sales.cancel');
    
    if (!id || typeof id !== 'string') {
      return { success: false, error: 'Sale ID is required' };
    }
    if (!reason || !reason.trim()) {
      return { success: false, error: 'Cancellation reason is required' };
    }

    const result = await salesService.cancelSale(userData.shop_id, id, userData.id, reason.trim());
    
    safeRevalidatePath('/sales');
    safeRevalidatePath('/sales', 'page');
    safeRevalidatePath(`/sales/${id}`);
    safeRevalidatePath(`/sales/${id}`, 'page');
    safeRevalidatePath('/dashboard');
    safeRevalidatePath('/dashboard', 'page');
    safeRevalidatePath('/billing');
    safeRevalidatePath('/inventory');
    safeRevalidatePath('/customers');
    safeRevalidatePath('/reports');
    
    return { success: true, data: result };
  } catch (error: any) {
    console.error('cancelSaleAction error:', error);
    return { success: false, error: error.message || 'Unable to cancel bill. Please try again.' };
  }
}

export async function returnSaleAction(
  id: string,
  items: { saleItemId: string; quantity: number; reason?: string }[],
  refundMode: string = 'CREDIT_ADJUSTMENT',
  reason: string = 'Customer Return'
): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('sales.return');
    
    if (!id || typeof id !== 'string') {
      return { success: false, error: 'Sale ID is required' };
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return { success: false, error: 'At least one item must be returned' };
    }

    const result = await salesService.returnSale(userData.shop_id, id, items, userData.id, refundMode, reason);
    
    safeRevalidatePath('/sales');
    safeRevalidatePath('/sales', 'page');
    safeRevalidatePath(`/sales/${id}`);
    safeRevalidatePath(`/sales/${id}`, 'page');
    safeRevalidatePath('/dashboard');
    safeRevalidatePath('/dashboard', 'page');
    safeRevalidatePath('/billing');
    safeRevalidatePath('/inventory');
    safeRevalidatePath('/customers');
    safeRevalidatePath('/reports');
    
    return { success: true, data: result };
  } catch (error: any) {
    console.error('returnSaleAction error:', error);
    return { success: false, error: error.message || 'Unable to process return. Please try again.' };
  }
}

export async function getSaleReturnsAction(saleId: string): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('sales.view');
    if (!saleId) {
      return { success: false, error: 'Sale ID is required' };
    }
    const result = await salesService.getSaleReturns(userData.shop_id, saleId);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('getSaleReturnsAction error:', error);
    return { success: false, error: error.message || 'Unable to load return history' };
  }
}

export async function getSaleReturnAction(returnId: string): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('sales.view');
    if (!returnId) {
      return { success: false, error: 'Return ID is required' };
    }
    const result = await salesService.getSaleReturnById(userData.shop_id, returnId);
    if (!result) {
      return { success: false, error: 'Return document not found' };
    }
    return { success: true, data: result };
  } catch (error: any) {
    console.error('getSaleReturnAction error:', error);
    return { success: false, error: error.message || 'Unable to load return document' };
  }
}

export async function getTodaySalesAction(): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('sales.view');
    const result = await salesService.getTodaySales(userData.shop_id);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

