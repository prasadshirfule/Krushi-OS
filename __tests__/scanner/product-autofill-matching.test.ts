import { parseScannedBarcode } from '@/lib/scanner/barcode-parser';
import { matchScannedProduct } from '@/lib/scanner/product-matcher';
import {
  getDemoProductsClient,
  saveDemoProductClient,
  deleteDemoProductClient,
} from '@/lib/client-demo-store';

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
    if (listeners[type]) {
      listeners[type] = listeners[type].filter(f => f !== fn);
    }
  }
};

async function runMatchingAndAutofillTests() {
  console.log('========================================');
  console.log('🧪 RUNNING PRODUCT MATCHING & AUTOFILL TESTS');
  console.log('========================================\n');

  // Step 1: Create a known test product in Krushi OS inventory with a specific barcode
  console.log('--- TEST 1: Seed Known Product with Barcode ---');
  const testBarcode = '8901030889922';
  const seededProduct = saveDemoProductClient({
    name: 'COROMANDEL GROMOR 14-35-14',
    category_id: 'cat-fertilizers',
    barcode: testBarcode,
    sku: 'SKU-GROMOR-143514',
    purchase_price: 1350,
    selling_price: 1550,
    opening_stock: 40,
    product_size_value: 50,
    product_size_unit: 'KG',
    hsn_code: '3105',
    gst_rate: 5,
    batch_number: 'GRO-2026-B1',
    expiry_date: '31/12/2028',
  });
  console.log('Seeded product ID:', seededProduct.id, 'Barcode:', seededProduct.barcode);

  // Step 2: Scan normal EAN-13 barcode matching seeded product
  console.log('\n--- TEST 2: Match Existing Product by Barcode ---');
  const scanResult1 = parseScannedBarcode(testBarcode, 'EAN_13');
  const matched1 = await matchScannedProduct(scanResult1);

  console.log('Match result:', {
    found: matched1.existingProductFound,
    productName: matched1.productName,
    size: matched1.size,
    hsn: matched1.hsnCode,
    gst: matched1.gstRate,
  });

  if (!matched1.existingProductFound) throw new Error('Existing product not found by barcode');
  if (matched1.productName !== 'COROMANDEL GROMOR 14-35-14') throw new Error('Product name did not match');
  if (matched1.hsnCode !== '3105') throw new Error('HSN code did not match');
  if (matched1.gstRate !== 5) throw new Error('GST rate did not match');
  console.log('✓ Successfully matched existing Krushi OS product and enriched details');

  // Step 3: Scan GS1 code containing GTIN of existing product + New Batch & Expiry
  console.log('\n--- TEST 3: GS1 Scan with Existing GTIN + New Encoded Batch/Expiry ---');
  const gs1Scan = `(01)0${testBarcode}(10)NEW-LOT-2029(17)290630`;
  const parsedGS1 = parseScannedBarcode(gs1Scan, 'DATA_MATRIX');
  const matchedGS1 = await matchScannedProduct(parsedGS1);

  if (!matchedGS1.existingProductFound) throw new Error('Existing product not matched from GS1 GTIN');
  if (matchedGS1.productName !== 'COROMANDEL GROMOR 14-35-14') throw new Error('Product name did not enrich');
  // Encoded batch/expiry from scan should take precedence over DB product's old batch
  if (matchedGS1.batchNumber !== 'NEW-LOT-2029') throw new Error(`Batch number not extracted from GS1: ${matchedGS1.batchNumber}`);
  if (matchedGS1.expiryDate !== '30/06/2029') throw new Error(`Expiry date not converted from GS1: ${matchedGS1.expiryDate}`);
  console.log('✓ GS1 successfully matched product AND preserved scan-encoded batch/expiry');

  // Step 4: Unknown barcode (not in DB)
  console.log('\n--- TEST 4: Unknown Barcode (Not in DB) ---');
  const unknownBarcode = '8909999999999';
  const unknownScan = parseScannedBarcode(unknownBarcode, 'EAN_13');
  const unknownMatch = await matchScannedProduct(unknownScan);

  if (unknownMatch.existingProductFound) throw new Error('Unknown product was falsely marked as found');
  if (unknownMatch.barcode !== unknownBarcode) throw new Error('Barcode identifier was not preserved');
  if (unknownMatch.productName !== undefined) throw new Error('Product name was falsely invented for unknown barcode');
  console.log('✓ Unknown barcode safely preserved identifier without inventing product data');

  // Step 5: Conflict Detection Simulation (Do not overwrite user values blindly)
  console.log('\n--- TEST 5: Conflict Detection / Non-Destructive Auto-Fill Simulation ---');
  // Simulate user already typed Product Name: "CUSTOM UREA" and Batch: "MY-BATCH-01"
  const formState = {
    name: 'CUSTOM UREA',
    batch_number: 'MY-BATCH-01',
    expiry_date: '',
    hsn_code: '',
  };

  const detectedData = {
    name: 'COROMANDEL GROMOR 14-35-14',
    batch_number: 'NEW-LOT-2029',
    expiry_date: '30/06/2029',
    hsn_code: '3105',
  };

  const conflicts: Array<{ field: string; current: string; detected: string }> = [];
  const autofilled: Record<string, string> = {};

  for (const [key, detectedVal] of Object.entries(detectedData)) {
    const currentVal = (formState as any)[key];
    if (!currentVal || currentVal.trim() === '') {
      // Empty field: safe to auto-fill
      autofilled[key] = detectedVal;
    } else if (currentVal.trim().toUpperCase() !== detectedVal.trim().toUpperCase()) {
      // Non-empty differing field: conflict flagged, do NOT overwrite silently
      conflicts.push({ field: key, current: currentVal, detected: detectedVal });
    }
  }

  console.log('Autofilled fields:', Object.keys(autofilled));
  console.log('Detected conflicts:', conflicts);

  if (!autofilled['expiry_date'] || !autofilled['hsn_code']) {
    throw new Error('Empty fields were not autofilled');
  }
  if (conflicts.length !== 2) {
    throw new Error(`Expected 2 conflicts (name & batch), found ${conflicts.length}`);
  }
  if (conflicts.some(c => c.field === 'expiry_date' || c.field === 'hsn_code')) {
    throw new Error('Empty fields should not be flagged as conflicts');
  }
  console.log('✓ Conflict detection correctly protects user-entered fields from silent overwrite');

  // Clean up seeded product
  deleteDemoProductClient(seededProduct.id);

  console.log('\n🎉 ALL PRODUCT MATCHING & AUTOFILL TESTS PASSED SUCCESSFULLY!');
}

runMatchingAndAutofillTests().catch(err => {
  console.error('❌ MATCHING & AUTOFILL TEST SUITE FAILED:', err);
  process.exit(1);
});
