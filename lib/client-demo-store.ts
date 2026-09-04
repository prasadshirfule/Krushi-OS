import { MOCK_CUSTOMERS, MOCK_SALES, MOCK_PRODUCTS, MOCK_CATEGORIES, MOCK_BRANDS } from '@/lib/mock-data';
import { calculateItemTotal, calculateBillTotal } from '@/lib/calculations';
import { formatDDMMYYYYtoDB, parseProductSize, formatProductPackDisplay } from '@/lib/validations';


export const KRUSHI_DEMO_CUSTOMERS_KEY = 'krushi_demo_customers';
export const KRUSHI_DEMO_SALES_KEY = 'krushi_demo_sales';
export const KRUSHI_DEMO_PRODUCTS_KEY = 'krushi_demo_products';
export const KRUSHI_DEMO_CATEGORIES_KEY = 'krushi_demo_categories';
export const KRUSHI_DEMO_BRANDS_KEY = 'krushi_demo_brands';

/** Check if running in browser and with demo / placeholder credentials */
export function isClientDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !url || url.includes('placeholder');
}

/** Normalize customer object consistently */
export function normalizeDemoCustomer(c: any) {
  const phone = c.phone || c.mobile || '';
  const mobile = c.mobile || c.phone || '';
  const outstanding = Number(c.outstanding ?? c.outstanding_balance ?? 0);
  const creditLimit = Number(c.credit_limit ?? c.creditLimit ?? 50000);
  const totalPurchases = Number(c.total_purchases ?? c.totalPurchases ?? 0);
  const farmSize = c.farm_size || c.farmSize || (c.land_acres ? `${c.land_acres} Acres` : '');
  const crops = c.crops || c.crop_details || '';

  return {
    ...c,
    id: String(c.id),
    name: c.name,
    phone,
    mobile,
    village: c.village || '',
    address: c.address || '',
    farm_size: farmSize,
    farmSize,
    crops,
    notes: c.notes || '',
    credit_limit: creditLimit,
    creditLimit,
    outstanding,
    outstanding_balance: outstanding,
    total_purchases: totalPurchases,
    totalPurchases,
    is_active: c.is_active !== false,
    shop_id: c.shop_id || 'demo-shop-1',
    created_at: c.created_at || new Date().toISOString(),
    updated_at: c.updated_at || new Date().toISOString(),
  };
}

/** Normalize sale object consistently */
export function normalizeDemoSale(sale: any) {
  const items = sale.items || sale.sale_items || [];
  const total = Number(sale.total_amount ?? sale.grand_total ?? sale.totalAmount ?? sale.payableAmount ?? 0);
  return {
    ...sale,
    grand_total: total,
    total_amount: total,
    totalAmount: total,
    payableAmount: total,
    items: items.map((it: any) => ({
      ...it,
      unit_price: Number(it.unit_price ?? it.unitPrice ?? it.selling_price ?? it.rate ?? 0),
      selling_price: Number(it.selling_price ?? it.unit_price ?? it.unitPrice ?? it.rate ?? 0),
      rate: Number(it.rate ?? it.unit_price ?? it.selling_price ?? 0),
      discount_percent: Number(it.discount_percent ?? it.discountPercent ?? it.discount ?? 0),
      gst_rate: Number(it.gst_rate ?? it.gstRate ?? it.gst ?? 0),
      total_amount: Number(it.total_amount ?? it.totalAmount ?? it.total_price ?? ((it.quantity || 1) * (it.unit_price || 0))),
      total_price: Number(it.total_price ?? it.total_amount ?? it.totalAmount ?? ((it.quantity || 1) * (it.unit_price || 0))),
    })),
    sale_items: items,
    status: sale.status || (sale.payment_status === 'PAID' ? 'COMPLETED' : (sale.payment_status === 'UNPAID' ? 'PENDING' : 'COMPLETED')),
    sale_date: sale.sale_date || sale.created_at,
    created_at: sale.created_at || sale.sale_date,
  };
}

/** Helper to check if two dates fall on the same calendar day */
export function isSameDay(dateA: string | Date, dateB: string | Date = new Date()): boolean {
  try {
    const da = typeof dateA === 'string' ? new Date(dateA) : dateA;
    const db = typeof dateB === 'string' ? new Date(dateB) : dateB;
    if (isNaN(da.getTime()) || isNaN(db.getTime())) return false;
    return (
      da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
    );
  } catch {
    return false;
  }
}

/* ═════════════════════════════════════════════════════════
   CUSTOMER OPERATIONS (Client Demo Store)
═════════════════════════════════════════════════════════ */

export function getDemoCustomersClient(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KRUSHI_DEMO_CUSTOMERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeDemoCustomer);
      }
    }
  } catch (err) {
    console.error('Error reading demo customers from localStorage:', err);
  }

  // Initialize with MOCK_CUSTOMERS if empty
  const initial = MOCK_CUSTOMERS.map(normalizeDemoCustomer);
  try {
    localStorage.setItem(KRUSHI_DEMO_CUSTOMERS_KEY, JSON.stringify(initial));
  } catch {}
  return initial;
}

export function saveDemoCustomerClient(data: {
  name: string;
  mobile?: string | null;
  phone?: string | null;
  village?: string | null;
  address?: string | null;
  farm_size?: string | null;
  crops?: string | null;
  notes?: string | null;
}): any {
  const current = getDemoCustomersClient();
  const id = `cust-${Date.now()}`;
  const newCust = normalizeDemoCustomer({
    id,
    shop_id: 'demo-shop-1',
    name: data.name,
    phone: data.mobile || data.phone || '',
    mobile: data.mobile || data.phone || '',
    village: data.village || '',
    address: data.address || '',
    farm_size: data.farm_size || '',
    farmSize: data.farm_size || '',
    crops: data.crops || '',
    notes: data.notes || '',
    credit_limit: 50000,
    outstanding: 0,
    outstanding_balance: 0,
    total_purchases: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const updated = [newCust, ...current];
  try {
    localStorage.setItem(KRUSHI_DEMO_CUSTOMERS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('krushi-customers-updated', { detail: newCust }));
  } catch (err) {
    console.error('Error saving demo customer to localStorage:', err);
  }
  return newCust;
}

export function updateDemoCustomerClient(id: string, data: any): any {
  const current = getDemoCustomersClient();
  const idx = current.findIndex(c => c.id === id);
  if (idx === -1) return null;

  const updated = normalizeDemoCustomer({
    ...current[idx],
    ...data,
    name: data.name !== undefined ? data.name : current[idx].name,
    phone: data.mobile !== undefined ? data.mobile : (data.phone !== undefined ? data.phone : current[idx].phone),
    mobile: data.mobile !== undefined ? data.mobile : (data.phone !== undefined ? data.phone : current[idx].mobile),
    updated_at: new Date().toISOString(),
  });

  current[idx] = updated;
  try {
    localStorage.setItem(KRUSHI_DEMO_CUSTOMERS_KEY, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('krushi-customers-updated', { detail: updated }));
  } catch (err) {
    console.error('Error updating demo customer in localStorage:', err);
  }
  return updated;
}

export function deleteDemoCustomerClient(id: string): boolean {
  const current = getDemoCustomersClient();
  const filtered = current.filter(c => c.id !== id);
  try {
    localStorage.setItem(KRUSHI_DEMO_CUSTOMERS_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent('krushi-customers-updated', { detail: { id, deleted: true } }));
    return true;
  } catch (err) {
    console.error('Error deleting demo customer in localStorage:', err);
    return false;
  }
}

export function getDemoCustomerByIdClient(id: string): any | null {
  const current = getDemoCustomersClient();
  return current.find(c => c.id === id) || null;
}

/* ═════════════════════════════════════════════════════════
   SALES OPERATIONS (Client Demo Store)
═════════════════════════════════════════════════════════ */

export function getDemoSalesClient(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KRUSHI_DEMO_SALES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const customers = getDemoCustomersClient();
        return parsed.map(s => {
          const norm = normalizeDemoSale(s);
          if (norm.customer_id && norm.customer_id !== 'walk-in') {
            const foundCust = customers.find(c => c.id === norm.customer_id);
            if (foundCust) {
              norm.customer = { id: foundCust.id, name: foundCust.name, phone: foundCust.phone || foundCust.mobile };
              norm.customer_name = foundCust.name;
            }
          }
          return norm;
        });
      }
    }
  } catch (err) {
    console.error('Error reading demo sales from localStorage:', err);
  }

  // Initialize with MOCK_SALES if empty
  const initial = MOCK_SALES.map(normalizeDemoSale);
  try {
    localStorage.setItem(KRUSHI_DEMO_SALES_KEY, JSON.stringify(initial));
  } catch {}
  return initial;
}

export function saveDemoSaleClient(data: any): any {
  const current = getDemoSalesClient();
  const saleId = `sale-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Invoice Number generator: scans existing invoices to get highest sequence (KOS-YYYY-NNN)
  const currentYear = new Date().getFullYear();
  let maxSeq = 0;
  for (const s of current) {
    const inv = s.invoice_number || s.invoiceNumber || '';
    const match = inv.match(/KOS-\d+-(\d+)/i);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  const nextSeq = Math.max(maxSeq + 1, current.length + 1);
  let invoiceNum = `KOS-${currentYear}-${String(nextSeq).padStart(3, '0')}`;
  let counter = nextSeq;
  while (current.some(s => s.invoice_number === invoiceNum || s.invoiceNumber === invoiceNum)) {
    counter++;
    invoiceNum = `KOS-${currentYear}-${String(counter).padStart(3, '0')}`;
  }

  // Resolve customer info
  const customerId = data.customer_id;
  let customerObj: any = null;
  let customerName = 'Walk-in Customer';
  let customerPhone = '';

  if (customerId && customerId !== 'walk-in') {
    const customers = getDemoCustomersClient();
    const found = customers.find(c => c.id === customerId);
    if (found) {
      customerObj = { id: found.id, name: found.name, phone: found.phone || found.mobile || '' };
      customerName = found.name;
      customerPhone = found.phone || found.mobile || '';
    } else if (data.customer_name || data.customer?.name) {
      customerName = data.customer_name || data.customer?.name;
      customerPhone = data.customer_phone || data.customer?.phone || '';
      customerObj = { id: customerId, name: customerName, phone: customerPhone };
    }
  } else if (data.customer_name && data.customer_name.toLowerCase() !== 'walk-in' && data.customer_name.toLowerCase() !== 'walk-in customer') {
    customerName = data.customer_name;
    customerPhone = data.customer_phone || '';
    customerObj = { id: `cust-${Date.now()}`, name: customerName, phone: customerPhone };
  } else {
    customerObj = { id: 'walk-in', name: 'Walk-in Customer', phone: '' };
    customerName = 'Walk-in Customer';
  }

  const items = (data.items || []).map((it: any, idx: number) => {
    const q = Math.max(1, Number(it.quantity) || 1);
    const rate = Number(it.unit_price ?? it.selling_price ?? it.rate ?? 0);
    const disc = Number(it.discount_percent ?? it.discount ?? 0);
    const gst = Number(it.gst_rate ?? it.gst ?? 0);
    const itemTotal = calculateItemTotal(q, rate, disc, gst);

    return {
      id: `si-${Date.now()}-${idx + 1}`,
      sale_id: saleId,
      product_id: it.product_id || it.id,
      product_name: it.product_name || it.name || 'Product',
      batch_id: it.batch_id || null,
      batch_number: it.batch_number || null,
      quantity: q,
      unit_price: rate,
      selling_price: rate,
      rate: rate,
      discount_percent: disc,
      gst_rate: gst,
      taxable_amount: itemTotal.taxableAmount,
      cgst: itemTotal.cgst,
      sgst: itemTotal.sgst,
      total_tax: itemTotal.totalTax,
      total_amount: itemTotal.total,
      total_price: itemTotal.total,
    };
  });

  const billTotals = data.totals || calculateBillTotal(items);
  const payable = Number(billTotals.payableAmount ?? billTotals.grandTotal ?? 0);
  const paymentMethod = data.payment_method || (data.payments?.[0]?.method) || 'Cash';
  const isCredit = paymentMethod.toUpperCase() === 'CREDIT';

  const newSale = normalizeDemoSale({
    id: saleId,
    saleId: saleId,
    invoice_number: invoiceNum,
    invoiceNumber: invoiceNum,
    shop_id: 'demo-shop-1',
    customer_id: customerObj.id === 'walk-in' ? null : customerObj.id,
    customer: customerObj,
    customer_name: customerName,
    items: items,
    sale_items: items,
    subtotal: Number(billTotals.subtotal || 0),
    discount_amount: Number(billTotals.totalDiscount || 0),
    tax_amount: Number(billTotals.totalTax || 0),
    cgst_total: Number(billTotals.totalCGST || 0),
    sgst_total: Number(billTotals.totalSGST || 0),
    round_off: Number(billTotals.roundOff || 0),
    total_amount: payable,
    grand_total: payable,
    totalAmount: payable,
    payableAmount: payable,
    paid_amount: isCredit ? 0 : payable,
    profit_amount: Math.round(payable * 0.15),
    payment_mode: paymentMethod,
    payment_method: paymentMethod,
    payments: data.payments || [{ method: paymentMethod, amount: payable }],
    status: 'COMPLETED',
    payment_status: isCredit ? 'UNPAID' : 'PAID',
    notes: data.notes || null,
    created_at: new Date().toISOString(),
    sale_date: new Date().toISOString(),
  });

  const updatedSales = [newSale, ...current];
  try {
    localStorage.setItem(KRUSHI_DEMO_SALES_KEY, JSON.stringify(updatedSales));
    window.dispatchEvent(new CustomEvent('krushi-sales-updated', { detail: newSale }));

    // Deduct product stock in demo store (quantity represents pieces)
    const products = getDemoProductsClient();
    let productsChanged = false;
    for (const it of items) {
      const pIdx = products.findIndex(p => p.id === it.product_id);
      if (pIdx !== -1) {
        const curStock = Number(products[pIdx].current_stock ?? products[pIdx].stock_quantity ?? 0);
        const newStock = Math.max(0, curStock - (Number(it.quantity) || 1));
        products[pIdx].current_stock = newStock;
        products[pIdx].stock_quantity = newStock;
        productsChanged = true;
      }
    }
    if (productsChanged) {
      localStorage.setItem(KRUSHI_DEMO_PRODUCTS_KEY, JSON.stringify(products));
      window.dispatchEvent(new CustomEvent('krushi-products-updated'));
    }
  } catch (err) {
    console.error('Error saving demo sale to localStorage:', err);
  }
  return newSale;
}

export function getDemoSaleByIdClient(idOrInvoice: string): any | null {
  const sales = getDemoSalesClient();
  return sales.find(s => s.id === idOrInvoice || s.invoice_number === idOrInvoice || s.invoiceNumber === idOrInvoice) || null;
}

export function getDemoSalesSummaryClient() {
  const sales = getDemoSalesClient();
  const todaySales = sales.filter(s => {
    if (s.status === 'CANCELLED') return false;
    const dateVal = s.sale_date || s.created_at;
    return dateVal ? isSameDay(dateVal) : false;
  });

  const todayRevenue = todaySales.reduce((acc: number, s: any) => {
    return acc + Number(s.total_amount ?? s.grand_total ?? 0);
  }, 0);

  return {
    todayRevenue,
    billsToday: todaySales.length,
    totalInvoices: sales.length,
    todaySales,
    sales,
  };
}

/* ═════════════════════════════════════════════════════════
   CATEGORY OPERATIONS (Client Demo Store)
═════════════════════════════════════════════════════════ */

export function getDemoCategoriesClient(): any[] {
  if (typeof window === 'undefined') return MOCK_CATEGORIES;
  try {
    const raw = localStorage.getItem(KRUSHI_DEMO_CATEGORIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading demo categories from localStorage:', err);
  }

  const initial = MOCK_CATEGORIES;
  try {
    localStorage.setItem(KRUSHI_DEMO_CATEGORIES_KEY, JSON.stringify(initial));
  } catch {}
  return initial;
}

export function saveDemoCategoryClient(data: { name: string; description?: string }): any {
  const current = getDemoCategoriesClient();
  const trimmed = data.name.trim();
  const existing = current.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;

  const id = `cat-${Date.now()}`;
  const newCat = {
    id,
    name: trimmed,
    description: data.description?.trim() || '',
    count: 0,
  };
  const updated = [...current, newCat];
  try {
    localStorage.setItem(KRUSHI_DEMO_CATEGORIES_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('krushi-categories-updated', { detail: newCat }));
  } catch (err) {
    console.error('Error saving demo category to localStorage:', err);
  }
  return newCat;
}

/* ═════════════════════════════════════════════════════════
   PRODUCT OPERATIONS (Client Demo Store)
═════════════════════════════════════════════════════════ */

export function normalizeDemoProduct(p: any) {
  const sellingPrice = Number(p.selling_price ?? p.price ?? 0);
  const purchasePrice = Number(p.purchase_price ?? 0);
  const mrp = Number(p.mrp ?? sellingPrice);
  const stock = Number(p.current_stock ?? p.stock_quantity ?? p.stock ?? 0);
  const minStock = Number(p.min_stock ?? 5);

  let category = p.category;
  if (typeof category === 'string') {
    category = { id: p.category_id || 'cat-1', name: category };
  } else if (!category && p.category_id) {
    const allCats = getDemoCategoriesClient();
    const found = allCats.find(c => c.id === p.category_id);
    category = found || { id: p.category_id, name: 'General' };
  }

  let brand = p.brand;
  if (typeof brand === 'string') {
    brand = { id: p.brand_id || 'brand-1', name: brand };
  }

  // Parse product size and packaging
  const parsed = parseProductSize(p.pack_size, p.unit);
  const sizeValue = p.product_size_value !== undefined && p.product_size_value !== null 
    ? (p.product_size_value === '' ? null : Number(p.product_size_value)) 
    : parsed.sizeValue;
  const sizeUnit = p.product_size_unit || parsed.sizeUnit;
  const packaging = p.unit || parsed.packaging || 'Piece';
  const packSize = p.pack_size || (sizeValue ? `${sizeValue} ${sizeUnit}` : (p.unit || ''));

  return {
    ...p,
    id: String(p.id),
    name: p.name,
    category_id: p.category_id || category?.id || 'cat-1',
    category: category || { id: 'cat-1', name: 'General' },
    brand_id: p.brand_id || brand?.id || null,
    brand: brand || null,
    sku: p.sku || '',
    barcode: p.barcode || '',
    description: p.description || '',
    unit: packaging,
    pack_size: packSize,
    product_size_value: sizeValue,
    product_size_unit: sizeUnit,
    hsn_code: p.hsn_code || '',
    gst_rate: Number(p.gst_rate ?? 0),
    purchase_price: purchasePrice,
    selling_price: sellingPrice,
    wholesale_price: Number(p.wholesale_price ?? sellingPrice),
    mrp: mrp,
    current_stock: stock,
    stock_quantity: stock,
    min_stock: minStock,
    is_active: p.is_active !== false,
    batches: p.batches || [],
    created_at: p.created_at || new Date().toISOString(),
    updated_at: p.updated_at || new Date().toISOString(),
  };
}

export function getDemoProductsClient(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KRUSHI_DEMO_PRODUCTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeDemoProduct);
      }
    }
  } catch (err) {
    console.error('Error reading demo products from localStorage:', err);
  }

  // Initialize from MOCK_PRODUCTS
  const initial = MOCK_PRODUCTS.map(normalizeDemoProduct);
  try {
    localStorage.setItem(KRUSHI_DEMO_PRODUCTS_KEY, JSON.stringify(initial));
  } catch {}
  return initial;
}

export function saveDemoProductClient(data: any): any {
  const current = getDemoProductsClient();
  const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const categories = getDemoCategoriesClient();
  const foundCat = categories.find(c => c.id === data.category_id);

  const initialStock = Number(data.opening_stock ?? data.current_stock ?? 0);
  const sellingPrice = Number(data.selling_price ?? 0);
  const purchasePrice = Number(data.purchase_price ?? 0);
  const dbExpiry = formatDDMMYYYYtoDB(data.expiry_date) || data.expiry_date || null;
  const batchNumber = data.batch_number || `BAT-${Date.now().toString().slice(-4)}`;

  const sizeValue = data.product_size_value !== undefined && data.product_size_value !== null && data.product_size_value !== ''
    ? Number(data.product_size_value)
    : null;
  const sizeUnit = data.product_size_unit || (sizeValue ? 'KG' : null);
  const packaging = data.unit || 'Piece';
  const packSize = data.pack_size || (sizeValue ? `${sizeValue} ${sizeUnit}` : (data.unit || ''));

  const batches = [
    {
      id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      batch_number: batchNumber,
      expiry_date: dbExpiry,
      quantity_available: initialStock,
      selling_price: sellingPrice,
      purchase_price: purchasePrice,
    }
  ];

  const newProd = normalizeDemoProduct({
    id,
    name: data.name.trim(),
    category_id: data.category_id || foundCat?.id || 'cat-1',
    category: foundCat || { id: data.category_id || 'cat-1', name: 'General' },
    brand_id: data.brand_id || null,
    brand: data.brand || null,
    sku: data.sku || `SKU-${Date.now().toString().slice(-4)}`,
    barcode: data.barcode || '',
    description: data.description || '',
    unit: packaging,
    pack_size: packSize,
    product_size_value: sizeValue,
    product_size_unit: sizeUnit,
    hsn_code: data.hsn_code || '',
    gst_rate: Number(data.gst_rate ?? 0),
    purchase_price: purchasePrice,
    selling_price: sellingPrice,
    wholesale_price: Number(data.wholesale_price ?? sellingPrice),
    mrp: Number(data.mrp ?? data.wholesale_price ?? sellingPrice),
    current_stock: initialStock,
    stock_quantity: initialStock,
    min_stock: Number(data.min_stock ?? 5),
    is_active: true,
    batch_number: batchNumber,
    expiry_date: dbExpiry,
    batches: batches,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const updated = [newProd, ...current];
  try {
    localStorage.setItem(KRUSHI_DEMO_PRODUCTS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('krushi-products-updated', { detail: newProd }));
  } catch (err) {
    console.error('Error saving demo product to localStorage:', err);
  }
  return newProd;
}

export function updateDemoProductClient(id: string, data: any): any {
  const current = getDemoProductsClient();
  const idx = current.findIndex(p => p.id === id);
  if (idx === -1) return null;

  const categories = getDemoCategoriesClient();
  const catId = data.category_id !== undefined ? data.category_id : current[idx].category_id;
  const foundCat = categories.find(c => c.id === catId);

  const initialStock = data.opening_stock !== undefined 
    ? Number(data.opening_stock) 
    : (data.current_stock !== undefined ? Number(data.current_stock) : current[idx].current_stock);
  const dbExpiry = data.expiry_date ? (formatDDMMYYYYtoDB(data.expiry_date) || data.expiry_date) : current[idx].expiry_date;
  const batchNum = data.batch_number || current[idx].batch_number || current[idx].batches?.[0]?.batch_number;

  const sizeValue = data.product_size_value !== undefined 
    ? (data.product_size_value === '' || data.product_size_value === null ? null : Number(data.product_size_value))
    : current[idx].product_size_value;
  const sizeUnit = data.product_size_unit !== undefined ? data.product_size_unit : current[idx].product_size_unit;
  const packaging = data.unit !== undefined ? data.unit : current[idx].unit;
  const packSize = data.pack_size !== undefined 
    ? data.pack_size 
    : (sizeValue ? `${sizeValue} ${sizeUnit || 'KG'}` : current[idx].pack_size);

  let updatedBatches = current[idx].batches ? [...current[idx].batches] : [];
  if (batchNum || dbExpiry) {
    if (updatedBatches.length > 0) {
      updatedBatches[0] = {
        ...updatedBatches[0],
        batch_number: batchNum || updatedBatches[0].batch_number,
        expiry_date: dbExpiry,
        quantity_available: initialStock,
        selling_price: data.selling_price !== undefined ? Number(data.selling_price) : updatedBatches[0].selling_price,
        purchase_price: data.purchase_price !== undefined ? Number(data.purchase_price) : updatedBatches[0].purchase_price,
      };
    } else if (batchNum) {
      updatedBatches = [
        {
          id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          batch_number: batchNum,
          expiry_date: dbExpiry,
          quantity_available: initialStock,
          selling_price: Number(data.selling_price ?? current[idx].selling_price),
          purchase_price: Number(data.purchase_price ?? current[idx].purchase_price),
        }
      ];
    }
  }

  const updated = normalizeDemoProduct({
    ...current[idx],
    ...data,
    category_id: catId,
    category: foundCat || current[idx].category,
    batch_number: batchNum,
    expiry_date: dbExpiry,
    batches: updatedBatches,
    selling_price: data.selling_price !== undefined ? Number(data.selling_price) : current[idx].selling_price,
    purchase_price: data.purchase_price !== undefined ? Number(data.purchase_price) : current[idx].purchase_price,
    wholesale_price: data.wholesale_price !== undefined ? Number(data.wholesale_price) : current[idx].wholesale_price,
    mrp: data.mrp !== undefined ? Number(data.mrp) : current[idx].mrp,
    current_stock: initialStock,
    stock_quantity: initialStock,
    unit: packaging,
    pack_size: packSize,
    product_size_value: sizeValue,
    product_size_unit: sizeUnit,
    min_stock: data.min_stock !== undefined ? Number(data.min_stock) : current[idx].min_stock,
    updated_at: new Date().toISOString(),
  });

  current[idx] = updated;
  try {
    localStorage.setItem(KRUSHI_DEMO_PRODUCTS_KEY, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('krushi-products-updated', { detail: updated }));
  } catch (err) {
    console.error('Error updating demo product in localStorage:', err);
  }
  return updated;
}

export function deleteDemoProductClient(id: string): boolean {

  const current = getDemoProductsClient();
  const filtered = current.filter(p => p.id !== id);
  try {
    localStorage.setItem(KRUSHI_DEMO_PRODUCTS_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent('krushi-products-updated', { detail: { id, deleted: true } }));
    return true;
  } catch (err) {
    console.error('Error deleting demo product in localStorage:', err);
    return false;
  }
}

export function getDemoProductByIdClient(id: string): any | null {
  const current = getDemoProductsClient();
  return current.find(p => p.id === id) || null;
}

export function searchDemoProductsClient(queryText: string, categoryId?: string, limit = 20): any[] {
  const current = getDemoProductsClient().filter(p => p.is_active !== false);
  let filtered = current;

  if (categoryId && categoryId !== 'all') {
    filtered = filtered.filter(p => p.category_id === categoryId || p.category?.id === categoryId);
  }

  const q = (queryText || '').trim().toLowerCase();
  if (!q) {
    return filtered.slice(0, limit);
  }

  return filtered.filter(p =>
    (p.name && p.name.toLowerCase().includes(q)) ||
    (p.sku && p.sku.toLowerCase().includes(q)) ||
    (p.barcode && p.barcode.includes(q)) ||
    (p.category?.name && p.category.name.toLowerCase().includes(q))
  ).slice(0, limit);
}

/* ═════════════════════════════════════════════════════════
   BRAND / MANUFACTURER OPERATIONS (Client Demo Store)
═════════════════════════════════════════════════════════ */

export function getDemoBrandsClient(): any[] {
  if (typeof window === 'undefined') return MOCK_BRANDS;
  try {
    const raw = localStorage.getItem(KRUSHI_DEMO_BRANDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      }
    }
  } catch (err) {
    console.error('Error reading demo brands from localStorage:', err);
  }

  const initial = [...MOCK_BRANDS];
  try {
    localStorage.setItem(KRUSHI_DEMO_BRANDS_KEY, JSON.stringify(initial));
  } catch {}
  return initial.sort((a, b) => a.name.localeCompare(b.name));
}

export function saveDemoBrandClient(data: { name: string; manufacturer?: string }): any {
  const current = getDemoBrandsClient();
  const trimmedName = data.name.trim();

  // Return existing if duplicate name
  const existing = current.find(b => b.name.toLowerCase() === trimmedName.toLowerCase());
  if (existing) return existing;

  const id = `b-${Date.now()}`;
  const newBrand = {
    id,
    name: trimmedName,
    manufacturer: data.manufacturer?.trim() || trimmedName,
    shop_id: 'demo-shop-1',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const updated = [...current, newBrand];
  try {
    localStorage.setItem(KRUSHI_DEMO_BRANDS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('krushi-brands-updated', { detail: newBrand }));
  } catch (err) {
    console.error('Error saving demo brand to localStorage:', err);
  }
  return newBrand;
}

