'use server';

import { revalidatePath } from 'next/cache';
import { getAuthAndPermissions } from '@/lib/auth-helper';
import { BatchFormData, StockAdjustmentFormData } from '@/lib/validations';
import * as inventoryService from '@/services/inventory.service';
import { ActionResult } from './types';

export async function getInventoryAction(params: { search?: string, category?: string, expiryStatus?: string, page?: number, limit?: number }): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('inventory.view');
    const result = await inventoryService.getInventoryOverview(userData.shop_id, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getBatchesAction(productId: string): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('inventory.view');
    const result = await inventoryService.getBatchesForProduct(userData.shop_id, productId);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function createBatchAction(data: BatchFormData): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('inventory.adjust');
    const result = await inventoryService.createBatch(userData.shop_id, data);
    revalidatePath(`/inventory/products/${data.product_id}`);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function adjustStockAction(data: StockAdjustmentFormData): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('inventory.adjust');
    const result = await inventoryService.adjustStock(userData.shop_id, data, userData.id);
    revalidatePath(`/inventory/products/${data.product_id}`);
    revalidatePath('/inventory');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getStockTransactionsAction(params: { productId?: string, type?: string, page?: number, limit?: number }): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('inventory.view');
    const result = await inventoryService.getStockTransactions(userData.shop_id, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getExpiringProductsAction(daysThreshold: number = 30): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('inventory.view');
    const result = await inventoryService.getExpiringProducts(userData.shop_id, daysThreshold);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getExpiredProductsAction(): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('inventory.view');
    const result = await inventoryService.getExpiredProducts(userData.shop_id);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
