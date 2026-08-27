'use server';

import { revalidatePath } from 'next/cache';
import { getAuthAndPermissions } from '@/lib/auth-helper';
import * as reportsService from '@/services/reports.service';
import { ActionResult } from './types';

export async function getSalesReportAction(params: { period: string, dateFrom?: string, dateTo?: string, groupBy?: string }): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('reports.view');
    const result = await reportsService.getSalesReport(userData.shop_id, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getInventoryReportAction(params: { type: 'current'|'low'|'expired'|'expiring' }): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('reports.view');
    const result = await reportsService.getInventoryReport(userData.shop_id, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getFinancialReportAction(params: { dateFrom?: string, dateTo?: string }): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('reports.view');
    const result = await reportsService.getFinancialReport(userData.shop_id, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getCustomerReportAction(params: { customerId?: string, dateFrom?: string, dateTo?: string }): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('reports.view');
    const result = await reportsService.getCustomerReport(userData.shop_id, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getSupplierReportAction(params: { supplierId?: string, dateFrom?: string, dateTo?: string }): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('reports.view');
    const result = await reportsService.getSupplierReport(userData.shop_id, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function exportReportAction(params: { type: string, format: 'csv'|'excel'|'pdf', [key: string]: any }): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('reports.export');
    const result = await reportsService.exportReport(userData.shop_id, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
