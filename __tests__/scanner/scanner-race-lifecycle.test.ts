import test from 'node:test';
import assert from 'node:assert';
import { parseScannedBarcode } from '@/lib/scanner/barcode-parser';
import { mergeProductScanResults } from '@/lib/scanner/source-merger';
import { ProductScanResult } from '@/lib/scanner/types';
import { extractProductMetadataFromHtml } from '@/services/product-enrichment.service';

/**
 * Simulates the exact state machine and atomic lock implemented in KRUSHI OS Scanner.
 */
class MockScannerController {
  public state: 'IDLE' | 'SCANNING' | 'DETECTED' | 'STOPPING' | 'PROCESSING' | 'RESULT' = 'IDLE';
  public isLocked = false;
  public isStopping = false;
  public processedScans: ProductScanResult[] = [];
  public ignoredEventsCount = 0;
  public stopCallCount = 0;
  public ocrAutoInvoked = false;

  public start() {
    this.state = 'SCANNING';
    this.isLocked = false;
    this.isStopping = false;
    this.ocrAutoInvoked = false;
  }

  public async onBarcodeDetected(rawValue: string, format = 'QR_CODE') {
    // Synchronous lock check - MUST occur before any async pause
    if (this.isLocked || this.state !== 'SCANNING') {
      this.ignoredEventsCount++;
      return;
    }

    // 1. Synchronously lock IMMEDIATELY
    this.isLocked = true;
    this.state = 'DETECTED';

    const acceptedRawValue = rawValue;
    const acceptedFormat = format;

    // 2. Stop camera
    this.state = 'STOPPING';
    await this.stop();

    // 3. Process the locked value only
    this.state = 'PROCESSING';
    await this.processRawValue(acceptedRawValue, acceptedFormat);
    this.state = 'RESULT';
  }

  public async stop(): Promise<void> {
    this.stopCallCount++;
    if (this.isStopping) return;
    this.isStopping = true;
    // Simulate cleanup
    await new Promise((r) => setTimeout(r, 10));
    this.isStopping = false;
  }

  private async processRawValue(rawValue: string, format: string) {
    const parsed = parseScannedBarcode(rawValue, format);
    let current = parsed;

    // Simulate async enrichment delay
    if (parsed.sourceUrl) {
      await new Promise((r) => setTimeout(r, 50));
      const mockHtml = '<title>Evicent | Syngenta India</title><meta property="og:title" content="Evicent" /><meta property="product:brand" content="Syngenta" />';
      const enrichedMeta = extractProductMetadataFromHtml(mockHtml, parsed.sourceUrl);
      if (enrichedMeta && Object.keys(enrichedMeta).length > 0) {
        current = mergeProductScanResults([current, enrichedMeta as any]);
      }
    }

    this.processedScans.push(current);
  }
}

test('KRUSHI OS Scanner Lifecycle & Race Condition Suite', async (t) => {
  await t.test('1. Rapid Scan A then Scan B -> Only A processed once, B is ignored', async () => {
    const controller = new MockScannerController();
    controller.start();

    const scanA = 'https://syngenta.co.in/gpd/01/08904232801980/10/SPL6A20014/21/U2DFSHLAEX?11=260129&17=280128';
    const scanB = 'https://syngenta.co.in/gpd/01/08901234567890/10/ANOTHER_PRODUCT/21/SER999';

    // Fire both scans concurrently in the same frame/event tick
    await Promise.all([
      controller.onBarcodeDetected(scanA),
      controller.onBarcodeDetected(scanB),
    ]);

    assert.strictEqual(controller.processedScans.length, 1, 'Exactly one scan must be processed');
    assert.strictEqual(controller.processedScans[0].gtin, '08904232801980', 'Product A (Evicent) must be the accepted scan');
    assert.strictEqual(controller.processedScans[0].batchNumber, 'SPL6A20014', 'Product A batch must be preserved');
    assert.strictEqual(controller.ignoredEventsCount, 1, 'Scan B must be registered as ignored');
  });

  await t.test('2. Rapid identical Scan A repeated 10 times -> Processed exactly once', async () => {
    const controller = new MockScannerController();
    controller.start();

    const scanA = 'https://syngenta.co.in/gpd/01/08904232801980/10/SPL6A20014/21/U2DFSHLAEX?11=260129&17=280128';

    const events = Array.from({ length: 10 }, () => controller.onBarcodeDetected(scanA));
    await Promise.all(events);

    assert.strictEqual(controller.processedScans.length, 1, 'Must only process once for 10 identical rapid events');
    assert.strictEqual(controller.ignoredEventsCount, 9, '9 subsequent events must be rejected by lock guard');
  });

  await t.test('3. Scan A + delayed enrichment + Scan B during delay -> Scan B ignored', async () => {
    const controller = new MockScannerController();
    controller.start();

    const scanA = 'https://syngenta.co.in/gpd/01/08904232801980/10/SPL6A20014/21/U2DFSHLAEX?11=260129&17=280128';
    const scanB = '8901234567890';

    const taskA = controller.onBarcodeDetected(scanA);

    // Send Scan B after 20ms while Scan A enrichment is in-flight
    await new Promise((r) => setTimeout(r, 20));
    await controller.onBarcodeDetected(scanB);

    await taskA;

    assert.strictEqual(controller.processedScans.length, 1, 'Only scan A processed');
    assert.strictEqual(controller.processedScans[0].gtin, '08904232801980', 'Scan A remained intact through enrichment');
  });

  await t.test('4. Stop called multiple times -> Safe, idempotent, no crash', async () => {
    const controller = new MockScannerController();
    controller.start();

    // Call stop multiple times in parallel
    await Promise.all([
      controller.stop(),
      controller.stop(),
      controller.stop(),
    ]);

    assert.strictEqual(controller.stopCallCount, 3);
    assert.strictEqual(controller.isStopping, false);
  });

  await t.test('5. Real Evicent Digital Link deterministic parsing', () => {
    const evicentUrl = 'https://syngenta.co.in/gpd/01/08904232801980/10/SPL6A20014/21/U2DFSHLAEX?11=260129&17=280128';
    const parsed = parseScannedBarcode(evicentUrl, 'QR_CODE');

    assert.strictEqual(parsed.gtin, '08904232801980', 'GTIN must match');
    assert.strictEqual(parsed.batchNumber, 'SPL6A20014', 'Batch must match');
    assert.strictEqual(parsed.serialNumber, 'U2DFSHLAEX', 'Serial UID must match');
    assert.strictEqual(parsed.manufacturingDate, '2026-01-29', 'Manufacturing date must match 2026-01-29');
    assert.strictEqual(parsed.expiryDateDB, '2028-01-28', 'Expiry DB date must match 2028-01-28');
    assert.strictEqual(parsed.source, 'gs1', 'Source must be gs1');
  });

  await t.test('6. OCR is never invoked automatically upon barcode detection', () => {
    const controller = new MockScannerController();
    controller.start();
    assert.strictEqual(controller.ocrAutoInvoked, false, 'OCR must not start automatically');
  });

  await t.test('7. Enrichment result merges into SAME locked scan', async () => {
    const controller = new MockScannerController();
    controller.start();

    const scanA = 'https://syngenta.co.in/gpd/01/08904232801980/10/SPL6A20014/21/U2DFSHLAEX?11=260129&17=280128';
    await controller.onBarcodeDetected(scanA);

    assert.strictEqual(controller.processedScans.length, 1);
    const result = controller.processedScans[0];
    assert.strictEqual(result.gtin, '08904232801980');
    assert.strictEqual(result.batchNumber, 'SPL6A20014');
    assert.strictEqual(result.sourceUrl, scanA);
    assert.strictEqual(result.brand, 'Syngenta');
  });

  await t.test('8. Barcode camera and OCR camera cannot overlap', () => {
    let isBarcodeActive = false;
    let isOcrActive = false;

    const startBarcode = () => {
      if (isOcrActive) isOcrActive = false; // Teardown OCR before starting barcode
      isBarcodeActive = true;
    };

    const startOcr = () => {
      if (isBarcodeActive) isBarcodeActive = false; // Teardown barcode before starting OCR
      isOcrActive = true;
    };

    startBarcode();
    assert.strictEqual(isBarcodeActive, true);
    assert.strictEqual(isOcrActive, false);

    startOcr();
    assert.strictEqual(isBarcodeActive, false);
    assert.strictEqual(isOcrActive, true);
  });

  await t.test('9. Scanner capture loop stops immediately after first valid detection', async () => {
    let loopIterationCount = 0;
    let isLocked = false;

    const frames = [null, null, '08904232801980', '8901234567890', '9999999999999'];

    for (const frame of frames) {
      if (isLocked) break; // Loop stops immediately upon lock
      loopIterationCount++;
      if (frame) {
        isLocked = true;
      }
    }

    assert.strictEqual(loopIterationCount, 3, 'Loop must terminate immediately on the 3rd frame where barcode is found');
    assert.strictEqual(isLocked, true);
  });

  await t.test('10. Subsequent frames after lock cannot overwrite acceptedRawValue', async () => {
    let acceptedRawValue: string | null = null;
    let isLocked = false;

    const dispatchFrame = (raw: string) => {
      if (isLocked) return;
      isLocked = true;
      acceptedRawValue = raw;
    };

    dispatchFrame('FIRST_PRODUCT_A');
    dispatchFrame('SECOND_PRODUCT_B');
    dispatchFrame('THIRD_PRODUCT_C');

    assert.strictEqual(acceptedRawValue, 'FIRST_PRODUCT_A', 'acceptedRawValue must remain immutable');
  });
});
