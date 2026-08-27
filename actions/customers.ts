'use server';

import { revalidatePath } from 'next/cache';
import { getAuthAndPermissions } from '@/lib/auth-helper';
import { customerSchema } from '@/lib/validations';
import * as customersService from '@/services/customers.service';
import * as paymentsService from '@/services/payments.service';
import { ActionResult } from './types';

export async function getCustomersAction(params: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('customers.view');
    const result = await customersService.getCustomers(userData.shop_id, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getCustomerAction(id: string): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('customers.view');
    const result = await customersService.getCustomerById(userData.shop_id, id);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function createCustomerAction(data: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('customers.create');
    const validated = customerSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0].message };
    }
    const result = await customersService.createCustomer(userData.shop_id, validated.data);
    revalidatePath('/customers');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function updateCustomerAction(id: string, data: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('customers.edit');
    const result = await customersService.updateCustomer(userData.shop_id, id, data);
    revalidatePath('/customers');
    revalidatePath(`/customers/${id}`);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function searchCustomersAction(query: string): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('customers.view');
    const result = await customersService.searchCustomers(userData.shop_id, query);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getCustomerLedgerAction(customerId: string, params: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('customers.view');
    const result = await customersService.getCustomerLedger(userData.shop_id, customerId, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function collectPaymentAction(data: { customerId: string, amount: number, paymentMethod: string, notes?: string }): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('customers.edit');
    const result = await paymentsService.recordCustomerPayment(
      userData.shop_id,
      { customerId: data.customerId, amount: data.amount, method: data.paymentMethod, notes: data.notes },
      userData.id
    );
    revalidatePath(`/customers/${data.customerId}`);
    revalidatePath('/customers');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
