import { generateInvoicePDF } from '@/lib/invoice';
import { ShopDetails, DEFAULT_SHOP_DETAILS } from '@/lib/shop-details';
import { getShopProfile } from '@/services/settings.service';
import { normalizeWhatsAppPhone, maskPhoneNumber } from '@/lib/phone-utils';

export { normalizeWhatsAppPhone, maskPhoneNumber };

export interface WhatsAppSendResult {
  success: boolean;
  pdfDelivered: boolean;
  textDelivered: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  documentStatus?: number;
  textStatus?: number;
  textError?: string;
}

/**
 * Check whether required OpenWA server-only environment variables are defined.
 */
export function isOpenWAConfigured(): boolean {
  const baseUrl = process.env.OPENWA_BASE_URL?.trim();
  const apiKey = process.env.OPENWA_API_KEY?.trim();
  const sessionId = process.env.OPENWA_SESSION_ID?.trim();
  return Boolean(baseUrl && apiKey && sessionId);
}

/**
 * Send a document/PDF message via OpenWA.
 */
export async function sendWhatsAppDocument({
  phone,
  filename,
  pdfBase64,
  caption,
  mimetype = 'application/pdf',
}: {
  phone: string;
  filename: string;
  pdfBase64: string;
  caption?: string;
  mimetype?: string;
}): Promise<{ success: boolean; status?: number; error?: string; data?: any }> {
  const baseUrl = process.env.OPENWA_BASE_URL?.replace(/\/+$/, '');
  const apiKey = process.env.OPENWA_API_KEY;
  const sessionId = process.env.OPENWA_SESSION_ID;

  if (!baseUrl || !apiKey || !sessionId) {
    return { success: false, error: 'OpenWA environment variables are not configured' };
  }

  const chatId = normalizeWhatsAppPhone(phone);
  if (!chatId) {
    return { success: false, error: 'Invalid recipient phone number' };
  }

  const endpoint = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/messages/send-document`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const payload = {
      chatId,
      base64: pdfBase64,
      filename,
      mimetype,
      caption: caption || '',
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let resData: any = null;
    try {
      resData = await response.json();
    } catch {
      // Non-JSON response
    }

    if (!response.ok) {
      const errMsg = resData?.message || resData?.error || `OpenWA HTTP ${response.status} ${response.statusText}`;
      return { success: false, status: response.status, error: errMsg, data: resData };
    }

    return { success: true, status: response.status, data: resData };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError';
    const errMsg = isTimeout ? 'OpenWA request timed out after 15s' : (error.message || 'Unknown network error');
    return { success: false, error: errMsg };
  }
}

/**
 * Send a text message via OpenWA.
 */
export async function sendWhatsAppText({
  phone,
  text,
}: {
  phone: string;
  text: string;
}): Promise<{ success: boolean; status?: number; error?: string; data?: any }> {
  const baseUrl = process.env.OPENWA_BASE_URL?.replace(/\/+$/, '');
  const apiKey = process.env.OPENWA_API_KEY;
  const sessionId = process.env.OPENWA_SESSION_ID;

  if (!baseUrl || !apiKey || !sessionId) {
    return { success: false, error: 'OpenWA environment variables are not configured' };
  }

  const chatId = normalizeWhatsAppPhone(phone);
  if (!chatId) {
    return { success: false, error: 'Invalid recipient phone number' };
  }

  const endpoint = `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/messages/send-text`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const payload = {
      chatId,
      text,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let resData: any = null;
    try {
      resData = await response.json();
    } catch {
      // Non-JSON response
    }

    if (!response.ok) {
      const errMsg = resData?.message || resData?.error || `OpenWA HTTP ${response.status} ${response.statusText}`;
      return { success: false, status: response.status, error: errMsg, data: resData };
    }

    return { success: true, status: response.status, data: resData };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError';
    const errMsg = isTimeout ? 'OpenWA request timed out after 15s' : (error.message || 'Unknown network error');
    return { success: false, error: errMsg };
  }
}

/**
 * Orchestrate complete WhatsApp invoice PDF + greeting text delivery post-sale.
 * Safe execution: never throws, logs diagnostic summary safely.
 */
export async function sendWhatsAppInvoice({
  sale,
  shopId,
  shopDetails,
}: {
  sale: any;
  shopId?: string;
  shopDetails?: Partial<ShopDetails> | null;
}): Promise<WhatsAppSendResult> {
  const invoiceNum = sale?.invoice_number || sale?.invoiceNumber || sale?.id || 'Unknown';

  try {
    // 1. Verify configuration
    if (!isOpenWAConfigured()) {
      console.log(`[WhatsApp Delivery] WhatsApp integration not configured; invoice delivery skipped for ${invoiceNum}.`);
      return { success: false, pdfDelivered: false, textDelivered: false, skipped: true, reason: 'NOT_CONFIGURED' };
    }

    // 2. Extract customer phone
    const rawPhone =
      sale?.customer_phone ||
      sale?.customer?.phone ||
      sale?.customer?.mobile ||
      sale?.customerPhone ||
      (sale?.customer && typeof sale.customer === 'object' ? sale.customer.phone || sale.customer.mobile : null);

    const normalizedPhone = normalizeWhatsAppPhone(rawPhone);
    const maskedPhone = maskPhoneNumber(rawPhone);

    if (!normalizedPhone) {
      console.log(`[WhatsApp Delivery] No valid phone number (${maskedPhone}) for invoice ${invoiceNum}; WhatsApp delivery skipped.`);
      return { success: false, pdfDelivered: false, textDelivered: false, skipped: true, reason: 'NO_VALID_PHONE' };
    }

    // 3. Resolve shop profile
    let resolvedShop: Partial<ShopDetails> = shopDetails || {};
    const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
    if ((!shopDetails || Object.keys(shopDetails).length === 0) && (shopId || sale?.shop_id) && !isPlaceholder) {
      try {
        const fetchedProfile = await getShopProfile(shopId || sale.shop_id);
        if (fetchedProfile) {
          resolvedShop = fetchedProfile;
        }
      } catch {
        // Quiet fallback to DEFAULT_SHOP_DETAILS when executed outside request scope
        resolvedShop = DEFAULT_SHOP_DETAILS;
      }
    } else if (!shopDetails || Object.keys(shopDetails).length === 0) {
      resolvedShop = DEFAULT_SHOP_DETAILS;
    }

    const shopName = resolvedShop?.shopName || 'KRUSHI OS Store';
    const customerName = (
      sale?.customer?.name ||
      sale?.customer_name ||
      (typeof sale?.customer === 'string' ? sale.customer : null) ||
      'Customer'
    ).trim();

    const grandTotal = Number(
      sale?.total_amount ?? sale?.grand_total ?? sale?.totalAmount ?? sale?.payableAmount ?? 0
    ).toFixed(2);

    // 4. Generate existing invoice PDF
    const doc = generateInvoicePDF(sale, resolvedShop);
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const pdfBase64 = pdfBuffer.toString('base64');
    const filename = `Invoice-${invoiceNum}.pdf`;

    // 5. Send PDF Document
    const docResult = await sendWhatsAppDocument({
      phone: normalizedPhone,
      filename,
      pdfBase64,
      caption: `Invoice ${invoiceNum} from ${shopName}`,
    });

    if (!docResult.success) {
      console.error(
        `[WhatsApp Delivery] Failed to send PDF for invoice ${invoiceNum} to ${maskedPhone}. Status: ${docResult.status || 'N/A'}, Error: ${docResult.error}`
      );
      return {
        success: false,
        pdfDelivered: false,
        textDelivered: false,
        error: docResult.error,
        documentStatus: docResult.status,
      };
    }

    // 6. Send personalized thank-you message
    const messageText = `Namaste ${customerName} \u{1F64F}\n\nThank you for shopping with ${shopName}.\n\nYour invoice ${invoiceNum} for \u20B9${grandTotal} is attached.\n\nThank you for choosing ${shopName}.`;

    const textResult = await sendWhatsAppText({
      phone: normalizedPhone,
      text: messageText,
    });

    if (!textResult.success) {
      console.warn(
        `[WhatsApp Delivery] PDF for invoice ${invoiceNum} sent successfully to ${maskedPhone}, but follow-up text failed. Status: ${textResult.status || 'N/A'}, Error: ${textResult.error}`
      );
      return {
        success: false,
        pdfDelivered: true,
        textDelivered: false,
        error: `PDF document delivered, but follow-up text message failed: ${textResult.error}`,
        documentStatus: docResult.status,
        textStatus: textResult.status,
        textError: textResult.error,
      };
    }

    console.log(
      `[WhatsApp Delivery] Invoice ${invoiceNum} successfully sent to ${maskedPhone}. Document HTTP: ${docResult.status}, Text HTTP: ${textResult.status}`
    );

    return {
      success: true,
      pdfDelivered: true,
      textDelivered: true,
      documentStatus: docResult.status,
      textStatus: textResult.status,
    };
  } catch (err: any) {
    console.error(`[WhatsApp Delivery] Unexpected error during WhatsApp invoice sending for ${invoiceNum}:`, err?.message || err);
    return {
      success: false,
      pdfDelivered: false,
      textDelivered: false,
      error: err?.message || 'Unexpected delivery failure',
    };
  }
}
