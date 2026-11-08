import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/admin';
import { normalizeIndianMobile, maskPhoneNumber } from '@/lib/phone-utils';
import { getSmsProvider } from '@/lib/sms/client';
import { renderSmsTemplate } from '@/lib/sms/templates';
import { SmsMessageType, SmsQueueItem, SendSmsOptions } from '@/lib/sms/types';
import { createDocumentAccessToken } from '@/lib/documents/token-service';

export interface QueueNotificationParams {
  shopId: string;
  recipientPhone: string;
  messageType: SmsMessageType;
  variables: Record<string, any>;
  customerId?: string | null;
  saleId?: string | null;
  dltTemplateId?: string;
  customBody?: string;
  idempotencyKey?: string;
}

/**
 * Enqueues a transactional SMS notification into the persistent Supabase PostgreSQL queue.
 * Guarantees idempotency via unique idempotency_key to prevent duplicate messages.
 */
export async function queueSmsNotification(
  params: QueueNotificationParams
): Promise<{ success: boolean; queueId?: string; skipped?: boolean; reason?: string; error?: string }> {
  try {
    const normPhone = normalizeIndianMobile(params.recipientPhone);
    if (!normPhone) {
      return { success: false, skipped: true, reason: 'INVALID_PHONE', error: 'Invalid 10-digit Indian mobile number' };
    }

    const supabase = await createServerSupabaseClient();
    const adminClient = createServerAdminClient() || supabase;

    // 1. Check customer preferences if customerId provided
    if (params.customerId) {
      const { data: pref } = await adminClient
        .from('customer_sms_preferences')
        .select('*')
        .eq('shop_id', params.shopId)
        .eq('customer_id', params.customerId)
        .maybeSingle();

      if (pref) {
        if (params.messageType === 'INVOICE' && pref.invoice_sms_enabled === false) {
          return { success: true, skipped: true, reason: 'OPTED_OUT_INVOICE' };
        }
        if (params.messageType === 'PAYMENT' && pref.payment_sms_enabled === false) {
          return { success: true, skipped: true, reason: 'OPTED_OUT_PAYMENT' };
        }
        if (params.messageType === 'REMINDER' && pref.reminder_sms_enabled === false) {
          return { success: true, skipped: true, reason: 'OPTED_OUT_REMINDER' };
        }
      }
    }

    // 2. Generate idempotency key if not provided
    const idempotencyKey =
      params.idempotencyKey ||
      `sms-${params.shopId}-${params.messageType.toLowerCase()}-${params.saleId || normPhone}-${Date.now()}`;

    // 3. Render message text
    const messageBody = params.customBody || renderSmsTemplate(params.messageType, params.variables);

    // 4. Insert into sms_notification_queue
    const { data, error } = await adminClient
      .from('sms_notification_queue')
      .insert({
        shop_id: params.shopId,
        customer_id: params.customerId || null,
        sale_id: params.saleId || null,
        recipient_phone: normPhone,
        message_type: params.messageType,
        dlt_template_id: params.dltTemplateId || null,
        variables: params.variables || {},
        message_body: messageBody,
        status: 'pending',
        idempotency_key: idempotencyKey,
        attempts: 0,
        max_attempts: 3,
        next_retry_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      // If error is duplicate idempotency key, return existing without error
      if (error.code === '23505') {
        return { success: true, skipped: true, reason: 'DUPLICATE_IDEMPOTENCY_KEY' };
      }
      console.warn('[SMS Queue] Failed to insert notification into queue:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, queueId: data.id };
  } catch (err: any) {
    console.error('[SMS Queue] Error queuing SMS notification:', err?.message);
    return { success: false, error: err?.message || 'Failed to enqueue notification' };
  }
}

/**
 * Triggers transactional invoice SMS notification after a completed sale.
 * - Generates cryptographically secure document access token
 * - Creates standard DLT-compliant message
 * - Enqueues notification
 * - GUARANTEE: Never fails or rolls back the parent billing transaction.
 */
export async function queueInvoiceNotification(params: {
  sale: any;
  shopId: string;
  shopDetails?: any;
}): Promise<void> {
  try {
    const sale = params.sale;
    const rawPhone =
      sale?.customer_phone ||
      sale?.customer?.phone ||
      sale?.customer?.mobile ||
      sale?.customerPhone;

    const normPhone = normalizeIndianMobile(rawPhone);
    if (!normPhone) {
      console.log(`[SMS Delivery] Skipped for sale ${sale?.id} — no valid customer mobile number.`);
      return;
    }

    const saleId = sale?.id || sale?.sale_id;
    const invNo = sale?.invoice_number || sale?.invoiceNumber || (saleId?.startsWith('KOS-') ? saleId : `KOS-${(saleId || '').substring(0, 8).toUpperCase()}`);
    const shopName = params.shopDetails?.shop_name || params.shopDetails?.shopName || 'Krushi Kendra';
    const grandTotal = sale?.grand_total || sale?.total_amount || sale?.total || 0;
    const customerName = sale?.customer_name || sale?.customer?.name || 'Farmer';
    const customerId = sale?.customer_id || sale?.customer?.id;

    // 1. Generate secure customer access link for combined invoice + statement
    let documentUrl = '';
    try {
      const docToken = await createDocumentAccessToken({
        shopId: params.shopId,
        saleId: saleId,
        customerId: customerId || null,
        documentType: 'INVOICE_STATEMENT',
        expiresInDays: 30,
      });
      documentUrl = docToken.url;
    } catch (tokenErr) {
      console.warn('[SMS Delivery] Could not generate document token, continuing with plain SMS:', tokenErr);
    }

    const variables = {
      farmer_name: customerName,
      invoice_number: invNo,
      amount: grandTotal,
      shop_name: shopName,
      outstanding: sale?.customer_balance || sale?.customer?.current_balance,
      document_url: documentUrl,
    };

    const idempotencyKey = `inv-sms-${params.shopId}-${saleId}`;

    await queueSmsNotification({
      shopId: params.shopId,
      customerId: customerId,
      saleId: saleId,
      recipientPhone: normPhone,
      messageType: 'INVOICE',
      variables,
      idempotencyKey,
    });

    console.log(`[SMS Delivery] Queued invoice SMS for sale ${invNo} to ${maskPhoneNumber(normPhone)}`);
  } catch (err) {
    // Non-negotiable protection: SMS failure MUST NEVER affect completed sale
    console.error('[SMS Delivery] Non-fatal error during post-sale SMS queuing:', err);
  }
}

/**
 * Worker function to process pending SMS items from the queue.
 * Implements exponential backoff:
 * - Attempt 1: Immediate / 1 minute
 * - Attempt 2: 5 minutes
 * - Attempt 3: 15 minutes
 */
export async function processPendingSmsQueue(batchSize: number = 10): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const supabase = await createServerSupabaseClient();
  const adminClient = createServerAdminClient() || supabase;
  const now = new Date().toISOString();

  // 1. Fetch pending items whose retry time has arrived
  const { data: queueItems, error } = await adminClient
    .from('sms_notification_queue')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lte('next_retry_at', now)
    .lt('attempts', 3)
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (error || !queueItems || queueItems.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const provider = getSmsProvider();
  let succeeded = 0;
  let failed = 0;

  for (const item of queueItems) {
    // Acquire processing lock
    const { error: lockErr } = await adminClient
      .from('sms_notification_queue')
      .update({
        status: 'processing',
        last_attempt_at: new Date().toISOString(),
        attempts: item.attempts + 1,
      })
      .eq('id', item.id)
      .eq('status', item.status);

    if (lockErr) continue; // Concurrently claimed by another worker

    const sendOptions: SendSmsOptions = {
      recipientPhone: item.recipient_phone,
      messageType: item.message_type,
      messageBody: item.message_body,
      dltTemplateId: item.dlt_template_id || undefined,
      variables: item.variables,
      idempotencyKey: item.idempotency_key,
      shopId: item.shop_id,
    };

    const result = await provider.send(sendOptions);

    if (result.success) {
      succeeded++;
      await adminClient
        .from('sms_notification_queue')
        .update({
          status: result.status,
          provider: provider.name,
          provider_message_id: result.providerMessageId || null,
          provider_response: result.rawResponse || null,
          error_code: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
    } else {
      failed++;
      const currentAttempts = item.attempts + 1;
      const isMaxReached = currentAttempts >= item.max_attempts;

      // Exponential backoff in minutes: 1 -> 5 -> 15
      const backoffMinutes = currentAttempts === 1 ? 1 : currentAttempts === 2 ? 5 : 15;
      const nextRetry = new Date();
      nextRetry.setMinutes(nextRetry.getMinutes() + backoffMinutes);

      await adminClient
        .from('sms_notification_queue')
        .update({
          status: isMaxReached ? 'failed' : 'pending',
          provider: provider.name,
          error_code: result.errorCode || 'SEND_FAILED',
          error_message: result.errorMessage || 'Failed to dispatch SMS',
          next_retry_at: isMaxReached ? null : nextRetry.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
    }
  }

  return {
    processed: queueItems.length,
    succeeded,
    failed,
  };
}

/**
 * Fetches tenant-scoped SMS notification history for a shop.
 */
export async function getShopSmsQueue(shopId: string, limit: number = 50): Promise<SmsQueueItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('sms_notification_queue')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as SmsQueueItem[];
}
