'use server';

import { revalidatePath } from 'next/cache';
import { getAuthAndPermissions } from '@/lib/auth-helper';
import { supplierSchema } from '@/lib/validations';
import * as suppliersService from '@/services/suppliers.service';
import * as paymentsService from '@/services/payments.service';
import { ActionResult } from './types';

export async function getSuppliersAction(params: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('suppliers.view');
    const result = await suppliersService.getSuppliers(userData.shop_id, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getSupplierAction(id: string): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('suppliers.view');
    const result = await suppliersService.getSupplierById(userData.shop_id, id);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function createSupplierAction(data: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('suppliers.create');
    const validated = supplierSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0].message };
    }
    const result = await suppliersService.createSupplier(userData.shop_id, validated.data);
    revalidatePath('/suppliers');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function updateSupplierAction(id: string, data: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('suppliers.edit');
    const result = await suppliersService.updateSupplier(userData.shop_id, id, data);
    revalidatePath('/suppliers');
    revalidatePath(`/suppliers/${id}`);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function searchSuppliersAction(query: string): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('suppliers.view');
    const result = await suppliersService.searchSuppliers(userData.shop_id, query);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getSupplierLedgerAction(supplierId: string, params: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('suppliers.view');
    const result = await suppliersService.getSupplierLedger(userData.shop_id, supplierId, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function makeSupplierPaymentAction(data: { supplierId: string, amount: number, paymentMethod: string, notes?: string }): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('suppliers.edit');
    const result = await paymentsService.recordSupplierPayment(
      userData.shop_id,
      { supplierId: data.supplierId, amount: data.amount, method: data.paymentMethod, notes: data.notes },
      userData.id
    );
    revalidatePath(`/suppliers/${data.supplierId}`);
    revalidatePath('/suppliers');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
