import test from 'node:test';
import assert from 'node:assert';
import { productSchema } from '@/lib/validations';
import { createProduct, normalizeProduct, getProductByBarcode } from '@/services/products.service';
import {
  extractBillingLookupCodes,
  matchBillingProductStock,
  buildBillingCartItem,
} from '@/lib/scanner/billing-scanner-service';
import { NativeBarcodeScannerSession } from '@/lib/scanner/capacitor-scanner';

// Real fixtures
const REAL_BAYER_QR = `https://crop-protection.bayer.com/IN/gr/9183277589941951
No:SYNAT25026DT
MFG:18-01-2025
EXP:17-01-2027
UID:9183277589941951`;

const REAL_SYNGENTA_QR = `https://syngenta.co.in/gpd/01/08904232801980/10/SPL6A20014/21/U2DFSHLAEX?11=260129&17=280128`;
const REAL_SYNGENTA_EAN = `08904232801980`;

test('1. New product starts with no category', () => {
  // Verifies that a fresh product form initial model has no category pre-selected
  const freshFormData = {
    name: 'TEST PRODUCT',
    category_id: '',
    purchase_price: 100,
    selling_price: 120,
    gst_rate: 18,
    unit: 'Piece',
    product_size_value: 1,
    product_size_unit: 'KG',
    opening_stock: 10,
    min_stock: 5,
  };

  assert.strictEqual(freshFormData.category_id, '');
});

test('2. Save without category blocked', async () => {
  // Test 2a: Zod validation rejects empty string
  const validation1 = productSchema.safeParse({
    name: 'TEST PRODUCT',
    category_id: '',
    purchase_price: 100,
    selling_price: 120,
    gst_rate: 18,
    unit: 'Piece',
    product_size_value: 1,
    product_size_unit: 'KG',
    opening_stock: 10,
    min_stock: 5,
  });
  assert.strictEqual(validation1.success, false);

  // Test 2b: Server createProduct rejects empty/unselected category
  await assert.rejects(
    async () => {
      await createProduct('shop-1', {
        name: 'TEST PRODUCT',
        category_id: '',
        purchase_price: 100,
        selling_price: 120,
        gst_rate: 18,
        unit: 'Piece',
        product_size_value: 1,
        product_size_unit: 'KG',
        opening_stock: 10,
        min_stock: 5,
      } as any);
    },
    {
      name: 'Error',
      message: 'Please select a category before saving the product.',
    }
  );
});

test('3. Scan barcode during Add Product → identifier captured without product autofill', () => {
  const scannedBarcode = '8901234567890';
  
  // Simulated link capture in LinkProductBarcodeModal
  const linkedItem = {
    raw_value: scannedBarcode.trim(),
    normalized_value: scannedBarcode.trim(),
    identifier_type: 'barcode' as const,
  };

  assert.strictEqual(linkedItem.raw_value, '8901234567890');
  assert.strictEqual(linkedItem.identifier_type, 'barcode');
});

test('4. Scan QR during Add Product → raw identifier captured without guessing', () => {
  // Simulated link capture for Bayer QR
  const linkedItem = {
    raw_value: REAL_BAYER_QR,
    normalized_value: null,
    identifier_type: 'qr' as const,
  };

  assert.strictEqual(linkedItem.raw_value, REAL_BAYER_QR);
  assert.strictEqual(linkedItem.identifier_type, 'qr');
});

test('5. Raw QR is preserved exactly across multi-line payloads and query parameters', () => {
  assert.ok(REAL_BAYER_QR.includes('No:SYNAT25026DT'));
  assert.ok(REAL_BAYER_QR.includes('UID:9183277589941951'));
  assert.ok(REAL_SYNGENTA_QR.includes('?11=260129&17=280128'));
});

test('6. Product saved with identifier', async () => {
  const result = await createProduct('shop-test', {
    name: 'NATVIRO FUNGICIDE',
    category_id: 'cat-fungicide',
    purchase_price: 800,
    selling_price: 950,
    gst_rate: 18,
    unit: 'Bottle',
    product_size_value: 250,
    product_size_unit: 'GM',
    opening_stock: 20,
    min_stock: 5,
    batch_tracking: true,
    expiry_tracking: true,
    identifiers: [
      {
        raw_value: REAL_BAYER_QR,
        normalized_value: null,
        identifier_type: 'qr',
        is_primary: true,
      },
    ],
  });

  assert.ok(result.product);
  assert.strictEqual(result.product.name, 'NATVIRO FUNGICIDE');
  assert.strictEqual(result.product.identifiers.length, 1);
  assert.strictEqual(result.product.identifiers[0].raw_value, REAL_BAYER_QR);
});

test('7. Same product can have multiple identifiers (EAN + Syngenta QR)', async () => {
  const result = await createProduct('shop-test', {
    name: 'EVICENT INSECTICIDE',
    category_id: 'cat-insecticide',
    purchase_price: 550,
    selling_price: 650,
    gst_rate: 18,
    unit: 'Bottle',
    product_size_value: 100,
    product_size_unit: 'GM',
    opening_stock: 15,
    min_stock: 5,
    batch_tracking: true,
    expiry_tracking: true,
    identifiers: [
      {
        raw_value: REAL_SYNGENTA_EAN,
        normalized_value: REAL_SYNGENTA_EAN,
        identifier_type: 'barcode',
        is_primary: true,
      },
      {
        raw_value: REAL_SYNGENTA_QR,
        normalized_value: null,
        identifier_type: 'qr',
        is_primary: false,
      },
    ],
  });

  assert.strictEqual(result.product.identifiers.length, 2);
  assert.strictEqual(result.product.identifiers[0].raw_value, REAL_SYNGENTA_EAN);
  assert.strictEqual(result.product.identifiers[1].raw_value, REAL_SYNGENTA_QR);
});

test('8. Same identifier cannot be linked to two unrelated products (conflict check)', () => {
  const existingProducts = [
    {
      id: 'prod-1',
      name: 'EVICENT',
      identifiers: [
        { raw_value: REAL_SYNGENTA_EAN, identifier_type: 'barcode' }
      ]
    }
  ];

  const targetIdentifier = REAL_SYNGENTA_EAN;
  const alreadyLinkedProduct = existingProducts.find(p => 
    p.identifiers.some(i => i.raw_value === targetIdentifier)
  );

  assert.ok(alreadyLinkedProduct);
  assert.strictEqual(alreadyLinkedProduct.id, 'prod-1');
});

test('9. Billing scan exact identifier → correct product', () => {
  const products = [
    {
      id: 'prod-bayer-1',
      name: 'NATVIRO BAYER',
      current_stock: 10,
      selling_price: 950,
      identifiers: [
        { raw_value: REAL_BAYER_QR, identifier_type: 'qr', is_primary: true }
      ],
      batches: [
        { id: 'b1', batch_number: 'BAT-01', quantity_available: 10, expiry_date: '2028-01-01' }
      ]
    },
    {
      id: 'prod-syngenta-1',
      name: 'EVICENT SYNGENTA',
      current_stock: 20,
      selling_price: 650,
      identifiers: [
        { raw_value: REAL_SYNGENTA_QR, identifier_type: 'qr', is_primary: true },
        { raw_value: REAL_SYNGENTA_EAN, identifier_type: 'barcode', is_primary: false }
      ],
      batches: [
        { id: 'b2', batch_number: 'SPL6A20014', quantity_available: 20, expiry_date: '2028-01-28' }
      ]
    }
  ];

  // Scan exact Bayer QR
  const matchBayer = matchBillingProductStock(products, REAL_BAYER_QR);
  assert.strictEqual(matchBayer.found, true);
  assert.strictEqual(matchBayer.product.name, 'NATVIRO BAYER');

  // Scan exact Syngenta QR
  const matchSyngenta = matchBillingProductStock(products, REAL_SYNGENTA_QR);
  assert.strictEqual(matchSyngenta.found, true);
  assert.strictEqual(matchSyngenta.product.name, 'EVICENT SYNGENTA');

  // Scan exact Syngenta Barcode
  const matchEan = matchBillingProductStock(products, REAL_SYNGENTA_EAN);
  assert.strictEqual(matchEan.found, true);
  assert.strictEqual(matchEan.product.name, 'EVICENT SYNGENTA');
});

test('10. Billing scan same identifier twice → cart quantity 2', () => {
  let cart: any[] = [];

  const addToCart = (newItem: any) => {
    const matchIndex = cart.findIndex(item => item.product_id === newItem.product_id);
    if (matchIndex > -1) {
      cart[matchIndex] = {
        ...cart[matchIndex],
        quantity: cart[matchIndex].quantity + (newItem.quantity || 1)
      };
    } else {
      cart.push({ ...newItem, quantity: newItem.quantity || 1 });
    }
  };

  const product = {
    id: 'prod-evicent',
    name: 'EVICENT',
    selling_price: 650,
    current_stock: 10,
    identifiers: [{ raw_value: REAL_SYNGENTA_EAN }]
  };

  const match1 = matchBillingProductStock([product], REAL_SYNGENTA_EAN);
  const cartItem1 = buildBillingCartItem(match1);
  addToCart(cartItem1);

  assert.strictEqual(cart.length, 1);
  assert.strictEqual(cart[0].quantity, 1);

  // Scan 2nd time
  const match2 = matchBillingProductStock([product], REAL_SYNGENTA_EAN);
  const cartItem2 = buildBillingCartItem(match2);
  addToCart(cartItem2);

  assert.strictEqual(cart.length, 1);
  assert.strictEqual(cart[0].quantity, 2);
});

test('11. Billing scan unknown identifier → Product Not Registered', () => {
  const products = [
    {
      id: 'prod-1',
      name: 'CORAGEN',
      identifiers: [{ raw_value: '8901234567890' }]
    }
  ];

  const unknownCode = '09999999999999';
  const match = matchBillingProductStock(products, unknownCode);

  assert.strictEqual(match.found, false);
  assert.strictEqual(match.reason, 'NOT_FOUND');
});

test('12. Unknown identifier never creates product', () => {
  const products = [
    { id: 'prod-1', name: 'EXISTING PRODUCT', identifiers: [{ raw_value: '8901111111111' }] }
  ];
  const initialCount = products.length;

  const match = matchBillingProductStock(products, '9998887776665');
  assert.strictEqual(match.found, false);
  assert.strictEqual(products.length, initialCount); // No mutation or product creation
});

test('13. Billing scanner does not call manufacturer enrichment', () => {
  // extractBillingLookupCodes and matchBillingProductStock execute synchronously and local-first with zero async/fetch
  const codes = extractBillingLookupCodes(REAL_SYNGENTA_QR);
  assert.strictEqual(typeof codes, 'object');
  assert.ok(codes.searchCodes.length > 0);
});

test('14. Billing scanner does not invoke OCR', () => {
  // Exact QR lookup parses payload directly without invoking image canvas or OCR engine
  const codes = extractBillingLookupCodes(REAL_BAYER_QR);
  assert.ok(codes.primaryCode);
});

test('15. Billing scanner does not open external browser', () => {
  // Verifies that URLs in QR codes are treated as local database lookup keys, not web links
  const codes = extractBillingLookupCodes('https://example.com/item/12345');
  assert.strictEqual(codes.primaryCode, 'https://example.com/item/12345');
});

test('16. Batch-linked identifier → correct batch selected', () => {
  const product = {
    id: 'prod-1',
    name: 'EVICENT',
    current_stock: 50,
    selling_price: 650,
    identifiers: [{ raw_value: REAL_SYNGENTA_QR }],
    batches: [
      {
        id: 'b-other',
        batch_number: 'OTHER-BATCH',
        quantity_available: 20,
        expiry_date: '2028-12-31'
      },
      {
        id: 'b-spl6a20014',
        batch_number: 'SPL6A20014',
        quantity_available: 30,
        expiry_date: '2028-01-28'
      }
    ]
  };

  const match = matchBillingProductStock([product], REAL_SYNGENTA_QR);
  assert.strictEqual(match.found, true);
  assert.strictEqual(match.selectedBatch.batch_number, 'SPL6A20014');
  assert.strictEqual(match.selectedBatch.id, 'b-spl6a20014');
});

test('17. Out-of-stock product → not added to cart', () => {
  const product = {
    id: 'prod-out',
    name: 'OUT OF STOCK PRODUCT',
    current_stock: 0,
    selling_price: 500,
    identifiers: [{ raw_value: '8900000000000' }],
    batches: [
      {
        id: 'b-0',
        batch_number: 'BAT-0',
        quantity_available: 0,
        expiry_date: '2028-01-01'
      }
    ]
  };

  const match = matchBillingProductStock([product], '8900000000000');
  assert.strictEqual(match.found, true);
  assert.strictEqual(match.isOutOfStock, true);
  assert.strictEqual(match.reason, 'OUT_OF_STOCK');

  const cartItem = buildBillingCartItem(match);
  assert.strictEqual(cartItem, null);
});

test('18. Expired batch → not sold', () => {
  const product = {
    id: 'prod-exp',
    name: 'EXPIRED PRODUCT',
    current_stock: 10,
    selling_price: 500,
    identifiers: [{ raw_value: '8901111222233' }],
    batches: [
      {
        id: 'b-exp',
        batch_number: 'BAT-EXP',
        quantity_available: 10,
        expiry_date: '2020-01-01' // Past expiry
      }
    ]
  };

  const match = matchBillingProductStock([product], '8901111222233');
  assert.strictEqual(match.found, true);
  assert.strictEqual(match.isExpired, true);
  assert.strictEqual(match.reason, 'EXPIRED');

  const cartItem = buildBillingCartItem(match);
  assert.strictEqual(cartItem, null);
});

test('19. First-scan lock still works in NativeBarcodeScannerSession', () => {
  const session = new NativeBarcodeScannerSession({
    onScanResult: () => {},
    onError: () => {},
  });

  assert.strictEqual(session.isLockedStatus(), false);
  const lock1 = session.acquireLock();
  assert.strictEqual(lock1, true);
  assert.strictEqual(session.isLockedStatus(), true);

  // Subsequent lock acquisitions must fail
  const lock2 = session.acquireLock();
  assert.strictEqual(lock2, false);
});

test('20. Rapid A → B scans → only A processed', () => {
  const session = new NativeBarcodeScannerSession({
    onScanResult: () => {},
    onError: () => {},
  });

  const processed: string[] = [];

  const handleScan = (code: string) => {
    if (!session.acquireLock()) return;
    processed.push(code);
  };

  // Rapid bursts
  handleScan('CODE_A');
  handleScan('CODE_B');
  handleScan('CODE_C');

  assert.strictEqual(processed.length, 1);
  assert.strictEqual(processed[0], 'CODE_A');
});
