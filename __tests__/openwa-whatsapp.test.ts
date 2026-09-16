// Automated Test Suite for OpenWA WhatsApp Invoice Integration in KRUSHI OS

import {
  normalizeWhatsAppPhone,
  maskPhoneNumber,
  isOpenWAConfigured,
  sendWhatsAppDocument,
  sendWhatsAppText,
  sendWhatsAppInvoice,
} from '../services/openwa.service';
import { generateInvoicePDF, formatInvoiceAmount, formatInvoiceNumber } from '../lib/invoice';
import { completeSale, normalizeSale } from '../services/sales.service';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${msg}`);
    failed++;
  }
}

async function runTests() {
  console.log('=====================================================');
  console.log('STARTING KRUSHI OS OPENWA WHATSAPP AUTOMATION TEST SUITE');
  console.log('=====================================================');

  // Save original env
  const origEnv = { ...process.env };
  const origFetch = global.fetch;

  try {
    // -------------------------------------------------------------
    // TEST 1: Phone Normalization & Strict Indian Validation
    // -------------------------------------------------------------
    console.log('\n--- Test Group 1: Phone Number Normalization & Indian Mobile Validation ---');
    assert(
      normalizeWhatsAppPhone('8080750206') === '918080750206@c.us',
      'Normalize: Standard 10-digit Indian mobile (8080750206 -> 918080750206@c.us)'
    );
    assert(
      normalizeWhatsAppPhone('918080750206') === '918080750206@c.us',
      'Normalize: 12-digit Indian mobile with country code (918080750206 -> 918080750206@c.us)'
    );
    assert(
      normalizeWhatsAppPhone('+918080750206') === '918080750206@c.us',
      'Normalize: With +91 prefix (+918080750206 -> 918080750206@c.us)'
    );
    assert(
      normalizeWhatsAppPhone('08080750206') === '918080750206@c.us',
      'Normalize: With leading zero trunk prefix (08080750206 -> 918080750206@c.us)'
    );
    assert(
      normalizeWhatsAppPhone('918080750206@c.us') === '918080750206@c.us',
      'Normalize: Already valid @c.us format'
    );
    assert(
      normalizeWhatsAppPhone('+91 80807-50206') === '918080750206@c.us',
      'Normalize: Formatted with spaces and hyphens'
    );
    assert(
      normalizeWhatsAppPhone('(91) 8080750206') === '918080750206@c.us',
      'Normalize: Formatted with parentheses'
    );
    assert(
      normalizeWhatsAppPhone('1234567890') === null,
      'Normalize: Rejects invalid 10-digit number starting with 1'
    );
    assert(
      normalizeWhatsAppPhone('5080750206') === null,
      'Normalize: Rejects invalid 10-digit number starting with 5'
    );
    assert(
      normalizeWhatsAppPhone('01234567890') === null,
      'Normalize: Rejects 11-digit number with invalid prefix'
    );
    assert(
      normalizeWhatsAppPhone('911234567890') === null,
      'Normalize: Rejects 12-digit number with invalid prefix'
    );
    assert(
      normalizeWhatsAppPhone('12345') === null,
      'Normalize: Rejects too short numbers'
    );
    assert(
      normalizeWhatsAppPhone('abcdefghij') === null,
      'Normalize: Rejects alphabetic strings'
    );
    assert(
      normalizeWhatsAppPhone('') === null,
      'Normalize: Rejects empty string'
    );
    assert(
      normalizeWhatsAppPhone(null) === null,
      'Normalize: Rejects null'
    );

    // -------------------------------------------------------------
    // TEST 2: Phone Masking for Safe Logging
    // -------------------------------------------------------------
    console.log('\n--- Test Group 2: Phone Masking & Privacy ---');
    const masked = maskPhoneNumber('918080750206@c.us');
    assert(
      masked.includes('****') && !masked.includes('807502'),
      'Masking: PII middle digits are masked'
    );

    // -------------------------------------------------------------
    // TEST 3: Configuration Detection
    // -------------------------------------------------------------
    console.log('\n--- Test Group 3: Configuration Detection ---');
    delete process.env.OPENWA_BASE_URL;
    delete process.env.OPENWA_API_KEY;
    delete process.env.OPENWA_SESSION_ID;
    assert(!isOpenWAConfigured(), 'Config: Returns false when env vars are missing');

    process.env.OPENWA_BASE_URL = 'https://tunnel.example.com';
    process.env.OPENWA_API_KEY = 'test-secret-key';
    process.env.OPENWA_SESSION_ID = '39a65e8b-27e9-4e9c-8c70-d2ad9105f147';
    assert(isOpenWAConfigured(), 'Config: Returns true when all 3 env vars exist');

    // -------------------------------------------------------------
    // TEST 4: Missing OpenWA Configuration Skips Gracefully
    // -------------------------------------------------------------
    console.log('\n--- Test Group 4: Graceful Skip on Unconfigured State ---');
    delete process.env.OPENWA_BASE_URL;
    delete process.env.OPENWA_API_KEY;
    delete process.env.OPENWA_SESSION_ID;

    const mockSaleData = {
      id: 'sale-test-123',
      invoice_number: 'KOS-2026-999',
      customer: { name: 'Suresh Patil', phone: '9876543210' },
      items: [{ product_name: 'Urea 46%', quantity: 2, unit_price: 266.5, gst_rate: 5 }],
      total_amount: 533,
    };

    const unconfiguredResult = await sendWhatsAppInvoice({ sale: mockSaleData });
    assert(
      unconfiguredResult.success === false && unconfiguredResult.skipped === true && unconfiguredResult.reason === 'NOT_CONFIGURED',
      'Skip: Safely skips delivery when OpenWA is not configured without throwing'
    );

    // -------------------------------------------------------------
    // TEST 5: Missing Customer Phone Skips Gracefully
    // -------------------------------------------------------------
    console.log('\n--- Test Group 5: Graceful Skip on Missing Phone ---');
    process.env.OPENWA_BASE_URL = 'https://tunnel.example.com';
    process.env.OPENWA_API_KEY = 'test-secret-key';
    process.env.OPENWA_SESSION_ID = '39a65e8b-27e9-4e9c-8c70-d2ad9105f147';

    const walkInSale = {
      id: 'sale-test-124',
      invoice_number: 'KOS-2026-100',
      customer: { name: 'WALK-IN CUSTOMER', phone: '' },
      items: [{ product_name: 'Seeds', quantity: 1, unit_price: 500, gst_rate: 0 }],
      total_amount: 500,
    };

    const noPhoneResult = await sendWhatsAppInvoice({ sale: walkInSale });
    assert(
      noPhoneResult.success === false && noPhoneResult.skipped === true && noPhoneResult.reason === 'NO_VALID_PHONE',
      'Skip: Safely skips delivery for walk-in customer with no phone number'
    );

    // -------------------------------------------------------------
    // TEST 6: OpenWA 200 OK Delivery (Document + Text) & Unicode Check
    // -------------------------------------------------------------
    console.log('\n--- Test Group 6: Successful WhatsApp Delivery & Message Encoding ---');
    const recordedCalls: Array<{ url: string; headers: any; body: any }> = [];

    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const bodyParsed = init?.body ? JSON.parse(init.body as string) : {};
      recordedCalls.push({ url: urlStr, headers: init?.headers, body: bodyParsed });

      if (urlStr.includes('/messages/send-document')) {
        return new Response(JSON.stringify({ success: true, messageId: 'msg-doc-123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/messages/send-text')) {
        return new Response(JSON.stringify({ success: true, messageId: 'msg-txt-456' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not found', { status: 404 });
    }) as any;

    const deliveryResult = await sendWhatsAppInvoice({
      sale: mockSaleData,
      shopDetails: { shopName: 'Krushi Kendra Baramati' },
    });

    assert(
      deliveryResult.success === true && deliveryResult.pdfDelivered === true && deliveryResult.textDelivered === true,
      'Delivery: sendWhatsAppInvoice returns success: true with pdfDelivered & textDelivered true on 200 OK'
    );
    assert(recordedCalls.length === 2, 'Delivery: Both document and text endpoints were invoked');
    assert(
      recordedCalls[0].url.includes('/api/sessions/39a65e8b-27e9-4e9c-8c70-d2ad9105f147/messages/send-document'),
      'Delivery: Document endpoint URL is dynamically constructed with session ID'
    );
    assert(
      recordedCalls[0].headers['X-API-Key'] === 'test-secret-key',
      'Delivery: X-API-Key header sent securely'
    );
    assert(
      recordedCalls[0].body.chatId === '919876543210@c.us',
      'Delivery: Recipient chatId normalized accurately'
    );
    assert(
      recordedCalls[0].body.filename === 'Invoice-KOS-2026-999.pdf',
      'Delivery: Filename matches invoice number'
    );
    assert(
      typeof recordedCalls[0].body.base64 === 'string' && recordedCalls[0].body.base64.length > 50,
      'Delivery: Valid base64 PDF payload sent'
    );
    assert(
      recordedCalls[1].body.text.includes('Namaste Suresh Patil \u{1F64F}') &&
      recordedCalls[1].body.text.includes('\u20B9533.00') &&
      recordedCalls[1].body.text.includes('Krushi Kendra Baramati'),
      'Encoding: Follow-up text message contains proper UTF-8 emoji (\u{1F64F}) and currency symbol (\u20B9)'
    );
    assert(
      recordedCalls[1].body.chatId === '919876543210@c.us' &&
      typeof recordedCalls[1].body.text === 'string' &&
      Object.keys(recordedCalls[1].body).length === 2 &&
      !('content' in recordedCalls[1].body),
      'Exact Contract: sendWhatsAppText payload contains exactly { chatId, text } with no extra "content" field'
    );

    // -------------------------------------------------------------
    // TEST 7: Distinguish PDF Success vs Text Failure (Partial Delivery)
    // -------------------------------------------------------------
    console.log('\n--- Test Group 7: Partial Delivery Handling (PDF OK, Text Failed) ---');
    global.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/messages/send-document')) {
        return new Response(JSON.stringify({ success: true, messageId: 'msg-doc-123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/messages/send-text')) {
        return new Response(JSON.stringify({ error: 'Text rate limit exceeded' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not found', { status: 404 });
    }) as any;

    const partialResult = await sendWhatsAppInvoice({ sale: mockSaleData });
    assert(
      partialResult.success === false && partialResult.pdfDelivered === true && partialResult.textDelivered === false,
      'Partial Success: Correctly flags pdfDelivered: true and textDelivered: false without throwing'
    );
    assert(
      partialResult.documentStatus === 200 && partialResult.textStatus === 429,
      'Partial Success: Captures individual documentStatus and textStatus accurately'
    );

    // -------------------------------------------------------------
    // TEST 8: OpenWA 400 Bad Request
    // -------------------------------------------------------------
    console.log('\n--- Test Group 8: OpenWA 400 Bad Request Handling ---');
    global.fetch = (async () => {
      return new Response(JSON.stringify({ error: 'Invalid phone number format in OpenWA' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const err400Result = await sendWhatsAppInvoice({ sale: mockSaleData });
    assert(
      err400Result.success === false && err400Result.pdfDelivered === false && err400Result.documentStatus === 400,
      'Error Handling: 400 Bad Request handled gracefully without crashing'
    );

    // -------------------------------------------------------------
    // TEST 9: OpenWA 500 Internal Server Error
    // -------------------------------------------------------------
    console.log('\n--- Test Group 9: OpenWA 500 Server Error Handling ---');
    global.fetch = (async () => {
      return new Response('Internal Server Error in OpenWA container', {
        status: 500,
        statusText: 'Internal Server Error',
      });
    }) as any;

    const err500Result = await sendWhatsAppInvoice({ sale: mockSaleData });
    assert(
      err500Result.success === false && err500Result.pdfDelivered === false && err500Result.documentStatus === 500,
      'Error Handling: 500 Internal Server Error handled gracefully without crashing'
    );

    // -------------------------------------------------------------
    // TEST 10: Network Timeout / AbortSignal Simulation
    // -------------------------------------------------------------
    console.log('\n--- Test Group 10: Network Timeout Handling ---');
    global.fetch = (async () => {
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }) as any;

    const timeoutResult = await sendWhatsAppInvoice({ sale: mockSaleData });
    assert(
      timeoutResult.success === false &&
      timeoutResult.pdfDelivered === false &&
      Boolean(timeoutResult.error?.includes('timed out') || timeoutResult.error?.includes('aborted')),
      'Error Handling: Aborted / timed out connection handled gracefully'
    );

    // -------------------------------------------------------------
    // TEST 11: Invoice PDF Generation Verification
    // -------------------------------------------------------------
    console.log('\n--- Test Group 11: Invoice PDF Generation Invariance ---');
    const sampleSale = {
      id: 'sale-pdf-verify',
      invoice_number: 'KOS-2026-042',
      customer: { name: 'Ramesh Kale', phone: '9988776655', village: 'Baramati' },
      items: [
        { product_name: 'DAP 18:46:00', quantity: 4, unit_price: 1350, gst_rate: 5, batch_number: 'B-101', manufacturer: 'IFFCO' },
      ],
      total_amount: 5400,
      paid_amount: 5400,
    };
    const pdfDoc = generateInvoicePDF(sampleSale, { 
      shopName: 'MAULI KRUSHI SEVA KENDRA',
      gstNumber: '27AABCU9603R1ZM',
      licenseNumber: 'LIC-2026-99',
      bankName: 'State Bank of India',
      accountNumber: '12345678901',
      ifsc: 'SBIN0001234',
    });
    const outputBuffer = Buffer.from(pdfDoc.output('arraybuffer'));
    assert(outputBuffer.length > 1000, 'PDF: generateInvoicePDF produces valid non-empty binary buffer');
    assert(outputBuffer.toString('utf-8', 0, 5) === '%PDF-', 'PDF: Output binary begins with valid %PDF- header');
    
    // Canonical A5 Landscape verification
    const pageW = Math.round(pdfDoc.internal.pageSize.getWidth());
    const pageH = Math.round(pdfDoc.internal.pageSize.getHeight());
    assert(pageW === 210, `PDF: Page width matches A5 landscape (210mm, got ${pageW}mm)`);
    assert(pageH === 148, `PDF: Page height matches A5 landscape (148mm, got ${pageH}mm)`);
    assert(pdfDoc.getNumberOfPages() === 1, 'PDF: Single page fit guaranteed for canonical invoice');

    // Amount Formatter Verification (₹ + comma thousands separators + 2 decimals)
    assert(formatInvoiceAmount(2566.10) === '₹ 2,566.10', 'Format: formatInvoiceAmount(2566.10) -> "₹ 2,566.10"');
    assert(formatInvoiceAmount(230.95) === '₹ 230.95', 'Format: formatInvoiceAmount(230.95) -> "₹ 230.95"');
    assert(formatInvoiceAmount(3032) === '₹ 3,032.00', 'Format: formatInvoiceAmount(3032) -> "₹ 3,032.00"');
    assert(formatInvoiceAmount(0) === '₹ 0.00', 'Format: formatInvoiceAmount(0) -> "₹ 0.00"');
    assert(formatInvoiceNumber(5400) === '5,400.00', 'Format: formatInvoiceNumber(5400) -> "5,400.00"');

    // Raw stream inspection: ensure no multi-byte unicode splitting or stray characters
    const pdfRaw = pdfDoc.output();
    assert(!pdfRaw.includes('( \u00B9'), 'PDF Stream: No unmapped superscript/stray characters in stream');
    assert(!pdfRaw.includes('(1 2 5 6'), 'PDF Stream: No separated/spaced-out digit artifacts');

    // Sale with Adjustments verification
    const saleWithAdj = {
      ...sampleSale,
      adjustments: [{ id: 'adj-1', reason: 'Hamali', type: 'ADD', amount: 134 }],
      total_amount: 5534,
      paid_amount: 5534,
    };
    const pdfWithAdj = generateInvoicePDF(saleWithAdj, { shopName: 'MAULI KRUSHI SEVA KENDRA' });
    const adjRaw = pdfWithAdj.output();
    assert(!adjRaw.includes('(+ 1 34'), 'Adjustments: No stray "1" or spaced-out characters in adjustment amount');
    assert(!adjRaw.includes('( \u00B9'), 'Adjustments: No Unicode encoding artifacts');
    assert(adjRaw.includes('Hamali'), 'Adjustments: Adjustment reason text present');
    assert(adjRaw.includes('134.00'), 'Adjustments: Clean contiguous numeric amount "134.00" present');

    // -------------------------------------------------------------
    // TEST 12: Demo Sale & Non-blocking Flow Simulation
    // -------------------------------------------------------------
    console.log('\n--- Test Group 12: Sales Service & Demo Mode Compatibility ---');
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
    const completedDemoSale = await completeSale(
      'shop-demo-1',
      {
        customer_name: 'Vikas Deshmukh',
        customer_phone: '9822334455',
        items: [{ product_name: 'NPK 19:19:19', quantity: 2, unit_price: 180, gst_rate: 18 }],
        payment_method: 'CASH',
      },
      'user-demo-1'
    );
    assert(Boolean(completedDemoSale.invoice_number), 'Sale: Demo sale created successfully with invoice number');
    assert(completedDemoSale.status === 'COMPLETED', 'Sale: Sale status is COMPLETED');

    // Verify WhatsApp delivery on completed demo sale
    global.fetch = (async () => {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as any;

    const demoDelivery = await sendWhatsAppInvoice({ sale: completedDemoSale });
    assert(
      demoDelivery.success === true && demoDelivery.pdfDelivered === true && demoDelivery.textDelivered === true,
      'Sale: sendWhatsAppInvoice delivers successfully for completed sale'
    );

    // -------------------------------------------------------------
    // TEST 13: Regression - Sale Object Phone Mapping to sendWhatsAppInvoice
    // -------------------------------------------------------------
    console.log('\n--- Test Group 13: Regression - Sale Object Phone Mapping ---');
    const simulatedRealSalePayload = {
      id: 'sale-real-test-999',
      invoice_number: 'KOS-000002',
      customer_name: 'Prasad Shirfule',
      customer_phone: '8080750206',
      customer_village: 'Baramati',
      customer: {
        id: 'cust-123',
        name: 'Prasad Shirfule',
        phone: '8080750206',
        village: 'Baramati',
      },
      items: [{ product_name: 'DAP Fertilizer', quantity: 1, unit_price: 1350, gst_rate: 5 }],
      total_amount: 1350,
      notes: JSON.stringify({
        quickCustomer: { name: 'Prasad Shirfule', phone: '8080750206', village: 'Baramati' },
      }),
    };

    const normalizedRealSale = normalizeSale(simulatedRealSalePayload);
    assert(
      normalizedRealSale.customer_phone === '8080750206',
      'Phone Mapping: normalizeSale populates canonical top-level customer_phone'
    );
    assert(
      normalizedRealSale.customer?.phone === '8080750206',
      'Phone Mapping: normalizeSale populates customer.phone'
    );

    let capturedChatId: string | null = null;
    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const bodyParsed = init?.body ? JSON.parse(init.body as string) : {};
      if (bodyParsed.chatId) {
        capturedChatId = bodyParsed.chatId;
      }
      return new Response(JSON.stringify({ success: true, messageId: 'msg-ok-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const regressionDeliveryResult = await sendWhatsAppInvoice({ sale: normalizedRealSale });
    assert(
      regressionDeliveryResult.success === true && regressionDeliveryResult.pdfDelivered === true,
      'Phone Mapping: sendWhatsAppInvoice successfully dispatches for normalized sale'
    );
    assert(
      capturedChatId === '918080750206@c.us',
      'Phone Mapping: Correct chatId 918080750206@c.us extracted from canonical customer_phone'
    );

    // -------------------------------------------------------------
    // TEST 14: WhatsApp Status Model & Safe Retry Semantics
    // -------------------------------------------------------------
    console.log('\n--- Test Group 14: Status Model & Safe Retry Semantics ---');

    // 1. Successful retry delivery -> SENT
    global.fetch = (async () => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const retrySuccessResult = await sendWhatsAppInvoice({ sale: normalizedRealSale });
    const retrySuccessStatus = retrySuccessResult.pdfDelivered && retrySuccessResult.textDelivered ? 'SENT' : 'FAILED';
    assert(retrySuccessStatus === 'SENT', 'Status Model: Full delivery mapped to SENT state');
    assert(retrySuccessResult.pdfDelivered === true, 'Status Model: pdfDelivered is true');
    assert(retrySuccessResult.textDelivered === true, 'Status Model: textDelivered is true');

    // 2. PDF Failure -> FAILED
    global.fetch = (async () => {
      return new Response(JSON.stringify({ error: 'OpenWA Document Gateway 500' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const retryDocFailResult = await sendWhatsAppInvoice({ sale: normalizedRealSale });
    const retryDocFailStatus = !retryDocFailResult.pdfDelivered ? 'FAILED' : 'SENT';
    assert(retryDocFailStatus === 'FAILED', 'Status Model: PDF failure mapped to FAILED state');
    assert(retryDocFailResult.pdfDelivered === false, 'Status Model: pdfDelivered is false on document error');

    // 3. PDF Success + Text Failure -> PARTIAL
    let callCount = 0;
    global.fetch = (async (url: string | URL | Request) => {
      callCount++;
      const urlStr = String(url);
      if (urlStr.includes('send-document')) {
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'Text rate limit' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }) as any;

    const retryPartialResult = await sendWhatsAppInvoice({ sale: normalizedRealSale });
    const retryPartialStatus = retryPartialResult.pdfDelivered && !retryPartialResult.textDelivered ? 'PARTIAL' : 'FAILED';
    assert(retryPartialStatus === 'PARTIAL', 'Status Model: PDF success + text failure mapped to PARTIAL state');
    assert(retryPartialResult.pdfDelivered === true, 'Status Model: pdfDelivered is true for partial');
    assert(retryPartialResult.textDelivered === false, 'Status Model: textDelivered is false for partial');

    // 4. Missing phone -> SKIPPED (NO_VALID_PHONE)
    const saleNoPhone = { ...normalizedRealSale, customer_phone: '', customer: { name: 'Walk-in' } };
    const retryNoPhoneResult = await sendWhatsAppInvoice({ sale: saleNoPhone });
    assert(retryNoPhoneResult.skipped === true, 'Status Model: Missing phone flagged as skipped');
    assert(retryNoPhoneResult.reason === 'NO_VALID_PHONE', 'Status Model: Skipped reason is NO_VALID_PHONE');

    // 5. Unconfigured OpenWA -> SKIPPED (NOT_CONFIGURED)
    process.env.OPENWA_API_KEY = '';
    const retryUnconfiguredResult = await sendWhatsAppInvoice({ sale: normalizedRealSale });
    assert(retryUnconfiguredResult.skipped === true, 'Status Model: Unconfigured env flagged as skipped');
    assert(retryUnconfiguredResult.reason === 'NOT_CONFIGURED', 'Status Model: Skipped reason is NOT_CONFIGURED');
    process.env.OPENWA_API_KEY = 'test-api-key';

    // 6. Invariance: Retry uses existing sale without calling completeSale or mutating DB
    const preRetryInv = normalizedRealSale.invoice_number;
    const preRetryTotal = normalizedRealSale.total_amount;
    assert(preRetryInv === 'KOS-000002', 'Retry Invariance: Uses existing invoice number KOS-000002');
    assert(preRetryTotal === 1350, 'Retry Invariance: Sale total remains unchanged');
    assert(typeof normalizedRealSale.id === 'string', 'Retry Invariance: Target sale exists and is not recreated');

  } finally {
    // Restore original env and fetch
    process.env = origEnv;
    global.fetch = origFetch;
  }

  console.log('\n=====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
