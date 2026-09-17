import { parseStructuredQR } from '@/lib/scanner/structured-qr-parser';

async function runStructuredQRTests() {
  console.log('========================================');
  console.log('🧪 RUNNING STRUCTURED QR PARSER TESTS');
  console.log('========================================\n');

  // Test 1: Full JSON QR code
  console.log('--- TEST 1: Full JSON QR Code ---');
  const jsonFull = JSON.stringify({
    gtin: '8901234567890',
    productName: 'Bio Fertilizer Gold',
    manufacturer: 'Coromandel',
    batch: 'BF-2028-09',
    expiry: '2028-06-30',
    hsn: '3105',
    gst: 5,
    size: '50 KG',
    quantity: 25,
    purchasePrice: 1200,
    sellingPrice: 1450,
  });

  const res1 = parseStructuredQR(jsonFull);
  if (
    !res1 ||
    res1.gtin !== '8901234567890' ||
    res1.productName !== 'Bio Fertilizer Gold' ||
    res1.manufacturer !== 'Coromandel' ||
    res1.batchNumber !== 'BF-2028-09' ||
    res1.expiryDate !== '30/06/2028' ||
    res1.expiryDateDB !== '2028-06-30' ||
    res1.hsnCode !== '3105' ||
    res1.gstRate !== 5 ||
    res1.sizeValue !== 50 ||
    res1.sizeUnit !== 'KG' ||
    res1.quantity !== 25
  ) {
    throw new Error(`Full JSON QR parsing failed: ${JSON.stringify(res1)}`);
  }
  console.log('✓ Full JSON QR parsing passed');

  // Test 2: Partial JSON QR code
  console.log('\n--- TEST 2: Partial JSON QR Code (Only GTIN + Batch) ---');
  const jsonPartial = JSON.stringify({
    barcode: '8909998887771',
    batch_number: 'B-404',
    expiry_date: '15/12/2027',
  });
  const res2 = parseStructuredQR(jsonPartial);
  if (
    !res2 ||
    res2.barcode !== '8909998887771' ||
    res2.batchNumber !== 'B-404' ||
    res2.expiryDate !== '15/12/2027' ||
    res2.expiryDateDB !== '2027-12-15'
  ) {
    throw new Error(`Partial JSON QR parsing failed: ${JSON.stringify(res2)}`);
  }
  console.log('✓ Partial JSON QR parsing passed');

  // Test 3: Key-Value Format QR code
  console.log('\n--- TEST 3: Multi-line Key-Value QR Code ---');
  const kvRaw = `
    product=CONFIDOR INSECTICIDE
    brand=BAYER CROPSCIENCE
    batch=BAY-8891
    expiry=2028-08-31
    size=100 ML
    hsn=3808
    gst=18
    qty=50
  `;
  const res3 = parseStructuredQR(kvRaw);
  if (
    !res3 ||
    res3.productName !== 'CONFIDOR INSECTICIDE' ||
    res3.manufacturer !== 'BAYER CROPSCIENCE' ||
    res3.batchNumber !== 'BAY-8891' ||
    res3.expiryDate !== '31/08/2028' ||
    res3.sizeValue !== 100 ||
    res3.sizeUnit !== 'ML' ||
    res3.hsnCode !== '3808' ||
    res3.gstRate !== 18 ||
    res3.quantity !== 50
  ) {
    throw new Error(`Key-Value QR parsing failed: ${JSON.stringify(res3)}`);
  }
  console.log('✓ Multi-line Key-Value QR parsing passed');

  // Test 4: XSS and HTML Tag Sanitization
  console.log('\n--- TEST 4: Malicious Input Sanitization ---');
  const maliciousJson = JSON.stringify({
    productName: '<script>alert("xss")</script>UREA',
    manufacturer: '<b>IFFCO</b>',
    batch: 'BATCH<img src=x onerror=alert(1)>01',
  });
  const res4 = parseStructuredQR(maliciousJson);
  if (!res4 || res4.productName?.includes('<script>') || res4.manufacturer?.includes('<b>')) {
    throw new Error(`Sanitization failed: ${JSON.stringify(res4)}`);
  }
  console.log('✓ Malicious script/HTML sanitization passed');

  // Test 5: Invalid JSON & Malformed String
  console.log('\n--- TEST 5: Invalid JSON & Non-structured Text ---');
  if (parseStructuredQR('{ "badJson: ') !== null) {
    throw new Error('Malformed JSON should return null');
  }
  if (parseStructuredQR('Just some random website URL: https://example.com') !== null) {
    throw new Error('Plain text/URL should return null');
  }
  if (parseStructuredQR('') !== null) {
    throw new Error('Empty string should return null');
  }
  console.log('✓ Invalid JSON & Non-structured text handling passed');

  console.log('\n🎉 ALL STRUCTURED QR PARSER TESTS PASSED SUCCESSFULLY!');
}

runStructuredQRTests().catch(err => {
  console.error('❌ STRUCTURED QR TEST SUITE FAILED:', err);
  process.exit(1);
});
