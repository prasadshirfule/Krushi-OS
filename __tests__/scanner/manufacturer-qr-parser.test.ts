import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { parseManufacturerQr, normalizeManufacturerDate } from '@/lib/scanner/manufacturer-qr-parser';
import { parseScannedBarcode } from '@/lib/scanner/barcode-parser';
import { mergeProductScanResults } from '@/lib/scanner/source-merger';

test('Date Normalizer: Supports multiple standard date formats without day/month swapping', () => {
  // DD-MM-YYYY
  const d1 = normalizeManufacturerDate('18-01-2025');
  assert.ok(d1);
  assert.strictEqual(d1.uiDate, '18/01/2025');
  assert.strictEqual(d1.dbDate, '2025-01-18');

  // DD/MM/YYYY
  const d2 = normalizeManufacturerDate('28/06/2028');
  assert.ok(d2);
  assert.strictEqual(d2.uiDate, '28/06/2028');
  assert.strictEqual(d2.dbDate, '2028-06-28');

  // DD.MM.YYYY
  const d3 = normalizeManufacturerDate('15.08.2026');
  assert.ok(d3);
  assert.strictEqual(d3.uiDate, '15/08/2026');
  assert.strictEqual(d3.dbDate, '2026-08-15');

  // YYYY-MM-DD
  const d4 = normalizeManufacturerDate('2027-11-30');
  assert.ok(d4);
  assert.strictEqual(d4.uiDate, '30/11/2027');
  assert.strictEqual(d4.dbDate, '2027-11-30');

  // YYMMDD (GS1 compact)
  const d5 = normalizeManufacturerDate('260129');
  assert.ok(d5);
  assert.strictEqual(d5.uiDate, '29/01/2026');
  assert.strictEqual(d5.dbDate, '2026-01-29');

  // Invalid date
  assert.strictEqual(normalizeManufacturerDate('32-01-2025'), null);
  assert.strictEqual(normalizeManufacturerDate('15-13-2025'), null);
  assert.strictEqual(normalizeManufacturerDate('invalid'), null);
});

test('Format 1: Real Bayer agricultural product QR payload from fixture', () => {
  const fixturePath = path.join(process.cwd(), '__tests__/scanner/fixtures/bayer-product-qr.txt');
  const rawPayload = fs.readFileSync(fixturePath, 'utf8');

  const result = parseScannedBarcode(rawPayload);

  assert.ok(result);
  assert.strictEqual(result.source, 'structured_qr');
  assert.strictEqual(result.batchNumber, 'SYNAT25026DT');
  assert.strictEqual(result.manufacturingDate, '2025-01-18');
  assert.strictEqual(result.expiryDate, '17/01/2027');
  assert.strictEqual(result.expiryDateDB, '2027-01-17');
  assert.strictEqual(result.serialNumber, '9183277589941951');
  assert.strictEqual(result.sourceUrl, 'https://crop-protection.bayer.com/IN/gr/9183277589941951');
  
  // Provenance check
  assert.strictEqual(result.fieldSources?.['batchNumber'], 'structured_qr');
  assert.strictEqual(result.fieldSources?.['manufacturingDate'], 'structured_qr');
  assert.strictEqual(result.fieldSources?.['expiryDate'], 'structured_qr');
  assert.strictEqual(result.fieldSources?.['serialNumber'], 'structured_qr');
});

test('Format 2: URL with "URL:" prefix and hybrid key-value lines', () => {
  const payload = `URL:https://agri-trace.com/item/109283
No:BAT-AUG-2026
MFG:01-08-2025
EXP:31-07-2028
UID:UID-998877
MRP:1250.00
SIZE:500 ML`;

  const result = parseManufacturerQr(payload);

  assert.ok(result);
  assert.strictEqual(result.batchNumber, 'BAT-AUG-2026');
  assert.strictEqual(result.manufacturingDate, '2025-08-01');
  assert.strictEqual(result.expiryDate, '31/07/2028');
  assert.strictEqual(result.serialNumber, 'UID-998877');
  assert.strictEqual(result.mrp, 1250);
  assert.strictEqual(result.packSize, '500 ML');
  assert.strictEqual(result.sizeValue, 500);
  assert.strictEqual(result.sizeUnit, 'ML');
  assert.strictEqual(result.sourceUrl, 'https://agri-trace.com/item/109283');
});

test('Format 3: URL with query parameters containing batch, mfg, exp, uid', () => {
  const payload = 'https://track.agri.org/scan?batch=LOT-2026X&mfg=15/03/2025&exp=14/03/2027&uid=987654321012&hsn=3808&gst=18';

  const result = parseScannedBarcode(payload);

  assert.ok(result);
  assert.strictEqual(result.source, 'structured_qr');
  assert.strictEqual(result.batchNumber, 'LOT-2026X');
  assert.strictEqual(result.manufacturingDate, '2025-03-15');
  assert.strictEqual(result.expiryDate, '14/03/2027');
  assert.strictEqual(result.serialNumber, '987654321012');
  assert.strictEqual(result.hsnCode, '3808');
  assert.strictEqual(result.gstRate, 18);
});

test('Format 4: Single line with multi-field delimiters (pipes/spaces)', () => {
  const payload = 'https://track.org/item/8888|No:SPL6A20014|MFG:29-01-2026|EXP:28-01-2028|UID:U2DFSHLAEX';

  const result = parseScannedBarcode(payload);

  assert.ok(result);
  assert.strictEqual(result.batchNumber, 'SPL6A20014');
  assert.strictEqual(result.manufacturingDate, '2026-01-29');
  assert.strictEqual(result.expiryDate, '28/01/2028');
  assert.strictEqual(result.serialNumber, 'U2DFSHLAEX');
});

test('Format 5: Structured QR with Product Name, Category, and Size', () => {
  const payload = `PRODUCT: CORAGEN INSECTICIDE
MANUFACTURER: FMC INDIA
BATCH NO: FMC-2026-A
MFG DATE: 10/02/2025
EXP DATE: 09/02/2028
SIZE: 60 ML
MRP: 1850`;

  const result = parseScannedBarcode(payload);

  assert.ok(result);
  assert.strictEqual(result.productName, 'CORAGEN INSECTICIDE');
  assert.strictEqual(result.manufacturer, 'FMC INDIA');
  assert.strictEqual(result.batchNumber, 'FMC-2026-A');
  assert.strictEqual(result.manufacturingDate, '2025-02-10');
  assert.strictEqual(result.expiryDate, '09/02/2028');
  assert.strictEqual(result.packSize, '60 ML');
  assert.strictEqual(result.sizeValue, 60);
  assert.strictEqual(result.sizeUnit, 'ML');
  assert.strictEqual(result.mrp, 1850);
});

test('Format 6: GS1 Digital Link URL (Syngenta Evicent)', () => {
  const payload = 'https://syngenta.co.in/gpd/01/08904232801980/10/SPL6A20014/21/U2DFSHLAEX?11=260129&17=280128';
  const result = parseScannedBarcode(payload);

  assert.strictEqual(result.source, 'gs1');
  assert.strictEqual(result.gtin, '08904232801980');
  assert.strictEqual(result.batchNumber, 'SPL6A20014');
  assert.strictEqual(result.serialNumber, 'U2DFSHLAEX');
  assert.strictEqual(result.manufacturingDate, '2026-01-29');
  assert.strictEqual(result.expiryDate, '28/01/2028');
});

test('Format 7: GS1 AI Bracketed Barcode', () => {
  const payload = '(01)08904232801980(10)SPL6A20014(17)280128';
  const result = parseScannedBarcode(payload);

  assert.strictEqual(result.source, 'gs1');
  assert.strictEqual(result.gtin, '08904232801980');
  assert.strictEqual(result.batchNumber, 'SPL6A20014');
  assert.strictEqual(result.expiryDate, '28/01/2028');
});

test('Format 8: Plain 1D Barcode (EAN-13, EAN-8, UPC)', () => {
  const ean13 = '8901234567890';
  const result = parseScannedBarcode(ean13);

  assert.strictEqual(result.source, 'barcode');
  assert.strictEqual(result.barcode, '8901234567890');
  assert.strictEqual(result.gtin, '8901234567890');
});

test('Format 9: Unknown plain text / unstructured string does not crash', () => {
  const unstructured = 'JUST RANDOM UNSTRUCTURED TEXT 12345';
  const result = parseScannedBarcode(unstructured);

  assert.ok(result);
  assert.strictEqual(result.source, 'barcode');
  assert.strictEqual(result.barcode, 'JUST RANDOM UNSTRUCTURED TEXT 12345');
});

test('Format 10: Malformed input (empty, spaces, symbols) handled safely', () => {
  assert.strictEqual(parseScannedBarcode('').source, 'unknown');
  assert.strictEqual(parseScannedBarcode('   ').source, 'unknown');
  assert.strictEqual(parseManufacturerQr(''), null);
});

test('Source Priority: QR structured fields take precedence over weaker sources during merge', () => {
  const qrScan = parseScannedBarcode(`No:BAT-QR-01\nMFG:01-01-2025\nEXP:01-01-2027\nUID:UID-1234`);
  
  const webEnrichment = {
    rawValue: 'https://example.com',
    format: 'QR_CODE',
    source: 'manufacturer_url' as const,
    productName: 'ENRICHED PRODUCT NAME',
    batchNumber: 'WEAKER-WEB-BATCH', // Should NOT overwrite QR
  };

  const merged = mergeProductScanResults([qrScan, webEnrichment]);

  assert.strictEqual(merged.batchNumber, 'BAT-QR-01'); // QR wins over web
  assert.strictEqual(merged.productName, 'ENRICHED PRODUCT NAME'); // Web fills missing product name
  assert.strictEqual(merged.manufacturingDate, '2025-01-01');
  assert.strictEqual(merged.expiryDate, '01/01/2027');
});
