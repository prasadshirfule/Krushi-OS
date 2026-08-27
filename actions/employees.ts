'use server';

import { revalidatePath } from 'next/cache';
import { getAuthAndPermissions } from '@/lib/auth-helper';
import { employeeSchema } from '@/lib/validations';
import * as employeesService from '@/services/employees.service';
import { ActionResult } from './types';

export async function getEmployeesAction(params: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('employees.view');
    const result = await employeesService.getEmployees(userData.shop_id, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function createEmployeeAction(data: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('employees.create');
    const validated = employeeSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0].message };
    }
    const result = await employeesService.createEmployee(userData.shop_id, validated.data);
    revalidatePath('/employees');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function updateEmployeeAction(id: string, data: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('employees.edit');
    const result = await employeesService.updateEmployee(userData.shop_id, id, data);
    revalidatePath('/employees');
    revalidatePath(`/employees/${id}`);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function toggleEmployeeStatusAction(id: string): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('employees.edit');
    const result = await employeesService.toggleEmployeeStatus(userData.shop_id, id);
    revalidatePath('/employees');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getRolesAction(): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('employees.view');
    const result = await employeesService.getRoles();
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
