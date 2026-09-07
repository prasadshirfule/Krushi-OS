import { formatProductNameWithSize, productSchema, isValidUpiId, normalizeUpiId } from '@/lib/validations';
import { buildUpiUri } from '@/lib/upi';
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
  console.log('TESTING PRODUCT FORMAT, UPI PAYMENTS & DYNAMIC QR');
  console.log('==============================================');

  // 1. PRODUCT DISPLAY FORMAT: PRODUCT_NAME (SIZE)
  console.log('\n--- 1. Testing Product Display Format PRODUCT_NAME (SIZE) with space ---');
  const t1 = formatProductNameWithSize('UREA', '45', 'kg');
  console.log('UREA + 45kg ->', t1);
  if (t1 !== 'UREA (45 KG)' && t1 !== 'UREA (45KG)') throw new Error(`Expected "UREA (45 KG)", got "${t1}"`);

  const t2 = formatProductNameWithSize('DAP', '50', 'KG');
  console.log('DAP + 50KG ->', t2);
  if (t2 !== 'DAP (50 KG)' && t2 !== 'DAP (50KG)') throw new Error(`Expected "DAP (50 KG)", got "${t2}"`);

  const t3 = formatProductNameWithSize('Stunner Gold', '1', 'L');
  console.log('Stunner Gold + 1L ->', t3);
  if (t3 !== 'STUNNER GOLD (1 L)' && t3 !== 'STUNNER GOLD (1L)') throw new Error(`Expected "STUNNER GOLD (1 L)", got "${t3}"`);

  const t4 = formatProductNameWithSize('biofertilizer', '500', 'ml');
  console.log('biofertilizer + 500ml ->', t4);
  if (t4 !== 'BIOFERTILIZER (500 ML)' && t4 !== 'BIOFERTILIZER (500ML)') throw new Error(`Expected "BIOFERTILIZER (500 ML)", got "${t4}"`);

  const t5 = formatProductNameWithSize('urea', null, null);
  console.log('urea + null size ->', t5);
  if (t5 !== 'UREA') throw new Error(`Expected "UREA", got "${t5}"`);

  const t6 = formatProductNameWithSize('urea', undefined, undefined);
  console.log('urea + undefined size ->', t6);
  if (t6 !== 'UREA') throw new Error(`Expected "UREA", got "${t6}"`);

  if (t5.includes('null') || t5.includes('undefined') || t5.includes('NaN')) {
    throw new Error('Product format leaked null/undefined/NaN');
  }

  console.log('✓ Product format tests passed with single space before bracket!');

  // 2. UPI ID VALIDATION & NORMALIZATION
  console.log('\n--- 2. Testing UPI ID / VPA Validation ---');
  if (!isValidUpiId('maulikrushi@upi')) throw new Error('Expected maulikrushi@upi to be valid');
  if (!isValidUpiId('9876543210@upi')) throw new Error('Expected 9876543210@upi to be valid');
  if (!isValidUpiId('shopname@okaxis')) throw new Error('Expected shopname@okaxis to be valid');
  if (!isValidUpiId('shopname@ybl')) throw new Error('Expected shopname@ybl to be valid');
  if (!isValidUpiId('shopname@oksbi')) throw new Error('Expected shopname@oksbi to be valid');
  if (isValidUpiId('')) throw new Error('Expected empty string to be invalid UPI');
  if (isValidUpiId('invalidupi')) throw new Error('Expected string without @ to be invalid UPI');
  if (isValidUpiId('@upi')) throw new Error('Expected empty prefix @upi to be invalid');
  if (isValidUpiId('shop@')) throw new Error('Expected empty suffix shop@ to be invalid');

  console.log('✓ UPI ID validation tests passed!');

  // 3. DYNAMIC UPI PAYMENT URI GENERATION
  console.log('\n--- 3. Testing Dynamic UPI Payment URI Construction ---');
  const uri1 = buildUpiUri('maulikrushi@upi', 'MAULI KRUSHI KENDRA', 266);
  console.log('UPI URI (266) ->', uri1);
  if (uri1 !== 'upi://pay?pa=maulikrushi@upi&pn=MAULI%20KRUSHI%20KENDRA&am=266.00&cu=INR') {
    throw new Error(`Unexpected UPI URI: ${uri1}`);
  }

  const uriAdj = buildUpiUri('maulikrushi@upi', 'MAULI KRUSHI KENDRA', 566);
  console.log('UPI URI with Hamali (566) ->', uriAdj);
  if (uriAdj !== 'upi://pay?pa=maulikrushi@upi&pn=MAULI%20KRUSHI%20KENDRA&am=566.00&cu=INR') {
    throw new Error(`Unexpected UPI URI with adjustment: ${uriAdj}`);
  }

  const uriDisc = buildUpiUri('maulikrushi@upi', 'MAULI KRUSHI KENDRA', 466);
  console.log('UPI URI with Discount (466) ->', uriDisc);
  if (uriDisc !== 'upi://pay?pa=maulikrushi@upi&pn=MAULI%20KRUSHI%20KENDRA&am=466.00&cu=INR') {
    throw new Error(`Unexpected UPI URI with discount: ${uriDisc}`);
  }

  console.log('✓ Dynamic UPI URI generation tests passed!');

  // 4. PRODUCT SCHEMA: BATCH & EXPIRY OPTIONAL
  console.log('\n--- 4. Testing Batch & Expiry are Optional ---');
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

  // 5. QUICK CUSTOMER BILLING WITH UPI
  console.log('\n--- 5. Testing UPI Sale Creation & History ---');
  const bill1 = saveDemoSaleClient({
    customer_name: 'rahul patil',
    customer_phone: '9876543210',
    customer_village: 'kamari',
    payment_method: 'UPI',
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
    ],
    adjustments: [
      { id: 'adj-1', type: 'ADD', reason: 'Hamali', amount: 50 }
    ]
  });

  console.log('UPI Bill Payment Method:', bill1.payment_method);
  console.log('UPI Bill Total (266 + 50):', bill1.grand_total);
  if (bill1.payment_method !== 'UPI') throw new Error(`Expected UPI payment method, got ${bill1.payment_method}`);
  if (bill1.grand_total !== 316) throw new Error(`Expected grand total 316, got ${bill1.grand_total}`);

  console.log('\n==============================================');
  console.log('🎉 ALL PRODUCT FORMAT, UPI PAYMENTS & SYSTEM TESTS PASSED!');
  console.log('==============================================');
}

testAllRequirements().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
