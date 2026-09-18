import { test } from 'node:test';
import assert from 'node:assert';
import { parseScannedBarcode, extractStableIdentifierInfo, extractBatchAndExpiryFromIdentifier } from '../../lib/scanner/barcode-parser';
import { matchBillingProductStock, buildBillingCartItem, BillingScanLookupResult } from '../../lib/scanner/billing-scanner-service';
import { isGS1Url, parseGS1Url } from '../../lib/scanner/url-gs1-parser';

test('KRUSHI OS — Serialized Product QR Matching & Safe Ambiguity Test Suite', async (t) => {

  await t.test('1. Exact raw QR still matches (Level 1 priority)', () => {
    const rawQr = 'ivcs.ai/21/IS6X024B/10/JXA26018A?11=260317&17=280316';
    const products = [
      {
        id: 'p-xelora-1',
        name: 'XELORA (400 ML)',
        pack_size: '400 ML',
        selling_price: 1200,
        current_stock: 10,
        identifiers: [
          {
            raw_value: rawQr,
            identifier_type: 'qr',
            normalized_value: rawQr,
            stable_product_key: null,
            batch_number: 'IS6X024B',
            serial_number: 'JXA26018A',
            is_primary: true,
          }
        ],
        batches: [
          {
            id: 'b-xel-1',
            batch_number: 'IS6X024B',
            quantity_available: 10,
            expiry_date: '2028-03-16',
            selling_price: 1200,
          }
        ],
      }
    ];

    const match = matchBillingProductStock(products, rawQr);
    assert.strictEqual(match.found, true);
    assert.strictEqual(match.product.id, 'p-xelora-1');
    assert.strictEqual(match.matchLevel, 'EXACT_RAW');
    assert.strictEqual(match.selectedBatch?.batch_number, 'IS6X024B');
  });

  await t.test('2. Same product + different serial resolves correctly when GTIN is present (Level 2)', () => {
    // Piece 1 with GTIN 08904232801980 and serial A
    const piece1Qr = 'https://syngenta.co.in/gpd/01/08904232801980/10/SPL6A20014/21/SERIAL_AAA?11=260129&17=280128';
    // Piece 2 with same GTIN but different serial B
    const piece2Qr = 'https://syngenta.co.in/gpd/01/08904232801980/10/SPL6A20014/21/SERIAL_BBB?11=260129&17=280128';

    const info1 = extractStableIdentifierInfo(piece1Qr);
    assert.strictEqual(info1.gtin, '08904232801980');
    assert.strictEqual(info1.stableProductKey, 'gtin:08904232801980');
    assert.strictEqual(info1.batchNumber, 'SPL6A20014');
    assert.strictEqual(info1.serialNumber, 'SERIAL_AAA');

    const info2 = extractStableIdentifierInfo(piece2Qr);
    assert.strictEqual(info2.gtin, '08904232801980');
    assert.strictEqual(info2.stableProductKey, 'gtin:08904232801980');
    assert.strictEqual(info2.serialNumber, 'SERIAL_BBB');

    // Product only has Piece 1 registered
    const products = [
      {
        id: 'p-evicent-1',
        name: 'EVICENT (100 GM)',
        pack_size: '100 GM',
        selling_price: 750,
        current_stock: 20,
        identifiers: [
          {
            raw_value: piece1Qr,
            identifier_type: 'qr',
            normalized_value: '08904232801980',
            stable_product_key: 'gtin:08904232801980',
            batch_number: 'SPL6A20014',
            serial_number: 'SERIAL_AAA',
            is_primary: true,
          }
        ],
        batches: [
          {
            id: 'b-evi-1',
            batch_number: 'SPL6A20014',
            quantity_available: 20,
            expiry_date: '2028-01-28',
            selling_price: 750,
          }
        ],
      }
    ];

    // Scan Piece 2 (whose raw value was NEVER registered)
    const match = matchBillingProductStock(products, piece2Qr);
    assert.strictEqual(match.found, true);
    assert.strictEqual(match.product.id, 'p-evicent-1');
    assert.strictEqual(match.matchLevel, 'STABLE_IDENTIFIER');
    assert.strictEqual(match.selectedBatch?.batch_number, 'SPL6A20014');
  });

  await t.test('3. Same product + same batch + different serial resolves via Level 4 when batch uniquely belongs to 1 product', () => {
    // Piece 1 registered during Add Product
    const piece1 = 'ivcs.ai/21/IS6X024B/10/JXA26018A?11=260317&17=280316';
    // Piece 2 scanned during Billing
    const piece2 = 'ivcs.ai/21/IS6X024B/10/ANOTHER_SERIAL_999?11=260317&17=280316';

    const info1 = extractStableIdentifierInfo(piece1);
    // Since ivcs.ai URL has no GTIN/SKU, stableProductKey MUST remain null as per safety rules
    assert.strictEqual(info1.stableProductKey, null);
    assert.ok(info1.batchNumber);

    const products = [
      {
        id: 'p-xelora-400',
        name: 'XELORA (400 ML)',
        pack_size: '400 ML',
        selling_price: 1200,
        current_stock: 15,
        identifiers: [
          {
            raw_value: piece1,
            identifier_type: 'qr',
            normalized_value: piece1,
            stable_product_key: null,
            batch_number: 'IS6X024B',
            serial_number: 'JXA26018A',
            is_primary: true,
          }
        ],
        batches: [
          {
            id: 'b-xel-100',
            batch_number: 'IS6X024B',
            quantity_available: 15,
            expiry_date: '2028-03-16',
            selling_price: 1200,
          }
        ],
      }
    ];

    // Scan Piece 2 during billing
    const match = matchBillingProductStock(products, piece2);
    assert.strictEqual(match.found, true);
    assert.strictEqual(match.product.id, 'p-xelora-400');
    assert.strictEqual(match.matchLevel, 'BATCH_ASSOCIATION');
    assert.strictEqual(match.selectedBatch?.batch_number, 'IS6X024B');
    assert.strictEqual(match.availableStock, 15);
  });

  await t.test('4. Same batch shared by multiple products does NOT guess -> returns AMBIGUOUS', () => {
    const scannedQr = 'ivcs.ai/21/SHARED_BATCH_123/10/SERIAL_XYZ?11=260317&17=280316';

    const products = [
      {
        id: 'p-product-A',
        name: 'PRODUCT A (500 ML)',
        selling_price: 500,
        current_stock: 10,
        batches: [
          { id: 'b-1', batch_number: 'SHARED_BATCH_123', quantity_available: 10, expiry_date: '2028-03-16' }
        ],
      },
      {
        id: 'p-product-B',
        name: 'PRODUCT B (1 LTR)',
        selling_price: 900,
        current_stock: 5,
        batches: [
          { id: 'b-2', batch_number: 'SHARED_BATCH_123', quantity_available: 5, expiry_date: '2028-03-16' }
        ],
      }
    ];

    const match = matchBillingProductStock(products, scannedQr);
    // MUST NOT GUESS!
    assert.strictEqual(match.found, false);
    assert.strictEqual(match.isAmbiguous, true);
    assert.strictEqual(match.reason, 'AMBIGUOUS');
    assert.strictEqual(match.matchingProducts?.length, 2);
  });

  await t.test('5. Two different products using same manufacturer QR structure DO NOT collide on stableProductKey', () => {
    const qrProduct1 = 'ivcs.ai/21/BATCH_001/10/SERIAL_111?11=260101&17=280101';
    const qrProduct2 = 'ivcs.ai/21/BATCH_002/10/SERIAL_222?11=260101&17=280101';

    const info1 = extractStableIdentifierInfo(qrProduct1);
    const info2 = extractStableIdentifierInfo(qrProduct2);

    // Strict safety check: Neither should invent a synthetic stableProductKey from URL shape
    assert.strictEqual(info1.stableProductKey, null);
    assert.strictEqual(info2.stableProductKey, null);
    // Serials must NOT become stable product key
    assert.notStrictEqual(info1.stableProductKey, info1.serialNumber);
    assert.notStrictEqual(info2.stableProductKey, info2.serialNumber);
  });

  await t.test('6. Serial number is NEVER treated as product identity or stable product key', () => {
    const testPayloads = [
      'ivcs.ai/21/IS6X024B/10/JXA26018A?11=260317&17=280316',
      'https://example.com/verify?batch=BAT1&sn=998877&exp=2028-01-01',
      '(01)08901234567890(10)LOT1(21)SN12345',
    ];

    for (const raw of testPayloads) {
      const info = extractStableIdentifierInfo(raw);
      if (info.serialNumber) {
        assert.notStrictEqual(info.stableProductKey, info.serialNumber, `Serial ${info.serialNumber} must not equal stableProductKey`);
      }
    }
  });

  await t.test('7. Unknown QR returns Product Not Registered', () => {
    const unknownQr = 'https://unknown-brand.org/p/unregistered_payload_987654';
    const products = [
      {
        id: 'p-1',
        name: 'EXISTING PRODUCT',
        selling_price: 100,
        current_stock: 10,
        identifiers: [{ raw_value: '08901111111111' }],
        batches: [{ batch_number: 'EXISTING_BATCH', quantity_available: 10 }],
      }
    ];

    const match = matchBillingProductStock(products, unknownQr);
    assert.strictEqual(match.found, false);
    assert.strictEqual(match.isAmbiguous, undefined);
    assert.strictEqual(match.reason, 'NOT_FOUND');
  });

  await t.test('8. Out of stock batch is detected and not added to cart', () => {
    const rawQr = '08901234567890';
    const products = [
      {
        id: 'p-zero-stock',
        name: 'ZERO STOCK PRODUCT',
        selling_price: 500,
        current_stock: 0,
        barcode: rawQr,
        batches: [
          { id: 'b-zero', batch_number: 'BAT0', quantity_available: 0, expiry_date: '2028-01-01' }
        ],
      }
    ];

    const match = matchBillingProductStock(products, rawQr);
    assert.strictEqual(match.found, true);
    assert.strictEqual(match.isOutOfStock, true);
    assert.strictEqual(match.reason, 'OUT_OF_STOCK');
    const cartItem = buildBillingCartItem(match);
    assert.strictEqual(cartItem, null);
  });

  await t.test('9. Expired batch is detected and not added to cart', () => {
    const rawQr = '08901234567890';
    const products = [
      {
        id: 'p-expired',
        name: 'EXPIRED PRODUCT',
        selling_price: 500,
        current_stock: 10,
        barcode: rawQr,
        batches: [
          { id: 'b-exp', batch_number: 'BAT_EXP', quantity_available: 10, expiry_date: '2020-01-01' }
        ],
      }
    ];

    const match = matchBillingProductStock(products, rawQr);
    assert.strictEqual(match.found, true);
    assert.strictEqual(match.isExpired, true);
    assert.strictEqual(match.reason, 'EXPIRED');
    const cartItem = buildBillingCartItem(match);
    assert.strictEqual(cartItem, null);
  });

  await t.test('10. Existing product_identifiers with NULL stable fields continue working seamlessly', () => {
    const raw = '1234567890123';
    const products = [
      {
        id: 'p-legacy',
        name: 'LEGACY PRODUCT',
        selling_price: 250,
        current_stock: 5,
        identifiers: [
          {
            id: 'ident-old',
            raw_value: raw,
            normalized_value: raw,
            stable_product_key: null,
            batch_number: null,
            serial_number: null,
            is_primary: true,
          }
        ],
        batches: [
          { id: 'b-leg', batch_number: 'BAT_LEG', quantity_available: 5, expiry_date: '2028-01-01' }
        ],
      }
    ];

    const match = matchBillingProductStock(products, raw);
    assert.strictEqual(match.found, true);
    assert.strictEqual(match.product.id, 'p-legacy');
    assert.strictEqual(match.matchLevel, 'EXACT_RAW');
    const cartItem = buildBillingCartItem(match);
    assert.strictEqual(cartItem.product_name, 'LEGACY PRODUCT');
    assert.strictEqual(cartItem.quantity, 1);
  });

  await t.test('11. FEFO selects earlier non-expired batch when no specific batch in QR', () => {
    const raw = '08905555555555';
    const products = [
      {
        id: 'p-fefo',
        name: 'FEFO PRODUCT',
        selling_price: 400,
        current_stock: 15,
        barcode: raw,
        batches: [
          { id: 'b-later', batch_number: 'BAT_2028', quantity_available: 10, expiry_date: '2028-12-31' },
          { id: 'b-sooner', batch_number: 'BAT_2026', quantity_available: 5, expiry_date: '2026-12-31' },
        ],
      }
    ];

    const match = matchBillingProductStock(products, raw);
    assert.strictEqual(match.found, true);
    // Strict FEFO: earlier expiry batch BAT_2026 must be selected
    assert.strictEqual(match.selectedBatch.batch_number, 'BAT_2026');
  });

  await t.test('12. Database migration 020 file invariants', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const mig020Path = path.resolve(process.cwd(), 'supabase/migrations/020_serialized_product_identifiers.sql');
    assert.strictEqual(fs.existsSync(mig020Path), true, 'Migration 020 must exist');

    const content = fs.readFileSync(mig020Path, 'utf8');
    assert.ok(content.includes('stable_product_key'), 'Must add stable_product_key column');
    assert.ok(content.includes('batch_number'), 'Must add batch_number column');
    assert.ok(content.includes('serial_number'), 'Must add serial_number column');
    assert.ok(content.includes('idx_product_identifiers_stable_key'), 'Must add index on stable_product_key');
    assert.ok(content.includes('idx_product_identifiers_batch'), 'Must add index on batch_number');
  });

  await t.test('13. Authoritative product_batches precedence: selects existing batch without duplicating', () => {
    const scannedQr = 'ivcs.ai/21/IS6X024B/10/ANOTHER_SERIAL_777?11=260317&17=280316';
    const existingBatch = {
      id: 'batch-orig-1',
      batch_number: 'IS6X024B',
      quantity_available: 8,
      expiry_date: '2028-03-16',
      selling_price: 1200,
    };

    const products = [
      {
        id: 'p-xel-auth',
        name: 'XELORA (400 ML)',
        current_stock: 8,
        batches: [existingBatch],
      }
    ];

    const match = matchBillingProductStock(products, scannedQr);
    assert.strictEqual(match.found, true);
    assert.strictEqual(match.selectedBatch.id, 'batch-orig-1');
    assert.strictEqual(match.selectedBatch.batch_number, 'IS6X024B');
    // Ensure product batches array length remains unchanged (no duplicate batch created)
    assert.strictEqual(products[0].batches.length, 1);
  });

  await t.test('14. Non-existent batch during billing is not silently created -> fails safely', () => {
    const scannedQr = 'ivcs.ai/21/NON_EXISTENT_BATCH_999/10/SERIAL_000?11=260317&17=280316';
    const products = [
      {
        id: 'p-xel-auth',
        name: 'XELORA (400 ML)',
        current_stock: 5,
        batches: [
          {
            id: 'batch-orig-1',
            batch_number: 'IS6X024B',
            quantity_available: 5,
            expiry_date: '2028-03-16',
          }
        ],
      }
    ];

    const match = matchBillingProductStock(products, scannedQr);
    // Batch does not exist anywhere in shop -> NOT_FOUND, never silently fabricated
    assert.strictEqual(match.found, false);
    assert.strictEqual(match.reason, 'NOT_FOUND');
    assert.strictEqual(products[0].batches.length, 1);
  });

});

