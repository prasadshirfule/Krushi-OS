import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/admin';
import { formatProductNameWithSize } from '@/lib/validations';
import { formatDisplayMobile, normalizeIndianMobile } from '@/lib/phone-utils';

export interface CustomerPortalBillSummary {
  id: string;
  invoice_number: string;
  shop_id: string;
  shop_name: string;
  customer_id: string;
  customer_name: string;
  sale_date: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  payment_status: 'PAID' | 'PARTIAL' | 'CREDIT' | 'UNPAID' | 'CANCELLED';
  payment_method: string;
  status: 'COMPLETED' | 'CANCELLED' | 'RETURNED' | 'PARTIALLY_RETURNED';
  return_status?: 'NONE' | 'PARTIAL' | 'FULL';
  item_count?: number;
}

export interface CustomerPortalShop {
  id: string;
  name: string;
  address?: string | null;
  village?: string | null;
  district?: string | null;
  state?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  gstin?: string | null;
  logo_url?: string | null;
  invoice_terms?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  upi_id?: string | null;
  bill_count?: number;
}

export interface CustomerPortalNotification {
  id: string;
  shop_id: string;
  shop_name?: string;
  sale_id?: string | null;
  type: 'NEW_BILL' | 'PAYMENT_RECEIVED' | 'OUTSTANDING_REMINDER' | 'SALE_RETURN' | 'INFO';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface CustomerDashboardMetrics {
  totalPurchases: number;
  totalPaid: number;
  totalOutstanding: number;
  totalInvoices: number;
  linkedShopsCount: number;
}

export interface CustomerDashboardData {
  customer: {
    id: string;
    name: string;
    email: string;
    mobile: string | null;
    displayMobile: string;
  };
  linkedShops: CustomerPortalShop[];
  bills: CustomerPortalBillSummary[];
  summary: CustomerDashboardMetrics;
  notifications: CustomerPortalNotification[];
}

/**
 * Resolves the authenticated customer account and all linked shop customer records.
 * Returns null if the user is unauthenticated or has no customer account.
 */
export async function getAuthenticatedCustomerContext() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const adminClient = createServerAdminClient() || supabase;

  // 1. Fetch customer_accounts record
  let { data: account } = await adminClient
    .from('customer_accounts')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  // If not found by auth_user_id, try email match as fallback
  if (!account && user.email) {
    const { data: byEmail } = await adminClient
      .from('customer_accounts')
      .select('*')
      .eq('email', user.email)
      .maybeSingle();

    if (byEmail) {
      await adminClient
        .from('customer_accounts')
        .update({ auth_user_id: user.id, updated_at: new Date().toISOString() })
        .eq('id', byEmail.id);
      account = byEmail;
    }
  }

  if (!account) {
    // Gracefully provision customer_accounts if missing
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || 'Farmer';
    const normalizedPhone = user.phone ? normalizeIndianMobile(user.phone) : null;
    const { data: newAccount } = await adminClient
      .from('customer_accounts')
      .insert({
        auth_user_id: user.id,
        email: user.email || null,
        mobile: normalizedPhone,
        name: fullName,
      })
      .select('*')
      .single();

    account = newAccount;
  }

  if (!account) {
    return null;
  }

  // 2. Fetch all shop customer records linked to this customer_accounts.id
  const { data: linkedCustomers } = await adminClient
    .from('customers')
    .select('id, shop_id, name, mobile, email, village, balance, total_purchases')
    .eq('customer_account_id', account.id);

  const linkedRecords = linkedCustomers || [];
  const linkedCustomerIds = linkedRecords.map((c) => c.id);

  return {
    user,
    account,
    linkedRecords,
    linkedCustomerIds,
    adminClient,
    supabase,
  };
}

/**
 * Normalizes payment and sale status for display and badges.
 */
export function resolveSaleStatusAndPayment(sale: any) {
  const rawStatus = (sale.status || '').toString().toLowerCase().trim();
  const rawPaymentStatus = (sale.payment_status || '').toString().toLowerCase().trim();
  const rawPaymentMethod = (
    sale.payment_method ||
    sale.payment_mode ||
    sale.payments?.[0]?.payment_method ||
    sale.payments?.[0]?.method ||
    (rawPaymentStatus === 'credit' ? 'CREDIT' : 'CASH')
  ).toString().toUpperCase();

  const totalAmount = Number(sale.total_amount || 0);
  let paidAmount = Number(sale.paid_amount !== undefined ? sale.paid_amount : (sale.paidAmount || 0));

  const isCancelled = rawStatus === 'cancelled' || rawPaymentStatus === 'cancelled';
  const isFullyReturned = rawStatus === 'returned' || rawStatus === 'fully returned';
  const isPartiallyReturned = rawStatus === 'partially_returned';

  let normalizedStatus: 'COMPLETED' | 'CANCELLED' | 'RETURNED' | 'PARTIALLY_RETURNED' = 'COMPLETED';
  if (isCancelled) normalizedStatus = 'CANCELLED';
  else if (isFullyReturned) normalizedStatus = 'RETURNED';
  else if (isPartiallyReturned) normalizedStatus = 'PARTIALLY_RETURNED';

  let normalizedPaymentStatus: 'PAID' | 'PARTIAL' | 'CREDIT' | 'UNPAID' | 'CANCELLED' = 'PAID';

  if (isCancelled) {
    normalizedPaymentStatus = 'CANCELLED';
  } else if (rawPaymentStatus === 'credit' || rawPaymentStatus === 'unpaid' || rawPaymentMethod === 'CREDIT') {
    normalizedPaymentStatus = 'CREDIT';
    if (paidAmount === 0 && rawPaymentStatus !== 'paid') {
      paidAmount = 0;
    }
  } else if (rawPaymentStatus === 'partial' || rawPaymentMethod === 'PARTIAL') {
    normalizedPaymentStatus = 'PARTIAL';
  } else if (rawPaymentStatus === 'paid' || paidAmount >= totalAmount) {
    normalizedPaymentStatus = 'PAID';
    if (paidAmount === 0 && totalAmount > 0) {
      paidAmount = totalAmount;
    }
  }

  const balanceDue = isCancelled ? 0 : Math.max(0, totalAmount - paidAmount);

  let displayPaymentMethod = 'Cash';
  if (rawPaymentMethod === 'CREDIT') displayPaymentMethod = 'Credit';
  else if (rawPaymentMethod === 'UPI') displayPaymentMethod = 'UPI';
  else if (rawPaymentMethod === 'BANK_TRANSFER') displayPaymentMethod = 'Bank Transfer';
  else if (rawPaymentMethod === 'CARD') displayPaymentMethod = 'Card';
  else if (rawPaymentMethod === 'PARTIAL') displayPaymentMethod = 'Partial';
  else if (rawPaymentMethod === 'CASH') displayPaymentMethod = 'Cash';
  else if (sale.payment_method || sale.payment_mode) displayPaymentMethod = sale.payment_method || sale.payment_mode;

  return {
    status: normalizedStatus,
    paymentStatus: normalizedPaymentStatus,
    paymentMethod: displayPaymentMethod,
    paidAmount,
    balanceDue,
  };
}

/**
 * Fetches lightweight customer dashboard data: profile, linked shops, bills across all shops, metrics, and notifications.
 */
export async function getCustomerDashboardData(): Promise<{ success: boolean; data?: CustomerDashboardData; error?: string }> {
  try {
    const context = await getAuthenticatedCustomerContext();

    if (!context) {
      return { success: false, error: 'User session not found. Please log in.' };
    }

    const { account, linkedRecords, linkedCustomerIds, adminClient } = context;

    const customerInfo = {
      id: account.id,
      name: account.name || 'Farmer',
      email: account.email || '',
      mobile: account.mobile || null,
      displayMobile: formatDisplayMobile(account.mobile),
    };

    // If customer has no linked records across any shop
    if (linkedCustomerIds.length === 0) {
      return {
        success: true,
        data: {
          customer: customerInfo,
          linkedShops: [],
          bills: [],
          summary: {
            totalPurchases: 0,
            totalPaid: 0,
            totalOutstanding: 0,
            totalInvoices: 0,
            linkedShopsCount: 0,
          },
          notifications: [],
        },
      };
    }

    // 1. Fetch shops associated with the linked customer records
    const shopIds = Array.from(new Set(linkedRecords.map((c) => c.shop_id).filter(Boolean)));
    const { data: shopsData } = await adminClient
      .from('shops')
      .select('id, name, address, village, district, state, phone, mobile, email, gstin, logo_url, invoice_terms, bank_name, account_number, ifsc_code, upi_id')
      .in('id', shopIds);

    const shopsMap = new Map<string, any>();
    (shopsData || []).forEach((s) => shopsMap.set(s.id, s));

    // 2. Fetch all sales for these linked customer IDs across all shops
    const { data: salesData, error: salesErr } = await adminClient
      .from('sales')
      .select('id, invoice_number, shop_id, customer_id, sale_date, created_at, total_amount, paid_amount, payment_status, payment_method, status, notes')
      .in('customer_id', linkedCustomerIds)
      .order('sale_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (salesErr) {
      console.error('Error fetching customer bills:', salesErr);
      return { success: false, error: 'Failed to fetch purchase history.' };
    }

    const bills: CustomerPortalBillSummary[] = [];
    let totalPurchases = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    const shopBillCounts = new Map<string, number>();

    for (const sale of salesData || []) {
      const shop = shopsMap.get(sale.shop_id) || {};
      const { status, paymentStatus, paymentMethod, paidAmount, balanceDue } = resolveSaleStatusAndPayment(sale);

      const totalAmt = Number(sale.total_amount || 0);

      if (status !== 'CANCELLED') {
        totalPurchases += totalAmt;
        totalPaid += paidAmount;
        totalOutstanding += balanceDue;
      }

      const count = shopBillCounts.get(sale.shop_id) || 0;
      shopBillCounts.set(sale.shop_id, count + 1);

      bills.push({
        id: sale.id,
        invoice_number: sale.invoice_number || `INV-${sale.id.slice(0, 8).toUpperCase()}`,
        shop_id: sale.shop_id,
        shop_name: shop.name || 'Krushi Kendra',
        customer_id: sale.customer_id,
        customer_name: account.name || 'Customer',
        sale_date: sale.sale_date || sale.created_at || new Date().toISOString(),
        total_amount: totalAmt,
        paid_amount: paidAmount,
        balance_due: balanceDue,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        status,
        return_status: status === 'RETURNED' ? 'FULL' : status === 'PARTIALLY_RETURNED' ? 'PARTIAL' : 'NONE',
      });
    }

    // Format linked shops with bill counts
    const linkedShops: CustomerPortalShop[] = (shopsData || []).map((s) => ({
      ...s,
      bill_count: shopBillCounts.get(s.id) || 0,
    }));

    // 3. Fetch notifications for this customer account
    const { data: notificationsData } = await adminClient
      .from('customer_notifications')
      .select('id, shop_id, sale_id, type, title, message, is_read, created_at')
      .eq('customer_account_id', account.id)
      .order('created_at', { ascending: false })
      .limit(20);

    const notifications: CustomerPortalNotification[] = (notificationsData || []).map((n) => ({
      ...n,
      shop_name: shopsMap.get(n.shop_id)?.name || 'Krushi Kendra',
    }));

    return {
      success: true,
      data: {
        customer: customerInfo,
        linkedShops,
        bills,
        summary: {
          totalPurchases: Math.round(totalPurchases * 100) / 100,
          totalPaid: Math.round(totalPaid * 100) / 100,
          totalOutstanding: Math.round(totalOutstanding * 100) / 100,
          totalInvoices: bills.length,
          linkedShopsCount: linkedShops.length,
        },
        notifications,
      },
    };
  } catch (err: any) {
    console.error('Unexpected error in getCustomerDashboardData:', err);
    return { success: false, error: err.message || 'An unexpected error occurred.' };
  }
}

/**
 * Fetches full bill details for a specific sale.
 * Strictly verifies that the sale belongs to a customer record linked to the authenticated customer account.
 */
export async function getCustomerBillDetail(billId: string) {
  try {
    const context = await getAuthenticatedCustomerContext();

    if (!context) {
      return { success: false, error: 'User session not found. Please log in.' };
    }

    const { account, linkedCustomerIds, adminClient } = context;

    if (!billId || linkedCustomerIds.length === 0) {
      return { success: false, error: 'Bill not found or unauthorized.' };
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(billId);

    // 1. Fetch sale
    let saleQuery = adminClient.from('sales').select('*');
    if (isUuid) {
      saleQuery = saleQuery.eq('id', billId);
    } else {
      saleQuery = saleQuery.eq('invoice_number', billId);
    }

    const { data: sale, error: saleErr } = await saleQuery.maybeSingle();

    if (saleErr || !sale) {
      return { success: false, error: 'Bill not found.' };
    }

    // STRICT AUTHORIZATION CHECK:
    // Verify that the sale's customer_id belongs to the authenticated customer's linked records
    if (!sale.customer_id || !linkedCustomerIds.includes(sale.customer_id)) {
      return { success: false, error: 'Unauthorized. You do not have permission to view this bill.' };
    }

    // 2. Fetch Shop details
    const { data: shop } = await adminClient
      .from('shops')
      .select('*')
      .eq('id', sale.shop_id)
      .maybeSingle();

    // 3. Fetch Customer record
    const { data: customerRecord } = await adminClient
      .from('customers')
      .select('*')
      .eq('id', sale.customer_id)
      .maybeSingle();

    // 4. Fetch Sale Items with product metadata
    const { data: rawItems } = await adminClient
      .from('sale_items')
      .select('*, product:products(name, pack_size, unit, hsn_code, manufacturer, brand:brands(name, manufacturer))')
      .eq('sale_id', sale.id);

    const items = (rawItems || []).map((it: any) => {
      const p = it.product || {};
      const rawName = it.product_name || p.name || 'Product';
      const packSize = it.pack_size || p.pack_size || null;
      const unit = it.unit || p.unit || null;
      const displayName = formatProductNameWithSize(rawName, packSize, unit) || rawName;

      const qty = Number(it.quantity || 0);
      const unitPrice = Number(it.unit_price ?? it.selling_price ?? it.rate ?? 0);
      const discount = Number(it.discount_amount ?? it.discount ?? 0);
      const gstRate = Number(it.gst_rate ?? p.gst_rate ?? 0);
      const totalAmount = Number(it.total_amount ?? it.total_price ?? (qty * unitPrice - discount));

      const taxableAmount = gstRate > 0
        ? Math.round((totalAmount / (1 + gstRate / 100)) * 100) / 100
        : totalAmount;
      const taxAmount = Math.round((totalAmount - taxableAmount) * 100) / 100;
      const cgstAmount = Math.round((taxAmount / 2) * 100) / 100;
      const sgstAmount = Math.round((taxAmount - cgstAmount) * 100) / 100;

      const mfg = it.manufacturer || p.manufacturer || p.brand?.manufacturer || p.brand?.name || '-';

      return {
        id: it.id,
        sale_id: it.sale_id,
        product_id: it.product_id,
        product_name: rawName,
        displayName,
        pack_size: packSize,
        unit,
        manufacturer: mfg,
        hsn_code: it.hsn_code || p.hsn_code || '-',
        batch_number: it.batch_number || it.batch || '-',
        expiry_date: it.expiry_date || it.expiry || null,
        quantity: qty,
        unit_price: unitPrice,
        rate: unitPrice,
        rateWithGst: unitPrice,
        discount_amount: discount,
        gst_rate: gstRate,
        gstRate,
        taxable_amount: taxableAmount,
        taxableAmount,
        tax_amount: taxAmount,
        cgst_amount: cgstAmount,
        cgstAmount,
        sgst_amount: sgstAmount,
        sgstAmount,
        total_amount: totalAmount,
        total: totalAmount,
        returned_quantity: Number(it.returned_quantity || 0),
      };
    });

    // 5. Fetch Payments
    const { data: paymentsData } = await adminClient
      .from('payments')
      .select('*')
      .eq('sale_id', sale.id)
      .order('payment_date', { ascending: true });

    const payments = paymentsData || [];

    // 6. Fetch Sale Returns & Return Items
    const { data: returnsData } = await adminClient
      .from('sale_returns')
      .select('*, items:sale_return_items(*, product:products(name, pack_size, unit))')
      .eq('sale_id', sale.id)
      .order('return_date', { ascending: false });

    const saleReturns = (returnsData || []).map((ret: any) => ({
      ...ret,
      items: (ret.items || []).map((rItem: any) => {
        const rp = rItem.product || {};
        return {
          ...rItem,
          displayName: formatProductNameWithSize(rp.name, rp.pack_size, rp.unit) || rp.name || 'Product',
        };
      }),
    }));

    const { status, paymentStatus, paymentMethod, paidAmount, balanceDue } = resolveSaleStatusAndPayment({
      ...sale,
      payments,
    });

    // Construct unified normalized sale object compatible with InvoiceRenderer
    const normalizedSale = {
      ...sale,
      id: sale.id,
      invoice_number: sale.invoice_number || `INV-${sale.id.slice(0, 8).toUpperCase()}`,
      invoiceNumber: sale.invoice_number || `INV-${sale.id.slice(0, 8).toUpperCase()}`,
      sale_date: sale.sale_date || sale.created_at,
      created_at: sale.created_at,
      status,
      payment_status: paymentStatus,
      payment_mode: paymentMethod,
      payment_method: paymentMethod,
      total_amount: Number(sale.total_amount || 0),
      paid_amount: paidAmount,
      balance_due: balanceDue,
      customer: {
        id: customerRecord?.id || sale.customer_id,
        name: customerRecord?.name || account.name || 'Customer',
        phone: customerRecord?.mobile || account.mobile || '',
        mobile: customerRecord?.mobile || account.mobile || '',
        village: customerRecord?.village || account.village || '',
        district: customerRecord?.district || '',
        state: customerRecord?.state || '',
        balance: customerRecord?.balance || 0,
      },
      shop: shop || {},
      items,
      sale_items: items,
      payments,
      returns: saleReturns,
      sale_returns: saleReturns,
      adjustments: Array.isArray(sale.adjustments) ? sale.adjustments : [],
      notes: sale.notes || '',
    };

    // Format shop details for ReferenceTaxInvoice
    const shopDetails = {
      shopName: shop?.name || 'Krushi Kendra',
      proprietorName: shop?.proprietor_name || '',
      phone: shop?.phone || shop?.mobile || '',
      email: shop?.email || '',
      gstin: shop?.gstin || '',
      address: shop?.address || '',
      village: shop?.village || '',
      taluka: shop?.taluka || '',
      district: shop?.district || '',
      state: shop?.state || 'Maharashtra',
      pincode: shop?.pincode || '',
      fertilizerLicense: shop?.fertilizer_license || '',
      pesticideLicense: shop?.pesticide_license || '',
      seedLicense: shop?.seed_license || '',
      bankName: shop?.bank_name || '',
      accountNumber: shop?.account_number || '',
      ifscCode: shop?.ifsc_code || '',
      upiId: shop?.upi_id || '',
      invoiceTerms: shop?.invoice_terms || '',
      logoUrl: shop?.logo_url || null,
      defaultBillFormat: shop?.default_bill_format || 'A5',
    };

    return {
      success: true,
      data: {
        sale: normalizedSale,
        shop: shopDetails,
        items,
        payments,
        returns: saleReturns,
        customer: normalizedSale.customer,
      },
    };
  } catch (err: any) {
    console.error('Unexpected error in getCustomerBillDetail:', err);
    return { success: false, error: err.message || 'An unexpected error occurred.' };
  }
}

/**
 * Marks a notification as read for the authenticated customer.
 */
export async function markCustomerNotificationRead(notificationId: string) {
  try {
    const context = await getAuthenticatedCustomerContext();
    if (!context) {
      return { success: false, error: 'User session not found.' };
    }

    const { account, adminClient } = context;

    const { error } = await adminClient
      .from('customer_notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('customer_account_id', account.id);

    if (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error in markCustomerNotificationRead:', err);
    return { success: false, error: err.message || 'Failed to update notification.' };
  }
}
