import { parseScannedBarcode } from '@/lib/scanner/barcode-parser';

async function runBarcodeParserTests() {
  console.log('========================================');
  console.log('🧪 RUNNING UNIFIED BARCODE PARSER TESTS');
  console.log('========================================\n');

  // Test 1: Plain EAN-13 Barcode
  console.log('--- TEST 1: Plain EAN-13 Barcode ---');
  const ean13 = parseScannedBarcode('8901234567890', 'EAN_13');
  if (
    ean13.source !== 'barcode' ||
    ean13.barcode !== '8901234567890' ||
    ean13.gtin !== '8901234567890' ||
    ean13.productName !== undefined
  ) {
    throw new Error(`EAN-13 parsing failed: ${JSON.stringify(ean13)}`);
  }
  console.log('✓ Plain EAN-13 parsed with source="barcode" (no invented fields)');

  // Test 2: Plain EAN-8 Barcode
  console.log('\n--- TEST 2: Plain EAN-8 Barcode ---');
  const ean8 = parseScannedBarcode('89012345', 'EAN_8');
  if (ean8.source !== 'barcode' || ean8.barcode !== '89012345') {
    throw new Error(`EAN-8 parsing failed: ${JSON.stringify(ean8)}`);
  }
  console.log('✓ Plain EAN-8 parsed correctly');

  // Test 3: Plain UPC-A Barcode
  console.log('\n--- TEST 3: Plain UPC-A Barcode ---');
  const upcA = parseScannedBarcode('012345678905', 'UPC_A');
  if (upcA.source !== 'barcode' || upcA.barcode !== '012345678905') {
    throw new Error(`UPC-A parsing failed: ${JSON.stringify(upcA)}`);
  }
  console.log('✓ Plain UPC-A parsed correctly');

  // Test 4: Plain Code 128
  console.log('\n--- TEST 4: Plain Code 128 ---');
  const code128 = parseScannedBarcode('ITEM-CODE-9921', 'CODE_128');
  if (code128.source !== 'barcode' || code128.barcode !== 'ITEM-CODE-9921') {
    throw new Error(`Code 128 parsing failed: ${JSON.stringify(code128)}`);
  }
  console.log('✓ Plain Code 128 parsed correctly');

  // Test 5: GS1 routed through unified parser
  console.log('\n--- TEST 5: GS1 via Unified Parser ---');
  const gs1Res = parseScannedBarcode('(01)08901234567890(10)LOT-ABC(17)280630', 'QR_CODE');
  if (
    gs1Res.source !== 'gs1' ||
    gs1Res.gtin !== '08901234567890' ||
    gs1Res.batchNumber !== 'LOT-ABC' ||
    gs1Res.expiryDate !== '30/06/2028'
  ) {
    throw new Error(`GS1 unified parsing failed: ${JSON.stringify(gs1Res)}`);
  }
  console.log('✓ GS1 detected and parsed via unified parser');

  // Test 6: JSON QR routed through unified parser
  console.log('\n--- TEST 6: JSON QR via Unified Parser ---');
  const jsonQr = JSON.stringify({ productName: 'UREA', batch: 'U-1' });
  const jsonRes = parseScannedBarcode(jsonQr, 'QR_CODE');
  if (jsonRes.source !== 'structured_qr' || jsonRes.productName !== 'UREA' || jsonRes.batchNumber !== 'U-1') {
    throw new Error(`JSON QR unified parsing failed: ${JSON.stringify(jsonRes)}`);
  }
  console.log('✓ JSON QR detected and parsed via unified parser');

  // Test 7: Empty scan
  console.log('\n--- TEST 7: Empty Barcode Scan ---');
  const emptyRes = parseScannedBarcode('', 'UNKNOWN');
  if (emptyRes.source !== 'unknown' || emptyRes.rawValue !== '') {
    throw new Error(`Empty scan parsing failed: ${JSON.stringify(emptyRes)}`);
  }
  console.log('✓ Empty scan safely returns source="unknown"');

  console.log('\n🎉 ALL UNIFIED BARCODE PARSER TESTS PASSED SUCCESSFULLY!');
}

runBarcodeParserTests().catch(err => {
  console.error('❌ BARCODE PARSER TEST SUITE FAILED:', err);
  process.exit(1);
});
