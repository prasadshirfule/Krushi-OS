import { formatProductNameWithSize, productSchema } from '@/lib/validations';
import { saveDemoSaleClient, getDemoSalesClient } from '@/lib/client-demo-store';

// Set up mock window and localStorage
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

async function testAllRequirements() {
  console.log('==============================================');
  console.log('TESTING PRODUCT FORMAT, BATCH/EXPIRY & QUICK CUSTOMER');
  console.log('==============================================');

  // 1. PRODUCT DISPLAY FORMAT
  console.log('\n--- 1. Testing Product Display Format PRODUCT_NAME(SIZE) ---');
  const t1 = formatProductNameWithSize('UREA', '45', 'kg');
  console.log('UREA + 45kg ->', t1);
  if (t1 !== 'UREA(45KG)') throw new Error(`Expected "UREA(45KG)", got "${t1}"`);

  const t2 = formatProductNameWithSize('DAP', '50', 'KG');
  console.log('DAP + 50KG ->', t2);
  if (t2 !== 'DAP(50KG)') throw new Error(`Expected "DAP(50KG)", got "${t2}"`);

  const t3 = formatProductNameWithSize('Stunner Gold', '1', 'L');
  console.log('Stunner Gold + 1L ->', t3);
  if (t3 !== 'STUNNER GOLD(1L)') throw new Error(`Expected "STUNNER GOLD(1L)", got "${t3}"`);

  const t4 = formatProductNameWithSize('biofertilizer', '500', 'ml');
  console.log('biofertilizer + 500ml ->', t4);
  if (t4 !== 'BIOFERTILIZER(500ML)') throw new Error(`Expected "BIOFERTILIZER(500ML)", got "${t4}"`);

  const t5 = formatProductNameWithSize('urea', null, null);
  console.log('urea + null size ->', t5);
  if (t5 !== 'UREA') throw new Error(`Expected "UREA", got "${t5}"`);

  const t6 = formatProductNameWithSize('urea', undefined, undefined);
  console.log('urea + undefined size ->', t6);
  if (t6 !== 'UREA') throw new Error(`Expected "UREA", got "${t6}"`);

  if (t5.includes('null') || t5.includes('undefined') || t5.includes('NaN')) {
    throw new Error('Product format leaked null/undefined/NaN');
  }

  console.log('✓ Product format tests passed!');

  // 2. PRODUCT SCHEMA: BATCH & EXPIRY OPTIONAL
  console.log('\n--- 2. Testing Batch & Expiry are Optional ---');
  const noBatchRes = productSchema.safeParse({
    name: 'UREA',
    category_id: 'cat-1',
    purchase_price: 240,
    selling_price: 266,
    gst_rate: 5,
    unit: 'Bag',
    opening_stock: 100,
    product_size_value: 45,
    product_size_unit: 'KG',
    batch_number: '',
    expiry_date: '',
  });

  if (!noBatchRes.success) {
    console.error('Validation error on empty batch/expiry:', noBatchRes.error);
    throw new Error('Product should save without batch number and expiry date');
  }
  console.log('✓ Fertilizer without batch/expiry successfully validated!');

  const withBatchRes = productSchema.safeParse({
    name: 'STUNNER GOLD',
    category_id: 'cat-2',
    purchase_price: 250,
    selling_price: 295,
    gst_rate: 18,
    unit: 'Bottle',
    opening_stock: 20,
    product_size_value: 1,
    product_size_unit: 'L',
    batch_number: '100',
    expiry_date: '10/07/2028',
  });

  if (!withBatchRes.success) {
    console.error('Validation error on valid batch/expiry:', withBatchRes.error);
    throw new Error('Product with batch & expiry should save');
  }
  console.log('✓ Product with batch/expiry successfully validated!');

  // 3. QUICK CUSTOMER BILLING & DATA ISOLATION
  console.log('\n--- 3. Testing Quick Customer Billing ---');
  const bill1 = saveDemoSaleClient({
    customer_name: 'rahul patil',
    customer_phone: '9876543210',
    customer_village: 'kamari',
    payment_method: 'Cash',
    items: [
      {
        product_name: 'UREA',
        pack_size: '45 KG',
        unit: 'Bag',
        quantity: 1,
        unit_price: 266,
        gst_rate: 5,
        manufacturer: 'IFFCO',
        batch_number: null,
        expiry_date: null,
      }
    ]
  });

  console.log('Bill 1 Customer Name:', bill1.customer?.name || bill1.customer_name);
  console.log('Bill 1 Customer Mob:', bill1.customer?.phone || bill1.customer_phone);
  console.log('Bill 1 Customer Village:', bill1.customer?.village);

  if ((bill1.customer?.name || bill1.customer_name) !== 'RAHUL PATIL') {
    throw new Error(`Expected RAHUL PATIL in uppercase, got ${bill1.customer?.name || bill1.customer_name}`);
  }
  if ((bill1.customer?.phone || bill1.customer_phone) !== '9876543210') {
    throw new Error(`Expected 9876543210, got ${bill1.customer?.phone || bill1.customer_phone}`);
  }
  if (bill1.customer?.village !== 'KAMARI') {
    throw new Error(`Expected KAMARI, got ${bill1.customer?.village}`);
  }

  // Bill 2: Walk-in customer without details
  console.log('\n--- 4. Testing Walk-in Customer Without Details (Data Isolation) ---');
  const bill2 = saveDemoSaleClient({
    customer_id: 'walk-in',
    customer_name: '',
    customer_phone: '',
    customer_village: '',
    payment_method: 'Cash',
    items: [
      {
        product_name: 'DAP',
        pack_size: '50 KG',
        unit: 'Bag',
        quantity: 1,
        unit_price: 1350,
        gst_rate: 5,
        manufacturer: 'IFFCO',
        batch_number: null,
        expiry_date: null,
      }
    ]
  });

  console.log('Bill 2 Customer Name:', bill2.customer?.name || bill2.customer_name);
  console.log('Bill 2 Customer Phone:', bill2.customer?.phone || bill2.customer_phone);
  console.log('Bill 2 Customer Village:', bill2.customer?.village);

  if ((bill2.customer?.name || bill2.customer_name) !== 'WALK-IN CUSTOMER') {
    throw new Error(`Expected WALK-IN CUSTOMER, got ${bill2.customer?.name || bill2.customer_name}`);
  }
  if (bill2.customer?.phone && bill2.customer.phone !== '') {
    throw new Error(`Expected empty phone for pure walk-in, got ${bill2.customer.phone}`);
  }
  if (bill2.customer?.village && bill2.customer.village !== '') {
    throw new Error(`Expected empty village for pure walk-in, got ${bill2.customer.village}`);
  }

  console.log('\n==============================================');
  console.log('🎉 ALL PRODUCT FORMAT, BATCH/EXPIRY & QUICK CUSTOMER TESTS PASSED!');
  console.log('==============================================');
}

testAllRequirements().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
