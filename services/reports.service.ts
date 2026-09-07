import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isPlaceholderMode, normalizeSale } from '@/services/sales.service';
import { getStoredDemoSales } from '@/lib/demo-storage';
import { MOCK_SALES } from '@/lib/mock-data';

export function resolveSalePaymentMode(sale: any, paymentsList?: any[]): string {
  if (!sale) return 'N/A';

  // 1. Check paymentsList if provided or sale.payments array
  const payments = (Array.isArray(paymentsList) && paymentsList.length > 0)
    ? paymentsList
    : (Array.isArray(sale.payments) && sale.payments.length > 0 ? sale.payments : null);

  if (payments && payments.length > 0) {
    const positivePayments = payments.filter((p: any) => Number(p.amount || 0) > 0);
    const targetPayments = positivePayments.length > 0 ? positivePayments : payments;

    const methods = new Set(
      targetPayments.map((p: any) =>
        String(p.payment_method || p.method || '').toUpperCase().replace(/[-_]/g, ' ').trim()
      ).filter(Boolean)
    );

    // If multiple different methods were used, or has both a payment and credit balance -> PARTIAL
    const nonCreditMethods = Array.from(methods).filter(m => m !== 'CREDIT');
    const hasCredit = methods.has('CREDIT');
    if (nonCreditMethods.length > 1 || (nonCreditMethods.length >= 1 && hasCredit)) {
      return 'PARTIAL';
    }

    if (methods.size === 1) {
      const singleMethod = Array.from(methods)[0];
      if (singleMethod === 'CASH') return 'CASH';
      if (singleMethod === 'UPI') return 'UPI';
      if (singleMethod === 'CARD' || singleMethod === 'DEBIT CARD' || singleMethod === 'CREDIT CARD') return 'CARD';
      if (singleMethod === 'BANK TRANSFER' || singleMethod === 'BANK' || singleMethod === 'NET BANKING' || singleMethod === 'NEFT' || singleMethod === 'RTGS') return 'BANK TRANSFER';
      if (singleMethod === 'CREDIT' || singleMethod === 'UDHAAR' || singleMethod === 'DUE') return 'CREDIT';
      if (singleMethod === 'PARTIAL' || singleMethod === 'PARTIAL PAYMENT' || singleMethod === 'SPLIT') return 'PARTIAL';
    }
  }

  // 2. Check explicit partial payment metadata in partial_payment / partialPayment or notes
  let partialObj = sale.partial_payment || sale.partialPayment || null;
  if (!partialObj && sale.notes && typeof sale.notes === 'string') {
    try {
      const trimmed = sale.notes.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = JSON.parse(trimmed);
        if (parsed.partialPayment) partialObj = parsed.partialPayment;
      }
    } catch {}
  }

  if (partialObj) {
    const totalPaid = Number(partialObj.total_paid ?? partialObj.totalPaid ?? 0);
    const rem = Number(partialObj.remaining ?? 0);
    if (totalPaid > 0 && rem > 0) {
      return 'PARTIAL';
    }
    const hasCash = Number(partialObj.cash || 0) > 0;
    const hasUpi = Number(partialObj.upi || 0) > 0;
    const hasBank = Number(partialObj.bank_transfer || partialObj.bankTransfer || 0) > 0;
    const splitCount = [hasCash, hasUpi, hasBank].filter(Boolean).length;
    if (splitCount > 1) {
      return 'PARTIAL';
    }
  }

  // 3. Check sale.payment_mode or sale.payment_method
  const rawMode = sale.payment_mode || sale.payment_method;
  if (rawMode) {
    const clean = String(rawMode).toUpperCase().replace(/[-_]/g, ' ').trim();
    if (clean === 'CASH') return 'CASH';
    if (clean === 'UPI') return 'UPI';
    if (clean === 'CARD' || clean === 'DEBIT CARD' || clean === 'CREDIT CARD') return 'CARD';
    if (clean === 'BANK TRANSFER' || clean === 'BANK' || clean === 'NET BANKING' || clean === 'NEFT' || clean === 'RTGS') return 'BANK TRANSFER';
    if (clean === 'CREDIT' || clean === 'UDHAAR' || clean === 'DUE') return 'CREDIT';
    if (clean === 'PARTIAL' || clean === 'PARTIAL PAYMENT' || clean === 'SPLIT') return 'PARTIAL';
    if (clean && clean !== 'PAID' && clean !== 'COMPLETED') return clean;
  }

  // 4. Check payment_status
  const rawStatus = (sale.payment_status || '').toString().toLowerCase().trim();
  if (rawStatus === 'partial') return 'PARTIAL';
  if (rawStatus === 'credit' || rawStatus === 'unpaid') return 'CREDIT';

  // 5. If genuinely missing / cannot be determined
  return 'N/A';
}

export async function getSalesReport(shopId: string, params: { period?: string, dateFrom?: string, dateTo?: string } = {}) {
  try {
    let sales: any[] = [];
    if (isPlaceholderMode()) {
      let store = getStoredDemoSales(normalizeSale);
      if (store.length === 0) {
        store = MOCK_SALES.map(normalizeSale);
      }
      sales = store.filter((s: any) => {
        const sStatus = (s.status || '').toUpperCase();
        if (sStatus === 'CANCELLED') return false;
        const sDate = s.sale_date || s.created_at || '';
        const dStr = sDate.split('T')[0];
        if (params.dateFrom && dStr && dStr < params.dateFrom) return false;
        if (params.dateTo && dStr && dStr > params.dateTo) return false;
        return true;
      });
      sales = sales.map(s => ({
        ...s,
        payment_mode: resolveSalePaymentMode(s),
        payment_method: resolveSalePaymentMode(s),
      }));
    } else {
      const supabase = await createServerSupabaseClient();
      let query = supabase
        .from('sales')
        .select('*, customer:customers(name, mobile, village), sale_items(*, product:products(name, sku, unit))')
        .eq('shop_id', shopId)
        .eq('status', 'completed');

      if (params.dateFrom) query = query.gte('sale_date', params.dateFrom);
      if (params.dateTo) query = query.lte('sale_date', params.dateTo);

      query = query.order('sale_date', { ascending: false });

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching sales report:", error);
        return { sales: [], totalRevenue: 0, totalTax: 0, totalProfit: 0, avgBillValue: 0, totalCount: 0, chartData: [] };
      }

      const rawSales = data || [];
      const saleIds = rawSales.map((s: any) => s.id);
      let paymentsMap = new Map<string, any[]>();

      if (saleIds.length > 0) {
        try {
          const { data: dbPayments } = await supabase
            .from('payments')
            .select('reference_id, payment_method, amount, payment_type')
            .in('reference_id', saleIds);
          if (Array.isArray(dbPayments)) {
            for (const p of dbPayments) {
              const list = paymentsMap.get(p.reference_id) || [];
              list.push(p);
              paymentsMap.set(p.reference_id, list);
            }
          }
        } catch (e) {
          console.warn("Failed to fetch payments for sales report:", e);
        }
      }

      sales = rawSales.map((s: any) => {
        const mode = resolveSalePaymentMode(s, paymentsMap.get(s.id));
        return {
          ...s,
          payment_mode: mode,
          payment_method: mode,
        };
      });
    }

    const totalCount = sales.length;
    const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
    const totalTax = sales.reduce((acc, s) => acc + Number(s.tax_amount || 0), 0);
    const totalProfit = sales.reduce((acc, s) => acc + Number(s.profit_amount || 0), 0);
    const avgBillValue = totalCount > 0 ? totalRevenue / totalCount : 0;

    // Group for chart
    const dateMap = new Map<string, { date: string, revenue: number, profit: number }>();
    for (const sale of sales) {
      const dateStr = sale.sale_date ? new Date(sale.sale_date).toISOString().split('T')[0] : 'N/A';
      const current = dateMap.get(dateStr) || { date: dateStr, revenue: 0, profit: 0 };
      current.revenue += Number(sale.total_amount || 0);
      current.profit += Number(sale.profit_amount || 0);
      dateMap.set(dateStr, current);
    }

    const chartData = Array.from(dateMap.values()).reverse();

    return { sales, totalRevenue, totalTax, totalProfit, avgBillValue, totalCount, chartData };
  } catch (error) {
    console.error("Failed to load sales report:", error);
    return { sales: [], totalRevenue: 0, totalTax: 0, totalProfit: 0, avgBillValue: 0, totalCount: 0, chartData: [] };
  }
}

export async function getInventoryReport(shopId: string, params: any = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(name), batches:product_batches(*)')
      .eq('shop_id', shopId)
      .order('name', { ascending: true });

    if (error) {
      console.error("Error fetching inventory report:", error);
      return { products: [], totalValue: 0, lowStockCount: 0 };
    }

    const products = data || [];
    const totalValue = products.reduce((acc, p) => acc + (Number(p.current_stock || 0) * Number(p.purchase_price || 0)), 0);
    const lowStockCount = products.filter(p => Number(p.current_stock || 0) <= Number(p.min_stock || 5)).length;

    return { products, totalValue, lowStockCount };
  } catch (error) {
    console.error("Failed to load inventory report:", error);
    return { products: [], totalValue: 0, lowStockCount: 0 };
  }
}

export async function getFinancialReport(shopId: string, params: { dateFrom?: string, dateTo?: string } = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    let expenseQuery = supabase
      .from('expenses')
      .select('id, date, amount, description, payment_method, category:expense_categories(name)')
      .eq('shop_id', shopId);

    if (params.dateFrom) expenseQuery = expenseQuery.gte('date', params.dateFrom);
    if (params.dateTo) expenseQuery = expenseQuery.lte('date', params.dateTo);

    expenseQuery = expenseQuery.order('date', { ascending: false });

    const [salesReport, expenseRes] = await Promise.all([
      getSalesReport(shopId, params),
      expenseQuery
    ]);

    const expenses = expenseRes.data || [];
    const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const grossProfit = salesReport.totalProfit;
    const netProfit = grossProfit - totalExpenses;

    return { 
      revenue: salesReport.totalRevenue, 
      totalExpenses, 
      grossProfit, 
      netProfit,
      salesCount: salesReport.totalCount,
      sales: salesReport.sales,
      expenses
    };
  } catch (error) {
    console.error("Failed to load financial report:", error);
    return { revenue: 0, totalExpenses: 0, grossProfit: 0, netProfit: 0, salesCount: 0, sales: [], expenses: [] };
  }
}

export async function getCustomerReport(shopId: string, params: any = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
      .order('total_purchases', { ascending: false });

    if (error) {
      console.error("Error fetching customer report:", error);
      return { customers: [] };
    }
    return { customers: data || [] };
  } catch (error) {
    console.error("Failed to load customer report:", error);
    return { customers: [] };
  }
}

export async function getSupplierReport(shopId: string, params: any = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('shop_id', shopId)
      .order('total_purchases', { ascending: false });

    if (error) {
      console.error("Error fetching supplier report:", error);
      return { suppliers: [] };
    }
    return { suppliers: data || [] };
  } catch (error) {
    console.error("Failed to load supplier report:", error);
    return { suppliers: [] };
  }
}

export async function getProductSalesReport(
  shopId: string,
  productId: string,
  params: { dateFrom?: string; dateTo?: string } = {}
) {
  try {
    if (isPlaceholderMode()) {
      const store = getStoredDemoSales(normalizeSale);
      const matchingSales = store.filter((s: any) => {
        const sStatus = (s.status || '').toUpperCase();
        if (sStatus === 'CANCELLED') return false;
        const sDate = s.sale_date || s.created_at || '';
        const dStr = sDate.split('T')[0];
        if (params.dateFrom && dStr && dStr < params.dateFrom) return false;
        if (params.dateTo && dStr && dStr > params.dateTo) return false;
        return true;
      });

      let items: any[] = [];
      let productInfo: any = null;

      for (const s of matchingSales) {
        const sItems = s.items || s.sale_items || [];
        for (const it of sItems) {
          const itProdId = it.product_id || it.id || it.product?.id;
          if (itProdId === productId || it.name?.toLowerCase().includes(productId.toLowerCase())) {
            if (!productInfo && (it.product || it.name)) {
              productInfo = it.product || { name: it.name, sku: it.sku, unit: it.unit };
            }
            const mode = resolveSalePaymentMode(s);
            items.push({
              id: it.id || `si-${Date.now()}`,
              invoice_number: s.invoice_number || s.invoiceNumber || '-',
              sale_date: s.sale_date || s.created_at,
              customer_name: s.customer?.name || s.customer_name || 'Walk-in Customer',
              customer_mobile: s.customer?.mobile || s.customer?.phone || s.customer_phone || '-',
              customer_village: s.customer?.village || s.customer_village || '-',
              quantity: Number(it.quantity || 1),
              unit_price: Number(it.unit_price ?? it.rate ?? it.selling_price ?? 0),
              gst_rate: Number(it.gst_rate ?? it.gst ?? 0),
              gst_amount: Number(it.tax_amount || it.total_tax || (Number(it.cgst || 0) + Number(it.sgst || 0)) || 0),
              total_amount: Number(it.total_amount ?? it.total_price ?? (Number(it.quantity || 1) * Number(it.unit_price || 0))),
              profit_amount: Number(it.profit_amount || 0),
              payment_status: (s.payment_status || 'PAID').toUpperCase(),
              payment_mode: mode,
              payment_method: mode,
            });
          }
        }
      }

      const totalQuantity = items.reduce((acc: number, it: any) => acc + it.quantity, 0);
      const totalSales = items.reduce((acc: number, it: any) => acc + it.total_amount, 0);
      const totalGST = items.reduce((acc: number, it: any) => acc + it.gst_amount, 0);
      const uniqueInvoices = new Set(items.map((it: any) => it.invoice_number).filter((inv: string) => inv && inv !== '-')).size;

      return {
        product: productInfo,
        items,
        totalQuantity,
        totalSales,
        totalGST,
        totalInvoices: uniqueInvoices
      };
    }

    const supabase = await createServerSupabaseClient();
    
    // 1. Fetch Product details for verification and metadata
    const { data: product, error: prodError } = await supabase
      .from('products')
      .select('*, category:categories(name)')
      .eq('id', productId)
      .eq('shop_id', shopId)
      .maybeSingle();

    if (prodError) {
      console.error("Error fetching product details for sales report:", prodError);
    }

    // 2. Fetch sale items joined with sales
    let rawItems: any[] = [];

    // Primary: Join sale_items with sales
    let query = supabase
      .from('sale_items')
      .select('*, sales!inner(id, invoice_number, sale_date, payment_status, status, shop_id, notes, customer:customers(name, mobile, village))')
      .eq('product_id', productId)
      .eq('sales.shop_id', shopId)
      .eq('sales.status', 'completed');

    if (params.dateFrom) query = query.gte('sales.sale_date', `${params.dateFrom}T00:00:00.000Z`);
    if (params.dateTo) query = query.lte('sales.sale_date', `${params.dateTo}T23:59:59.999Z`);

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (!error && Array.isArray(data)) {
      rawItems = data;
    } else {
      console.warn("Direct join query issue, using resilient fallback:", error?.message);
      
      // Fallback: Query completed sales for the shop, then match sale_items
      let salesQuery = supabase
        .from('sales')
        .select('id, invoice_number, sale_date, payment_status, status, shop_id, notes, customer:customers(name, mobile, village)')
        .eq('shop_id', shopId)
        .eq('status', 'completed');

      if (params.dateFrom) salesQuery = salesQuery.gte('sale_date', `${params.dateFrom}T00:00:00.000Z`);
      if (params.dateTo) salesQuery = salesQuery.lte('sale_date', `${params.dateTo}T23:59:59.999Z`);

      const { data: shopSales, error: salesErr } = await salesQuery;

      if (!salesErr && Array.isArray(shopSales) && shopSales.length > 0) {
        const saleIds = shopSales.map((s: any) => s.id);
        const salesMap = new Map<string, any>(shopSales.map((s: any) => [s.id, s]));

        const { data: dbSaleItems, error: itemsErr } = await supabase
          .from('sale_items')
          .select('*')
          .eq('product_id', productId)
          .in('sale_id', saleIds)
          .order('created_at', { ascending: false });

        if (!itemsErr && Array.isArray(dbSaleItems)) {
          rawItems = dbSaleItems.map((it: any) => ({
            ...it,
            sales: salesMap.get(it.sale_id)
          }));
        }
      }
    }

    // Fetch payments for all involved sales
    const distinctSaleIds = Array.from(new Set(rawItems.map((it: any) => it.sales?.id || it.sale_id).filter(Boolean)));
    let paymentsMap = new Map<string, any[]>();
    if (distinctSaleIds.length > 0) {
      try {
        const { data: dbPayments } = await supabase
          .from('payments')
          .select('reference_id, payment_method, amount, payment_type')
          .in('reference_id', distinctSaleIds);
        if (Array.isArray(dbPayments)) {
          for (const p of dbPayments) {
            const list = paymentsMap.get(p.reference_id) || [];
            list.push(p);
            paymentsMap.set(p.reference_id, list);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch payments for product sales report:", e);
      }
    }

    const items = rawItems.map((item: any) => {
      const saleObj = item.sales || item.sale || {};
      const customerObj = saleObj.customer || {};
      const mode = resolveSalePaymentMode(saleObj, paymentsMap.get(saleObj.id));
      return {
        id: item.id,
        invoice_number: saleObj.invoice_number || '-',
        sale_date: saleObj.sale_date || item.created_at,
        customer_name: customerObj.name || 'Walk-in Customer',
        customer_mobile: customerObj.mobile || '-',
        customer_village: customerObj.village || '-',
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
        gst_rate: Number(item.gst_rate || 0),
        gst_amount: Number(item.tax_amount || (Number(item.cgst_amount || 0) + Number(item.sgst_amount || 0)) || 0),
        total_amount: Number(item.total_amount || 0),
        profit_amount: Number(item.profit_amount || 0),
        payment_status: (saleObj.payment_status || 'PAID').toUpperCase(),
        payment_mode: mode,
        payment_method: mode,
      };
    });

    const totalQuantity = items.reduce((acc: number, it: any) => acc + it.quantity, 0);
    const totalSales = items.reduce((acc: number, it: any) => acc + it.total_amount, 0);
    const totalGST = items.reduce((acc: number, it: any) => acc + it.gst_amount, 0);
    const uniqueInvoices = new Set(items.map((it: any) => it.invoice_number).filter((inv: string) => inv && inv !== '-')).size;

    return {
      product,
      items,
      totalQuantity,
      totalSales,
      totalGST,
      totalInvoices: uniqueInvoices
    };
  } catch (error) {
    console.error("Failed to load product sales report:", error);
    return { product: null, items: [], totalQuantity: 0, totalSales: 0, totalGST: 0, totalInvoices: 0 };
  }
}

export async function exportReport(shopId: string, params: any = {}) {
  return { success: true, downloadUrl: '' };
}

