import {
  getDemoCustomersClient,
  saveDemoCustomerClient,
  updateDemoCustomerClient,
  deleteDemoCustomerClient,
  getDemoSalesClient,
  saveDemoSaleClient,
  getDemoSalesSummaryClient,
  KRUSHI_DEMO_CUSTOMERS_KEY,
  KRUSHI_DEMO_SALES_KEY,
  getDemoProductsClient,
  saveDemoProductClient,
  updateDemoProductClient,
  deleteDemoProductClient,
  searchDemoProductsClient,
  getDemoProductByIdClient,
  getDemoBrandsClient,
  saveDemoBrandClient,
  getDemoCategoriesClient,
  saveDemoCategoryClient,
} from '@/lib/client-demo-store';
import { 
  productSchema, 
  formatToDDMMYYYY, 
  formatDDMMYYYYtoDB, 
  isValidDDMMYYYY,
  formatProductPackDisplay,
  parseProductSize 
} from '@/lib/validations';
import { calculateItemTotal } from '@/lib/calculations';


// Set up mock window and localStorage for Node test environment
const mockStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { for (const k in mockStorage) delete mockStorage[k]; }
};

class MockCustomEvent {
  type: string;
  detail: any;
  constructor(type: string, options?: { detail: any }) {
    this.type = type;
    this.detail = options?.detail;
  }
}
(global as any).CustomEvent = MockCustomEvent;

const listeners: Record<string, Function[]> = {};
(global as any).window = {
  dispatchEvent: (event: any) => {
    (listeners[event.type] || []).forEach(fn => fn(event));
    return true;
  },
  addEventListener: (type: string, fn: Function) => {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(fn);
  },
  removeEventListener: (type: string, fn: Function) => {
    if (listeners[type]) listeners[type] = listeners[type].filter(f => f !== fn);
  }
};

async function runTests() {
  console.log('--- TEST 1: Initial Mock Customers & Sales ---');
  const custs = getDemoCustomersClient();
  console.log('Initial customers count:', custs.length);
  if (custs.length !== 3) throw new Error(`Expected 3 customers, got ${custs.length}`);

  const sales = getDemoSalesClient();
  console.log('Initial sales count:', sales.length);
  if (sales.length !== 2) throw new Error(`Expected 2 sales, got ${sales.length}`);

  const summary = getDemoSalesSummaryClient();
  console.log('Initial today revenue:', summary.todayRevenue);
  console.log('Initial bills today:', summary.billsToday);
  console.log('Initial total invoices:', summary.totalInvoices);
  if (summary.totalInvoices !== 2) throw new Error(`Expected 2 total invoices, got ${summary.totalInvoices}`);

  console.log('\n--- TEST 2: Customer Creation ("Prasad Shirfule") ---');
  const newCust = saveDemoCustomerClient({
    name: 'Prasad Shirfule',
    mobile: '9890341388',
    address: 'bakori phata wagholi, pune',
    village: 'wagholi, pune'
  });

  console.log('Created customer ID:', newCust.id);
  console.log('Created customer Name:', newCust.name);
  console.log('Created customer Mobile:', newCust.mobile);
  console.log('Created customer Address:', newCust.address);

  if (newCust.name !== 'Prasad Shirfule') throw new Error('Customer name mismatch');
  if (newCust.mobile !== '9890341388') throw new Error('Mobile mismatch');

  // Verify persistence in localStorage
  const afterCreateCusts = getDemoCustomersClient();
  if (afterCreateCusts.length !== 4) throw new Error(`Expected 4 customers, got ${afterCreateCusts.length}`);
  if (afterCreateCusts[0].name !== 'Prasad Shirfule') throw new Error('New customer should be at top');

  console.log('\n--- TEST 3: Bill Creation (Customer: Prasad Shirfule, DAP 1 bag = ₹1,350) ---');
  const bill1 = saveDemoSaleClient({
    customer_id: newCust.id,
    customer_name: newCust.name,
    customer_phone: newCust.mobile,
    payment_method: 'Cash',
    items: [
      {
        product_id: 'p-102',
        product_name: 'DAP Fertilizer 50kg (IFFCO)',
        quantity: 1,
        unit_price: 1350,
        discount_percent: 0,
        gst_rate: 5
      }
    ]
  });

  console.log('Bill 1 Invoice Number:', bill1.invoice_number);
  console.log('Bill 1 Customer Name:', bill1.customer_name);
  console.log('Bill 1 Customer ID:', bill1.customer_id);
  console.log('Bill 1 Total Amount:', bill1.total_amount);
  console.log('Bill 1 Status:', bill1.status);

  if (bill1.invoice_number !== 'KOS-2026-003') throw new Error(`Expected invoice KOS-2026-003, got ${bill1.invoice_number}`);
  if (bill1.customer_id !== newCust.id) throw new Error('Customer ID relationship not preserved');
  if (bill1.customer_name !== 'Prasad Shirfule') throw new Error('Customer name mismatch');
  if (bill1.total_amount !== 1350) throw new Error(`Expected total ₹1,350, got ${bill1.total_amount}`);
  if (bill1.status !== 'COMPLETED') throw new Error(`Expected status COMPLETED, got ${bill1.status}`);

  console.log('\n--- Statistics Check After Bill 1 ---');
  const stats1 = getDemoSalesSummaryClient();
  console.log("Today's Revenue:", stats1.todayRevenue);
  console.log('Bills Today:', stats1.billsToday);
  console.log('Total Invoices:', stats1.totalInvoices);

  if (stats1.todayRevenue !== 1350) throw new Error(`Expected ₹1,350 today revenue, got ${stats1.todayRevenue}`);
  if (stats1.billsToday !== 1) throw new Error(`Expected 1 bill today, got ${stats1.billsToday}`);
  if (stats1.totalInvoices !== 3) throw new Error(`Expected 3 total invoices, got ${stats1.totalInvoices}`);

  console.log('\n--- TEST 4: Second Bill Creation (Urea 45kg = ₹266) ---');
  const bill2 = saveDemoSaleClient({
    customer_id: 'walk-in',
    customer_name: 'Walk-in Customer',
    payment_method: 'Cash',
    items: [
      {
        product_id: 'p-103',
        product_name: 'Urea 45kg Neem Coated',
        quantity: 1,
        unit_price: 266,
        discount_percent: 0,
        gst_rate: 5
      }
    ]
  });

  console.log('Bill 2 Invoice Number:', bill2.invoice_number);
  console.log('Bill 2 Total Amount:', bill2.total_amount);

  if (bill2.invoice_number !== 'KOS-2026-004') throw new Error(`Expected invoice KOS-2026-004, got ${bill2.invoice_number}`);
  if (bill2.total_amount !== 266) throw new Error(`Expected total ₹266, got ${bill2.total_amount}`);

  console.log('\n--- Statistics Check After Bill 2 ---');
  const stats2 = getDemoSalesSummaryClient();
  console.log("Today's Revenue:", stats2.todayRevenue);
  console.log('Bills Today:', stats2.billsToday);
  console.log('Total Invoices:', stats2.totalInvoices);

  if (stats2.todayRevenue !== 1616) throw new Error(`Expected ₹1,616 today revenue (1350 + 266), got ${stats2.todayRevenue}`);
  if (stats2.billsToday !== 2) throw new Error(`Expected 2 bills today, got ${stats2.billsToday}`);
  if (stats2.totalInvoices !== 4) throw new Error(`Expected 4 total invoices, got ${stats2.totalInvoices}`);

  console.log('\n--- TEST 5: Customer Edit and Persistence ---');
  const updatedCust = updateDemoCustomerClient(newCust.id, {
    name: 'Prasad Shirfule Patil'
  });
  console.log('Updated Customer Name:', updatedCust.name);
  if (updatedCust.name !== 'Prasad Shirfule Patil') throw new Error('Update failed');

  // Verify in sales that customer relation resolves updated name
  const salesAfterUpdate = getDemoSalesClient();
  const foundSale = salesAfterUpdate.find(s => s.id === bill1.id);
  console.log('Sale customer resolved after edit:', foundSale.customer_name);
  if (foundSale.customer_name !== 'Prasad Shirfule Patil') {
    throw new Error('Sale customer relationship did not dynamically resolve updated customer');
  }

  console.log('\n--- TEST 6: Customer Delete ---');
  deleteDemoCustomerClient(newCust.id);
  const remainingCusts = getDemoCustomersClient();
  if (remainingCusts.some(c => c.id === newCust.id)) {
    throw new Error('Customer was not deleted');
  }
  console.log('Remaining customers after deletion:', remainingCusts.length);

  console.log('\n--- TEST 7: Initial Demo Products ---');
  const prods = getDemoProductsClient();
  console.log('Initial products count:', prods.length);
  if (prods.length !== 5) throw new Error(`Expected 5 demo products, got ${prods.length}`);

  console.log('\n--- TEST 8: Search Products (Billing & Products Consistency) ---');
  const dapResults = searchDemoProductsClient('DAP');
  console.log('Search "DAP" results:', dapResults.map(p => p.name));
  if (dapResults.length === 0 || !dapResults.some(p => p.name.includes('DAP'))) {
    throw new Error('Search for DAP failed');
  }

  console.log('\n--- TEST 9: Create Product ("Test Urea", ₹500) ---');
  const newProduct = saveDemoProductClient({
    name: 'Test Urea',
    selling_price: 500,
    purchase_price: 450,
    opening_stock: 50,
    unit: 'Bag',
    gst_rate: 5,
    category_id: 'cat-2',
  });
  console.log('Created product ID:', newProduct.id);
  console.log('Created product Name:', newProduct.name);
  console.log('Created product Price:', newProduct.selling_price);

  if (newProduct.name !== 'Test Urea') throw new Error('Product name mismatch');
  if (newProduct.selling_price !== 500) throw new Error('Product price mismatch');

  // Verify in Products list
  const prodsAfterCreate = getDemoProductsClient();
  if (prodsAfterCreate.length !== 6) throw new Error(`Expected 6 products, got ${prodsAfterCreate.length}`);
  if (prodsAfterCreate[0].name !== 'Test Urea') throw new Error('New product should be at top');

  // Verify in Billing search
  const billingSearch = searchDemoProductsClient('Test Urea');
  if (billingSearch.length === 0 || billingSearch[0].name !== 'Test Urea') {
    throw new Error('Billing search could not find newly created product');
  }
  console.log('Billing search found:', billingSearch[0].name, '₹' + billingSearch[0].selling_price);

  console.log('\n--- TEST 10: Update Product Price ("Test Urea" -> ₹280) ---');
  const updatedProduct = updateDemoProductClient(newProduct.id, {
    selling_price: 280,
  });
  console.log('Updated product Price:', updatedProduct.selling_price);
  if (updatedProduct.selling_price !== 280) throw new Error('Product update price mismatch');

  // Verify updated in Products list
  const prodsAfterUpdate = getDemoProductsClient();
  const foundUpdated = prodsAfterUpdate.find(p => p.id === newProduct.id);
  if (foundUpdated.selling_price !== 280) throw new Error('Products list has stale price');

  // Verify updated in Billing search
  const billingSearchUpdated = searchDemoProductsClient('Test Urea');
  if (billingSearchUpdated[0].selling_price !== 280) throw new Error('Billing search has stale price');
  console.log('Billing search reflected updated price: ₹' + billingSearchUpdated[0].selling_price);

  console.log('\n--- TEST 11: Delete Product ("Test Urea") ---');
  deleteDemoProductClient(newProduct.id);

  // Verify removed from Products list
  const prodsAfterDelete = getDemoProductsClient();
  if (prodsAfterDelete.some(p => p.id === newProduct.id)) {
    throw new Error('Product was not removed from products list');
  }
  if (prodsAfterDelete.length !== 5) throw new Error(`Expected 5 products after delete, got ${prodsAfterDelete.length}`);

  // Verify removed from Billing search
  const billingSearchDeleted = searchDemoProductsClient('Test Urea');
  if (billingSearchDeleted.length !== 0) throw new Error('Deleted product still visible in Billing search');
  console.log('Billing search after deletion returned 0 matches as expected');

  console.log('\n--- TEST 12: Complete Bill with Demo Product & Verify Sales History ---');
  const billWithProduct = saveDemoSaleClient({
    customer_id: 'walk-in',
    customer_name: 'Farmer Shinde',
    payment_method: 'Cash',
    items: [
      {
        product_id: prods[0].id,
        product_name: prods[0].name,
        quantity: 2,
        unit_price: prods[0].selling_price,
        discount_percent: 0,
        gst_rate: prods[0].gst_rate || 5,
      }
    ]
  });
  console.log('Bill created with product:', billWithProduct.invoice_number, billWithProduct.items[0].product_name);
  if (!billWithProduct.invoice_number) throw new Error('Invoice number missing');

  const allSales = getDemoSalesClient();
  const foundBill = allSales.find(s => s.id === billWithProduct.id);
  if (!foundBill) throw new Error('Bill not found in sales history');
  console.log('Bill verified in sales history with items:', foundBill.items.length);

  console.log('\n--- TEST 13: Initial Demo Brands / Manufacturers ---');
  const brands = getDemoBrandsClient();
  console.log('Initial brands count:', brands.length);
  console.log('Sample brands:', brands.slice(0, 5).map(b => b.name).join(', '));
  if (brands.length < 10) throw new Error(`Expected at least 10 demo brands, got ${brands.length}`);
  if (!brands.some(b => b.name === 'IFFCO')) throw new Error('Missing IFFCO in demo brands');
  if (!brands.some(b => b.name === 'Bayer CropScience')) throw new Error('Missing Bayer in demo brands');

  console.log('\n--- TEST 14: Add New Manufacturer ("Krushi Chemicals") & Link Product ---');
  const newBrand = saveDemoBrandClient({
    name: 'Krushi Chemicals',
    manufacturer: 'Krushi Agro Chemicals Pvt Ltd',
  });
  console.log('Created Brand ID:', newBrand.id);
  console.log('Created Brand Name:', newBrand.name);
  if (newBrand.name !== 'Krushi Chemicals') throw new Error('Brand name mismatch');

  // Verify persistence in getDemoBrandsClient
  const brandsAfterAdd = getDemoBrandsClient();
  const foundBrand = brandsAfterAdd.find(b => b.name === 'Krushi Chemicals');
  if (!foundBrand) throw new Error('Krushi Chemicals not found in brands list');
  console.log('Brand verified in brands list:', foundBrand.name);

  // Create product using the new brand
  const prodWithBrand = saveDemoProductClient({
    name: 'Krushi Bio Booster 1L',
    category_id: 'cat-2',
    brand_id: foundBrand.id,
    brand: foundBrand,
    selling_price: 650,
    purchase_price: 500,
    unit: 'Bottle',
    gst_rate: 18,
  });
  console.log('Product created with brand:', prodWithBrand.name, 'Brand ID:', prodWithBrand.brand_id);
  if (prodWithBrand.brand_id !== foundBrand.id) throw new Error('Brand ID not assigned to product');

  // Clean up test product
  deleteDemoProductClient(prodWithBrand.id);

  console.log('\n--- TEST 15: Product Validation Rules (Batch, Expiry, Quantity) ---');
  // 15a: Missing Batch Number
  const missingBatchRes = productSchema.safeParse({
    name: 'Test Product',
    category_id: 'cat-1',
    purchase_price: 100,
    selling_price: 120,
    gst_rate: 18,
    unit: 'KG',
    opening_stock: 50,
    expiry_date: '04/09/2027',
    batch_number: '',
  });
  if (missingBatchRes.success) throw new Error('Expected validation error for missing batch number');
  const batchErr = missingBatchRes.error.issues.find(i => i.path.includes('batch_number'))?.message;
  console.log('Missing batch error message:', batchErr);
  if (batchErr !== 'Batch number is required.') throw new Error(`Expected "Batch number is required.", got "${batchErr}"`);

  // 15b: Missing Expiry Date
  const missingExpRes = productSchema.safeParse({
    name: 'Test Product',
    category_id: 'cat-1',
    purchase_price: 100,
    selling_price: 120,
    gst_rate: 18,
    unit: 'KG',
    opening_stock: 50,
    batch_number: 'BATCH-123',
    expiry_date: '',
  });
  if (missingExpRes.success) throw new Error('Expected validation error for missing expiry date');
  const expErr = missingExpRes.error.issues.find(i => i.path.includes('expiry_date'))?.message;
  console.log('Missing expiry error message:', expErr);
  if (expErr !== 'Expiry date is required.') throw new Error(`Expected "Expiry date is required.", got "${expErr}"`);

  // 15c: Invalid Expiry Date: 31/02/2027
  const invalidFebRes = productSchema.safeParse({
    name: 'Test Product',
    category_id: 'cat-1',
    purchase_price: 100,
    selling_price: 120,
    gst_rate: 18,
    unit: 'KG',
    opening_stock: 50,
    batch_number: 'BATCH-123',
    expiry_date: '31/02/2027',
  });
  if (invalidFebRes.success) throw new Error('Expected 31/02/2027 to be rejected');
  console.log('31/02/2027 correctly rejected as invalid');

  // 15d: Invalid Expiry Date: 99/99/9999
  const invalid99Res = productSchema.safeParse({
    name: 'Test Product',
    category_id: 'cat-1',
    purchase_price: 100,
    selling_price: 120,
    gst_rate: 18,
    unit: 'KG',
    opening_stock: 50,
    batch_number: 'BATCH-123',
    expiry_date: '99/99/9999',
  });
  if (invalid99Res.success) throw new Error('Expected 99/99/9999 to be rejected');
  console.log('99/99/9999 correctly rejected as invalid');

  // 15e: Quantity 0 must be rejected
  const zeroQtyRes = productSchema.safeParse({
    name: 'Test Product',
    category_id: 'cat-1',
    purchase_price: 100,
    selling_price: 120,
    gst_rate: 18,
    unit: 'KG',
    opening_stock: 0,
    batch_number: 'BATCH-123',
    expiry_date: '04/09/2027',
  });
  if (zeroQtyRes.success) throw new Error('Expected quantity 0 to be rejected');
  const qtyErr = zeroQtyRes.error.issues.find(i => i.path.includes('opening_stock'))?.message;
  console.log('0 Quantity error message:', qtyErr);
  if (qtyErr !== 'Quantity must be greater than 0') throw new Error(`Expected "Quantity must be greater than 0", got "${qtyErr}"`);

  console.log('\n--- TEST 16: Exact Test Urea Creation & Billing Verification ---');
  // Exact Test Urea specification from user prompt
  const testUrea = saveDemoProductClient({
    name: 'Test Urea',
    category_id: 'cat-1',
    brand_id: 'brand-iffco',
    brand: { id: 'brand-iffco', name: 'IFFCO' },
    purchase_price: 450,
    selling_price: 500,
    wholesale_price: 550,
    mrp: 550,
    gst_rate: 18,
    batch_number: 'UREA-2026-01',
    expiry_date: '04/09/2027',
    opening_stock: 50,
    unit: 'KG',
  });

  console.log('Created Test Urea:', testUrea.name);
  console.log('Selling Price:', testUrea.selling_price);
  console.log('Stock:', testUrea.current_stock, testUrea.unit);
  console.log('Batch Number:', testUrea.batch_number);
  console.log('Expiry Date (stored):', testUrea.expiry_date);
  console.log('Expiry Date (formatted):', formatToDDMMYYYY(testUrea.expiry_date));

  if (testUrea.name !== 'Test Urea') throw new Error('Name mismatch');
  if (testUrea.selling_price !== 500) throw new Error('Price mismatch');
  if (testUrea.current_stock !== 50) throw new Error('Stock mismatch');
  if (testUrea.unit !== 'KG') throw new Error('Unit mismatch');
  if (testUrea.batch_number !== 'UREA-2026-01') throw new Error('Batch mismatch');
  if (testUrea.expiry_date !== '2027-09-04') throw new Error('Stored expiry date should be 2027-09-04');
  if (formatToDDMMYYYY(testUrea.expiry_date) !== '04/09/2027') throw new Error('Display format should be 04/09/2027');

  // Verify in Billing search
  const ureaBillingSearch = searchDemoProductsClient('Test Urea');
  if (ureaBillingSearch.length === 0) throw new Error('Test Urea not found in billing search');
  console.log('Billing found Test Urea with stock:', ureaBillingSearch[0].current_stock, ureaBillingSearch[0].unit);
  if (ureaBillingSearch[0].current_stock !== 50 || ureaBillingSearch[0].unit !== 'KG') {
    throw new Error('Billing did not display 50 KG correctly');
  }


  console.log('\n--- TEST 17: Existing Product Edit Test ---');
  // Edit Test Urea
  const updatedUrea = updateDemoProductClient(testUrea.id, {
    selling_price: 520,
    opening_stock: 75,
    unit: 'KG',
    batch_number: 'UREA-2026-02',
    expiry_date: '15/10/2027',
  });

  console.log('Updated Test Urea Price:', updatedUrea.selling_price);
  console.log('Updated Test Urea Stock:', updatedUrea.current_stock, updatedUrea.unit);
  console.log('Updated Test Urea Batch:', updatedUrea.batch_number);
  console.log('Updated Test Urea Expiry:', formatToDDMMYYYY(updatedUrea.expiry_date));

  if (updatedUrea.selling_price !== 520) throw new Error('Updated price mismatch');
  if (updatedUrea.current_stock !== 75) throw new Error('Updated stock mismatch');
  if (updatedUrea.batch_number !== 'UREA-2026-02') throw new Error('Updated batch mismatch');
  if (formatToDDMMYYYY(updatedUrea.expiry_date) !== '15/10/2027') throw new Error('Updated expiry mismatch');

  // Clean up Test Urea
  deleteDemoProductClient(testUrea.id);

  console.log('\n--- TEST 18: QUANTITY vs PRODUCT SIZE (4 Requested Products) ---');
  // PRODUCT 1: Urea (10 Pieces, 45 KG Bag)
  const prodUrea = saveDemoProductClient({
    name: 'Urea',
    category_id: 'cat-1',
    purchase_price: 1200,
    selling_price: 1350,
    gst_rate: 5,
    batch_number: 'UREA-2026-01',
    expiry_date: '04/09/2027',
    opening_stock: 10,
    unit: 'Bag',
    product_size_value: 45,
    product_size_unit: 'KG',
  });
  const ureaDisplay = formatProductPackDisplay(prodUrea);
  console.log('Product 1: Urea -> Stock:', prodUrea.current_stock, 'Pieces | Size:', ureaDisplay);
  if (prodUrea.current_stock !== 10) throw new Error(`Expected Urea stock 10, got ${prodUrea.current_stock}`);
  if (ureaDisplay !== '45 KG') throw new Error(`Expected "45 KG", got "${ureaDisplay}"`);

  // PRODUCT 2: Confidor (20 Pieces, 100 ML)
  const prodConfidor = saveDemoProductClient({
    name: 'Confidor',
    category_id: 'cat-2',
    purchase_price: 480,
    selling_price: 550,
    gst_rate: 18,
    batch_number: 'CONF-2026-01',
    expiry_date: '04/09/2027',
    opening_stock: 20,
    product_size_value: 100,
    product_size_unit: 'ML',
  });
  const confidorDisplay = formatProductPackDisplay(prodConfidor);
  console.log('Product 2: Confidor -> Stock:', prodConfidor.current_stock, 'Pieces | Size:', confidorDisplay);
  if (prodConfidor.current_stock !== 20) throw new Error(`Expected Confidor stock 20, got ${prodConfidor.current_stock}`);
  if (confidorDisplay !== '100 ML') throw new Error(`Expected "100 ML", got "${confidorDisplay}"`);

  // PRODUCT 3: Cotton Seeds (50 Pieces, 475 G)
  const prodCotton = saveDemoProductClient({
    name: 'Cotton Seeds',
    category_id: 'cat-3',
    purchase_price: 750,
    selling_price: 864,
    gst_rate: 5,
    batch_number: 'SEED-2026-01',
    expiry_date: '04/09/2027',
    opening_stock: 50,
    product_size_value: 475,
    product_size_unit: 'G',
  });
  const cottonDisplay = formatProductPackDisplay(prodCotton);
  console.log('Product 3: Cotton Seeds -> Stock:', prodCotton.current_stock, 'Pieces | Size:', cottonDisplay);
  if (prodCotton.current_stock !== 50) throw new Error(`Expected Cotton Seeds stock 50, got ${prodCotton.current_stock}`);
  if (cottonDisplay !== '475 G') throw new Error(`Expected "475 G", got "${cottonDisplay}"`);

  // PRODUCT 4: Liquid Fertilizer (15 Pieces, 1 LTR)
  const prodLiquid = saveDemoProductClient({
    name: 'Liquid Fertilizer',
    category_id: 'cat-1',
    purchase_price: 400,
    selling_price: 500,
    gst_rate: 18,
    batch_number: 'LIQ-2026-01',
    expiry_date: '04/09/2027',
    opening_stock: 15,
    product_size_value: 1,
    product_size_unit: 'LTR',
  });
  const liquidDisplay = formatProductPackDisplay(prodLiquid);
  console.log('Product 4: Liquid Fertilizer -> Stock:', prodLiquid.current_stock, 'Pieces | Size:', liquidDisplay);
  if (prodLiquid.current_stock !== 15) throw new Error(`Expected Liquid Fertilizer stock 15, got ${prodLiquid.current_stock}`);
  if (liquidDisplay !== '1 LTR') throw new Error(`Expected "1 LTR", got "${liquidDisplay}"`);

  console.log('\n--- TEST 19: BILLING CALCULATION & STOCK DEDUCTION (Urea 45 KG) ---');
  // Add 2 bags of Urea at ₹1,350 each
  const billingCalculation = calculateItemTotal(2, prodUrea.selling_price, 0, prodUrea.gst_rate || 0, true);
  console.log('Billing Calculation for 2 bags of Urea at ₹1,350:');
  console.log('Subtotal / Total:', billingCalculation.total);
  if (billingCalculation.total !== 2700) {
    throw new Error(`Expected total ₹2,700 (2 × 1350), got ${billingCalculation.total}`);
  }

  // Complete bill in demo store
  const ureaSale = saveDemoSaleClient({
    customer_name: 'Walk-in Farmer',
    payment_method: 'Cash',
    items: [
      {
        product_id: prodUrea.id,
        product_name: prodUrea.name,
        quantity: 2,
        unit_price: prodUrea.selling_price,
        discount_percent: 0,
        gst_rate: prodUrea.gst_rate || 5,
        batch_number: prodUrea.batch_number,
      }
    ]
  });
  console.log('Created Urea Sale Invoice:', ureaSale.invoice_number, 'Total:', ureaSale.total_amount);
  if (ureaSale.total_amount !== 2700) throw new Error(`Expected sale total ₹2,700, got ${ureaSale.total_amount}`);

  // Check stock after sale
  const ureaAfterSale = getDemoProductByIdClient(prodUrea.id);
  console.log('Urea Stock after selling 2 pieces/bags:', ureaAfterSale?.current_stock, 'Pieces');
  if (ureaAfterSale?.current_stock !== 8) {
    throw new Error(`Expected stock 8 Pieces (10 - 2), got ${ureaAfterSale?.current_stock}`);
  }

  console.log('\n--- TEST 20: ADD NEW CATEGORY ("Plant Growth Regulators") FLOW ---');
  // Step 1: Create category via demo store
  const newCat = saveDemoCategoryClient({
    name: 'Plant Growth Regulators',
    description: 'Products used to regulate plant growth',
  });
  console.log('Created Category ID:', newCat.id, 'Name:', newCat.name);
  if (newCat.name !== 'Plant Growth Regulators') throw new Error('Category name mismatch');

  // Step 2: Verify category is available in getDemoCategoriesClient()
  const allCats = getDemoCategoriesClient();
  const foundCat = allCats.find(c => c.name === 'Plant Growth Regulators');
  console.log('Found category in all categories list:', foundCat?.name);
  if (!foundCat) throw new Error('Category not found in categories list');

  // Step 3: Create product using new category
  const pgrProduct = saveDemoProductClient({
    name: 'Bio-Zyme PGR',
    category_id: newCat.id,
    purchase_price: 350,
    selling_price: 450,
    opening_stock: 30,
    product_size_value: 500,
    product_size_unit: 'ML',
    batch_number: 'PGR-2026-01',
    expiry_date: '10/12/2027',
  });
  console.log('Created PGR Product:', pgrProduct.name, 'Category ID:', pgrProduct.category_id, 'Category Name:', pgrProduct.category?.name);
  if (pgrProduct.category_id !== newCat.id) throw new Error('Product category ID mismatch');
  if (pgrProduct.category?.name !== 'Plant Growth Regulators') throw new Error('Product category name mismatch');

  // Step 4: Search product in billing by category filter
  const categorySearchResults = searchDemoProductsClient('', newCat.id);
  console.log('Billing category search returned matches:', categorySearchResults.length);
  if (categorySearchResults.length === 0 || categorySearchResults[0].name !== 'Bio-Zyme PGR') {
    throw new Error('Billing category filter did not find PGR product');
  }

  // Clean up test products
  deleteDemoProductClient(prodUrea.id);
  deleteDemoProductClient(prodConfidor.id);
  deleteDemoProductClient(prodCotton.id);
  deleteDemoProductClient(prodLiquid.id);
  deleteDemoProductClient(pgrProduct.id);

  console.log('\n========================================');
  console.log('🎉 ALL INTEGRATION, PERSISTENCE & CONSISTENCY TESTS PASSED!');
  console.log('========================================');
}


runTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
