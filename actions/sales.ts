'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { getAuthAndPermissions } from '@/lib/auth-helper';
import { saleSchema, saleCancelSchema, saleReturnSchema } from '@/lib/validations';
import * as salesService from '@/services/sales.service';
import { queueInvoiceNotification, dispatchQueuedSms } from '@/services/sms.service';
import { getShopSubscription, incrementSubscriptionUsage } from '@/services/subscription.service';
import { normalizeIndianMobile } from '@/lib/phone-utils';
import { getShopProfile } from '@/services/settings.service';
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

function revalidateSaleMutationPaths(saleId: string) {
  safeRevalidatePath('/sales');
  safeRevalidatePath('/sales', 'page');
  safeRevalidatePath(`/sales/${saleId}`);
  safeRevalidatePath(`/sales/${saleId}`, 'page');
  safeRevalidatePath('/dashboard');
  safeRevalidatePath('/dashboard', 'page');
  safeRevalidatePath('/billing');
  safeRevalidatePath('/billing', 'page');
  safeRevalidatePath('/inventory');
  safeRevalidatePath('/customers');
  safeRevalidatePath('/reports');
}

export async function completeSaleAction(data: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('sales.create');
    
    // 1. Subscription quota check (fail-safe gated by ENABLE_SUBSCRIPTION_ENFORCEMENT)
    const subscription = await getShopSubscription(userData.shop_id);
    if (!subscription.canCreateInvoice) {
      return {
        success: false,
        error: 'Invoice limit reached for your active subscription plan. Please upgrade to continue billing.',
      };
    }

    if (!isPlaceholderMode()) {
      const validated = saleSchema.safeParse(data);
      if (!validated.success) {
        return { success: false, error: validated.error.errors[0]?.message || 'Invalid sale data' };
      }
    }
    
    const result = await salesService.completeSale(userData.shop_id, data, userData.id);

    // Pre-fetch shop profile while request cookies/context are active
    let shopProfile: any = null;
    try {
      shopProfile = await getShopProfile(userData.shop_id);
    } catch (profileErr) {
      console.warn('[SMS Delivery] Could not fetch shop profile in action context:', profileErr);
    }

    // Schedule post-response transactional SMS invoice notification and usage tracking using Next.js after()
    try {
      if (typeof after === 'function') {
        after(async () => {
          try {
            const queueRes = await queueInvoiceNotification({
              sale: result,
              shopId: userData.shop_id,
              shopDetails: shopProfile,
            });
            if (queueRes?.queueId) {
              await dispatchQueuedSms(queueRes.queueId);
            }
          } catch (bgErr) {
            console.error('[SMS Delivery Background Error]:', bgErr);
          }

          try {
            await incrementSubscriptionUsage(userData.shop_id, 'invoice');
          } catch (usageErr) {
            console.warn('[Subscription] Usage increment error:', usageErr);
          }
        });
      }
    } catch (afterErr) {
      console.warn('[SMS Delivery] Failed to schedule background after() task:', afterErr);
    }
    
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

    if (!isPlaceholderMode()) {
      const validated = saleCancelSchema.safeParse({
        saleId: id,
        reason: typeof reason === 'string' ? reason.trim() : reason,
      });
      if (!validated.success) {
        return {
          success: false,
          error: validated.error.errors[0]?.message || 'Invalid cancellation data',
        };
      }
      id = validated.data.saleId;
      reason = validated.data.reason;
    } else {
      if (!id || typeof id !== 'string') {
        return { success: false, error: 'Sale ID is required' };
      }
      if (!reason || !String(reason).trim()) {
        return { success: false, error: 'Cancellation reason is required' };
      }
      reason = String(reason).trim();
    }

    // shop_id always comes from the authenticated session — never from the client payload
    const result = await salesService.cancelSale(userData.shop_id, id, userData.id, reason);
    revalidateSaleMutationPaths(id);
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

    let normalizedItems = items;
    let normalizedRefundMode = refundMode || 'CREDIT_ADJUSTMENT';
    let normalizedReason = reason || 'Customer Return';

    if (!isPlaceholderMode()) {
      const validated = saleReturnSchema.safeParse({
        saleId: id,
        items,
        refundMode: refundMode || 'CREDIT_ADJUSTMENT',
        reason: reason || 'Customer Return',
      });
      if (!validated.success) {
        return {
          success: false,
          error: validated.error.errors[0]?.message || 'Invalid return data',
        };
      }
      id = validated.data.saleId;
      normalizedItems = validated.data.items.map((item) => ({
        saleItemId: item.saleItemId,
        quantity: item.quantity,
        reason: item.reason || undefined,
      }));
      normalizedRefundMode = validated.data.refundMode;
      normalizedReason = validated.data.reason;
    } else {
      if (!id || typeof id !== 'string') {
        return { success: false, error: 'Sale ID is required' };
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        return { success: false, error: 'At least one item must be returned' };
      }
    }

    // shop_id always comes from the authenticated session — never from the client payload
    const result = await salesService.returnSale(
      userData.shop_id,
      id,
      normalizedItems,
      userData.id,
      normalizedRefundMode,
      normalizedReason
    );
    revalidateSaleMutationPaths(id);
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

export interface SmsDeliveryResult {
  success: boolean;
  status: 'QUEUED' | 'FAILED' | 'SKIPPED';
  message: string;
  reason?: string;
  error?: string;
  queueId?: string;
}

/**
 * Re-queues an invoice SMS notification for an existing completed sale.
 * - Authenticates the caller and enforces shop-level isolation.
 * - Does NOT create a new sale or modify database records, inventory, payments, or ledger.
 * - Does NOT accept phone or shop_id from the client.
 */
export async function resendInvoiceSmsAction(saleId: string): Promise<ActionResult<SmsDeliveryResult>> {
  try {
    const userData = await getAuthAndPermissions('sales.view');
    if (!saleId || typeof saleId !== 'string') {
      return { success: false, error: 'Sale ID is required' };
    }

    // Load existing sale using the authenticated shop to enforce ownership
    let sale: any = null;
    try {
      sale = await salesService.getSaleById(userData.shop_id, saleId);
    } catch (err: any) {
      console.warn('[SMS Resend] Could not load sale from DB:', err?.message);
    }

    if (!sale) {
      return { success: false, error: 'Sale not found or not accessible' };
    }

    // Extract customer phone directly from the existing verified sale record
    const rawPhone =
      sale?.customer_phone ||
      sale?.customer?.phone ||
      sale?.customer?.mobile ||
      sale?.customerPhone ||
      (sale?.customer && typeof sale.customer === 'object' ? sale.customer.phone || sale.customer.mobile : null);

    const normalizedPhone = normalizeIndianMobile(rawPhone);
    if (!normalizedPhone) {
      return {
        success: true,
        data: {
          success: false,
          status: 'SKIPPED',
          reason: 'NO_VALID_PHONE',
          message: 'SMS not sent — no valid 10-digit customer mobile number',
        },
      };
    }

    let shopProfile = null;
    try {
      shopProfile = await getShopProfile(userData.shop_id);
    } catch (profileErr) {
      console.warn('[SMS Resend] Could not fetch shop profile:', profileErr);
    }

    const queueRes = await queueInvoiceNotification({
      sale,
      shopId: userData.shop_id,
      shopDetails: shopProfile,
    });

    if (queueRes?.queueId) {
      await dispatchQueuedSms(queueRes.queueId);
    }

    return {
      success: true,
      data: {
        success: true,
        status: 'QUEUED',
        message: 'Invoice SMS notification dispatched for delivery',
      },
    };
  } catch (error: any) {
    console.error('resendInvoiceSmsAction error:', error);
    return {
      success: false,
      error: error.message || 'Unable to re-queue SMS notification',
    };
  }
}


