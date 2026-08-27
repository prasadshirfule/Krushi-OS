'use server';

import { revalidatePath } from 'next/cache';
import { getAuthAndPermissions } from '@/lib/auth-helper';
import { purchaseSchema } from '@/lib/validations';
import * as purchasesService from '@/services/purchases.service';
import { ActionResult } from './types';

export async function completePurchaseAction(data: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('purchases.create');
    
    const validated = purchaseSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0].message };
    }
    
    const result = await purchasesService.completePurchase(userData.shop_id, validated.data as any, userData.id);
    revalidatePath('/purchases');
    revalidatePath('/inventory');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getPurchasesAction(params: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('purchases.view');
    const result = await purchasesService.getPurchases(userData.shop_id, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getPurchaseAction(id: string): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('purchases.view');
    const result = await purchasesService.getPurchaseById(userData.shop_id, id);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
