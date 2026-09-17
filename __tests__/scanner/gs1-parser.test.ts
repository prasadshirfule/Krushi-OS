import { parseGS1Barcode, parseGS1Date, normalizeGTIN, isGS1Barcode } from '@/lib/scanner/gs1-parser';

async function runGS1Tests() {
  console.log('========================================');
  console.log('🧪 RUNNING GS1 BARCODE PARSER TESTS');
  console.log('========================================\n');

  // Test 1: isGS1Barcode detection
  console.log('--- TEST 1: isGS1Barcode Detection ---');
  if (!isGS1Barcode('(01)08901234567890')) throw new Error('Failed to detect bracketed GS1');
  if (!isGS1Barcode('010890123456789010BATCH123')) throw new Error('Failed to detect raw GS1 stream');
  if (isGS1Barcode('8901234567890')) throw new Error('Plain EAN-13 should not be flagged as GS1');
  if (isGS1Barcode('')) throw new Error('Empty string should not be GS1');
  console.log('✓ isGS1Barcode detection passed');

  // Test 2: normalizeGTIN
  console.log('\n--- TEST 2: GTIN Normalization ---');
  const gtin14 = normalizeGTIN('08901234567890');
  if (gtin14 !== '08901234567890') throw new Error(`GTIN preservation failed: expected 08901234567890, got ${gtin14}`);
  const directEan = normalizeGTIN('8901234567890');
  if (directEan !== '8901234567890') throw new Error(`Direct EAN modified: got ${directEan}`);
  console.log('✓ normalizeGTIN passed');

  // Test 3: GS1 Date Conversion (YYMMDD -> UI DD/MM/YYYY and ISO YYYY-MM-DD)
  console.log('\n--- TEST 3: GS1 Expiry & Production Date Conversion ---');
  // Standard date: 280630 -> 2028-06-30 / 30/06/2028
  const date1 = parseGS1Date('280630');
  if (!date1 || date1.isoDate !== '2028-06-30' || date1.uiDate !== '30/06/2028') {
    throw new Error(`Date conversion 280630 failed: ${JSON.stringify(date1)}`);
  }
  // Leap year standard date: 280229 -> 2028-02-29 / 29/02/2028
  const leapDate = parseGS1Date('280229');
  if (!leapDate || leapDate.isoDate !== '2028-02-29' || leapDate.uiDate !== '29/02/2028') {
    throw new Error(`Leap date conversion failed: ${JSON.stringify(leapDate)}`);
  }
  // Day 00 rule (GS1 standard means end of month): 280200 -> 2028-02-29
  const endOfMonthFebLeap = parseGS1Date('280200');
  if (!endOfMonthFebLeap || endOfMonthFebLeap.isoDate !== '2028-02-29' || endOfMonthFebLeap.uiDate !== '29/02/2028') {
    throw new Error(`Day 00 leap month conversion failed: ${JSON.stringify(endOfMonthFebLeap)}`);
  }
  const endOfMonthJune = parseGS1Date('270600');
  if (!endOfMonthJune || endOfMonthJune.isoDate !== '2027-06-30' || endOfMonthJune.uiDate !== '30/06/2027') {
    throw new Error(`Day 00 30-day month conversion failed: ${JSON.stringify(endOfMonthJune)}`);
  }
  // Invalid date: 281399 -> null
  if (parseGS1Date('281399') !== null) {
    throw new Error('Invalid month should return null');
  }
  if (parseGS1Date('280231') !== null) {
    throw new Error('Feb 31 should return null');
  }
  console.log('✓ GS1 date parsing and end-of-month (Day 00) passed');

  // Test 4: Bracketed GS1 GTIN only
  console.log('\n--- TEST 4: Bracketed GS1 GTIN Only ---');
  const res1 = parseGS1Barcode('(01)08901234567890');
  if (!res1 || res1.gtin !== '08901234567890') {
    throw new Error(`Bracketed GTIN only failed: ${JSON.stringify(res1)}`);
  }
  console.log('✓ Bracketed GS1 GTIN only passed');

  // Test 5: Bracketed GS1 GTIN + Batch
  console.log('\n--- TEST 5: Bracketed GS1 GTIN + Batch ---');
  const res2 = parseGS1Barcode('(01)08901234567890(10)BATCH123');
  if (!res2 || res2.gtin !== '08901234567890' || res2.batchNumber !== 'BATCH123') {
    throw new Error(`Bracketed GTIN + Batch failed: ${JSON.stringify(res2)}`);
  }
  console.log('✓ Bracketed GS1 GTIN + Batch passed');

  // Test 6: Bracketed GS1 GTIN + Batch + Expiry
  console.log('\n--- TEST 6: Bracketed GS1 GTIN + Batch + Expiry ---');
  const res3 = parseGS1Barcode('(01)08901234567890(10)LOT-9988(17)280630');
  if (
    !res3 ||
    res3.gtin !== '08901234567890' ||
    res3.batchNumber !== 'LOT-9988' ||
    res3.expiryDate !== '30/06/2028' ||
    res3.expiryDateDB !== '2028-06-30'
  ) {
    throw new Error(`Bracketed GTIN + Batch + Expiry failed: ${JSON.stringify(res3)}`);
  }
  console.log('✓ Bracketed GS1 GTIN + Batch + Expiry passed');

  // Test 7: Raw GS1 Stream with FNC1 (\x1D) Separator
  console.log('\n--- TEST 7: Raw GS1 Stream with FNC1 Separator ---');
  const rawStream = '010890123456789010BATCH-X99\x1D172806303000000050';
  const res4 = parseGS1Barcode(rawStream);
  if (
    !res4 ||
    res4.gtin !== '08901234567890' ||
    res4.batchNumber !== 'BATCH-X99' ||
    res4.expiryDate !== '30/06/2028' ||
    res4.quantity !== 50
  ) {
    throw new Error(`Raw GS1 with FNC1 failed: ${JSON.stringify(res4)}`);
  }
  console.log('✓ Raw GS1 stream with FNC1 delimiter passed');

  // Test 8: Raw GS1 Stream with Fixed Fields First (GTIN + Expiry + Batch at end)
  console.log('\n--- TEST 8: Raw GS1 with Fixed AI 01 + Fixed AI 17 + Variable AI 10 ---');
  const res5 = parseGS1Barcode('01089012345678901728063010LOT777');
  if (
    !res5 ||
    res5.gtin !== '08901234567890' ||
    res5.expiryDate !== '30/06/2028' ||
    res5.batchNumber !== 'LOT777'
  ) {
    throw new Error(`Raw GS1 fixed fields first failed: ${JSON.stringify(res5)}`);
  }
  console.log('✓ Raw GS1 fixed fields first passed');

  // Test 9: Invalid / Malformed GS1
  console.log('\n--- TEST 9: Invalid & Malformed GS1 ---');
  const invalid1 = parseGS1Barcode('01XYZ');
  if (invalid1 !== null && invalid1.gtin) {
    throw new Error('Malformed GS1 should not parse valid GTIN');
  }
  const invalid2 = parseGS1Barcode('');
  if (invalid2 !== null) {
    throw new Error('Empty barcode should return null');
  }
  console.log('✓ Invalid GS1 handling passed');

  console.log('\n🎉 ALL GS1 PARSER TESTS PASSED SUCCESSFULLY!');
}

runGS1Tests().catch(err => {
  console.error('❌ GS1 TEST SUITE FAILED:', err);
  process.exit(1);
});
