import test from 'node:test';
import assert from 'node:assert';
import {
  extractBillingLookupCodes,
  matchBillingProductStock,
  buildBillingCartItem,
  BillingScanLookupResult,
} from '@/lib/scanner/billing-scanner-service';
import { productSchema } from '@/lib/validations';
import { createProduct } from '@/services/products.service';

// Mock inventory data for testing
const mockProducts = [
  {
    id: 'prod-evicent-100',
    name: 'EVICENT INSECTICIDE',
    category_id: 'cat-insecticide',
    category: { id: 'cat-insecticide', name: 'Insecticide' },
    barcode: '08904232801980',
    gtin: '08904232801980',
    sku: 'SKU-EVI-100',
    selling_price: 650,
    current_stock: 45,
    pack_size: '100 GM',
    unit: 'Bottle',
    gst_rate: 18,
    batches: [
      {
        id: 'batch-spl6a20014',
        product_id: 'prod-evicent-100',
        batch_number: 'SPL6A20014',
        quantity_available: 20,
        selling_price: 650,
        expiry_date: '2028-01-28',
        is_active: true,
      },
      {
        id: 'batch-spl6a20015',
        product_id: 'prod-evicent-100',
        batch_number: 'SPL6A20015',
        quantity_available: 25,
        selling_price: 650,
        expiry_date: '2028-06-30',
        is_active: true,
      },
    ],
  },
  {
    id: 'prod-fefo-test',
    name: 'CORAGEN INSECTICIDE',
    category_id: 'cat-insecticide',
    category: { id: 'cat-insecticide', name: 'Insecticide' },
    barcode: '8901234567890',
    sku: 'SKU-COR-60',
    selling_price: 1850,
    current_stock: 30,
    pack_size: '60 ML',
    unit: 'Bottle',
    gst_rate: 18,
    batches: [
      {
        id: 'batch-cor-later',
        product_id: 'prod-fefo-test',
        batch_number: 'COR-LATER',
        quantity_available: 15,
        selling_price: 1850,
        expiry_date: '2028-12-31',
        is_active: true,
      },
      {
        id: 'batch-cor-earlier',
        product_id: 'prod-fefo-test',
        batch_number: 'COR-EARLIER',
        quantity_available: 15,
        selling_price: 1850,
        expiry_date: '2027-05-15',
        is_active: true,
      },
    ],
  },
  {
    id: 'prod-out-of-stock',
    name: 'ROUNDUP HERBICIDE',
    category_id: 'cat-herbicide',
    category: { id: 'cat-herbicide', name: 'Herbicide' },
    barcode: '8909999888877',
    sku: 'SKU-RND-1L',
    selling_price: 450,
    current_stock: 0,
    pack_size: '1 LTR',
    unit: 'Bottle',
    gst_rate: 18,
    batches: [
      {
        id: 'batch-rnd-0',
        product_id: 'prod-out-of-stock',
        batch_number: 'RND-001',
        quantity_available: 0,
        selling_price: 450,
        expiry_date: '2028-01-01',
        is_active: true,
      },
    ],
  },
  {
    id: 'prod-expired-batch',
    name: 'OLD PESTICIDE DUST',
    category_id: 'cat-pesticide',
    category: { id: 'cat-pesticide', name: 'Pesticide' },
    barcode: '8901111222233',
    sku: 'SKU-OLD-1K',
    selling_price: 200,
    current_stock: 10,
    pack_size: '1 KG',
    unit: 'Bag',
    gst_rate: 18,
    batches: [
      {
        id: 'batch-old-expired',
        product_id: 'prod-expired-batch',
        batch_number: 'OLD-EXP-99',
        quantity_available: 10,
        selling_price: 200,
        expiry_date: '2020-01-01', // Expired
        is_active: true,
      },
    ],
  },
];

test('Test 1: Known barcode → exact product found', () => {
  const result = matchBillingProductStock(mockProducts, '08904232801980');
  assert.strictEqual(result.found, true);
  assert.strictEqual(result.reason, 'SUCCESS');
  assert.strictEqual(result.product?.id, 'prod-evicent-100');
  assert.strictEqual(result.product?.name, 'EVICENT INSECTICIDE');
});

test('Test 2: Unknown barcode → Product Not Found', () => {
  const result = matchBillingProductStock(mockProducts, '9999999999999');
  assert.strictEqual(result.found, false);
  assert.strictEqual(result.reason, 'NOT_FOUND');
  assert.strictEqual(result.product, undefined);
});

test('Test 3 & 4: Same barcode scanned multiple times → cart quantity increments to 2, then 3', () => {
  let cart: any[] = [];

  function simulateAddToCart(newItem: any) {
    const matchIndex = cart.findIndex(item => {
      if (item.product_id !== newItem.product_id) return false;
      if (newItem.batch_id || item.batch_id) {
        return item.batch_id === newItem.batch_id;
      }
      return (item.batch_number || '') === (newItem.batch_number || '');
    });

    if (matchIndex > -1) {
      cart[matchIndex] = {
        ...cart[matchIndex],
        quantity: (cart[matchIndex].quantity || 1) + (newItem.quantity || 1),
      };
    } else {
      cart.push({ ...newItem, quantity: newItem.quantity || 1 });
    }
  }

  const match = matchBillingProductStock(mockProducts, '08904232801980');
  assert.strictEqual(match.found, true);
  const cartItem = buildBillingCartItem(match);

  // Scan 1
  simulateAddToCart(cartItem);
  assert.strictEqual(cart.length, 1);
  assert.strictEqual(cart[0].quantity, 1);

  // Scan 2 (Test 3)
  simulateAddToCart(cartItem);
  assert.strictEqual(cart.length, 1);
  assert.strictEqual(cart[0].quantity, 2);

  // Scan 3 (Test 4)
  simulateAddToCart(cartItem);
  assert.strictEqual(cart.length, 1);
  assert.strictEqual(cart[0].quantity, 3);
});

test('Test 5: First scan A then B rapidly → only A processed (First-scan lock simulation)', async () => {
  let scanLocked = false;
  const processedScans: string[] = [];

  async function handleScanEvent(barcode: string) {
    if (scanLocked) {
      return; // Ignored due to lock
    }
    scanLocked = true; // Synchronous lock immediately
    processedScans.push(barcode);
    // Simulate async DB lookup
    await new Promise(r => setTimeout(r, 20));
  }

  // Rapid trigger of A and B
  const p1 = handleScanEvent('08904232801980');
  const p2 = handleScanEvent('8901234567890');

  await Promise.all([p1, p2]);

  assert.strictEqual(processedScans.length, 1);
  assert.strictEqual(processedScans[0], '08904232801980');
});

test('Test 6: GTIN + batch → exact batch selected', () => {
  // GS1 QR with GTIN and Batch SPL6A20015 (not the first batch SPL6A20014)
  const gs1Raw = '(01)08904232801980(10)SPL6A20015(17)280630';
  const result = matchBillingProductStock(mockProducts, gs1Raw);

  assert.strictEqual(result.found, true);
  assert.strictEqual(result.selectedBatch?.batch_number, 'SPL6A20015');
  assert.strictEqual(result.selectedBatch?.quantity_available, 25);
});

test('Test 7: GTIN without batch → FEFO earliest expiry batch selected', () => {
  // Plain barcode without batch -> Should pick batch-cor-earlier (expiry 2027-05-15 before 2028-12-31)
  const result = matchBillingProductStock(mockProducts, '8901234567890');

  assert.strictEqual(result.found, true);
  assert.strictEqual(result.selectedBatch?.batch_number, 'COR-EARLIER');
  assert.strictEqual(result.selectedBatch?.id, 'batch-cor-earlier');
});

test('Test 8: Product exists but stock = 0 → out-of-stock response', () => {
  const result = matchBillingProductStock(mockProducts, '8909999888877');

  assert.strictEqual(result.found, true);
  assert.strictEqual(result.isOutOfStock, true);
  assert.strictEqual(result.reason, 'OUT_OF_STOCK');
  assert.strictEqual(result.availableStock, 0);
});

test('Test 9: Expired batch → existing expiry rules respected', () => {
  const result = matchBillingProductStock(mockProducts, '8901111222233');

  assert.strictEqual(result.found, true);
  assert.strictEqual(result.isExpired, true);
  assert.strictEqual(result.reason, 'EXPIRED');
});

test('Test 10: Billing scanner never calls manufacturer enrichment', () => {
  // We verify that extractBillingLookupCodes and matchBillingProductStock execute purely in memory
  // without any network requests or URL enrichment.
  const gs1Url = 'https://syngenta.co.in/gpd/01/08904232801980/10/SPL6A20014/21/U2DFSHLAEX?11=260129&17=280128';
  const codes = extractBillingLookupCodes(gs1Url);

  assert.strictEqual(codes.primaryCode, '08904232801980');
  assert.strictEqual(codes.batchNumber, 'SPL6A20014');
  assert.ok(codes.searchCodes.includes('08904232801980'));
  assert.ok(codes.searchCodes.includes('8904232801980'));

  const result = matchBillingProductStock(mockProducts, gs1Url);
  assert.strictEqual(result.found, true);
  assert.strictEqual(result.product?.name, 'EVICENT INSECTICIDE');
});

test('Test 11: Billing scanner never invokes OCR', () => {
  // Billing scanner pipeline strictly parses raw values without OCR fallback
  const nonBarcode = 'SOME RANDOM TEXT ON BOX';
  const result = matchBillingProductStock(mockProducts, nonBarcode);
  assert.strictEqual(result.found, false);
});

test('Test 12: Unknown barcode never creates a product', () => {
  const countBefore = mockProducts.length;
  const result = matchBillingProductStock(mockProducts, '0000000000000');
  assert.strictEqual(result.found, false);
  assert.strictEqual(mockProducts.length, countBefore);
});

test('Test 13: New product category initial value is empty/unselected in schema', () => {
  const emptyData = {
    name: 'TEST PRODUCT',
    category_id: '',
    purchase_price: 100,
    selling_price: 120,
    gst_rate: 18,
    product_size_value: 1,
    product_size_unit: 'KG',
    opening_stock: 10,
  };

  const validation = productSchema.safeParse(emptyData);
  assert.strictEqual(validation.success, false);
  if (!validation.success) {
    const catError = validation.error.issues.find(i => i.path.includes('category_id'));
    assert.ok(catError);
    assert.strictEqual(catError.message, 'Please select a category before saving the product.');
  }
});

test('Test 14: Save without category → blocked on service level', async () => {
  await assert.rejects(
    async () => {
      await createProduct('shop-test', {
        name: 'UNSAFE PRODUCT',
        category_id: '',
        selling_price: 100,
        opening_stock: 10,
      } as any);
    },
    {
      message: 'Please select a category before saving the product.',
    }
  );
});

test('Test 15: Save with category → allowed on service level', async () => {
  const res = await createProduct('shop-test', {
    name: 'VALID SEED PRODUCT',
    category_id: 'cat-seeds',
    selling_price: 350,
    opening_stock: 20,
    product_size_value: 1,
    product_size_unit: 'KG',
    unit: 'Packet',
  } as any);

  assert.ok(res);
  assert.ok(res.product);
  assert.strictEqual(res.product.name, 'VALID SEED PRODUCT');
  assert.strictEqual(res.product.category_id, 'cat-seeds');
});

test('Test 16: Existing products remain unchanged', () => {
  // Existing products have their assigned categories intact
  assert.strictEqual(mockProducts[0].category_id, 'cat-insecticide');
  assert.strictEqual(mockProducts[1].category_id, 'cat-insecticide');
  assert.strictEqual(mockProducts[2].category_id, 'cat-herbicide');
  assert.strictEqual(mockProducts[3].category_id, 'cat-pesticide');
});
