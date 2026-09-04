'use server';

import { revalidatePath } from 'next/cache';
import { getAuthAndPermissions } from '@/lib/auth-helper';
import { saleSchema } from '@/lib/validations';
import * as salesService from '@/services/sales.service';
import { ActionResult } from './types';

function isPlaceholderMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
}

export async function completeSaleAction(data: any): Promise<ActionResult<any>> {
  try {
    if (isPlaceholderMode()) {
      const saleId = `sale-${Date.now()}`;
      return {
        success: true,
        data: {
          id: saleId,
          saleId: saleId,
          invoice_number: `KOS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        },
      };
    }

    const userData = await getAuthAndPermissions('sales.create');
    
    const validated = saleSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0].message };
    }
    
    const result = await salesService.completeSale(userData.shop_id, validated.data as any, userData.id);
    
    revalidatePath('/sales');
    revalidatePath('/inventory');
    return { success: true, data: result };
  } catch (error: any) {
    console.error('completeSaleAction error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getSalesAction(params: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('sales.view');
    const result = await salesService.getSales(userData.shop_id, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
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
    const result = await salesService.cancelSale(userData.shop_id, id, userData.id, reason);
    revalidatePath('/sales');
    revalidatePath(`/sales/${id}`);
    revalidatePath('/inventory');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function returnSaleAction(id: string, items: { saleItemId: string, quantity: number, reason: string }[]): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('sales.return');
    const result = await salesService.returnSale(userData.shop_id, id, items, userData.id);
    revalidatePath('/sales');
    revalidatePath(`/sales/${id}`);
    revalidatePath('/inventory');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
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
