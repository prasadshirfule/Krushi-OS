import assert from 'node:assert';
import { Msg91SmsProvider } from '../../lib/sms/providers/msg91';

console.log('================================================================');
console.log('🧪 KRUSHI OS — MSG91 FLOW API V5 PAYLOAD VALIDATION TESTS');
console.log('================================================================\n');

// Set dummy env variables for test
process.env.MSG91_AUTH_KEY = 'test_auth_key_123456';
process.env.MSG91_SENDER_ID = 'KRUSHI';
process.env.MSG91_DLT_TE_ID_INVOICE = 'template_inv_001';

const originalFetch = globalThis.fetch;

try {
  let capturedUrl = '';
  let capturedHeaders: Record<string, string> = {};
  let capturedBody: any = null;

  // Mock fetch to capture payload
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    capturedBody = JSON.parse(String(init?.body || '{}'));

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        type: 'success',
        message: 'req_msg91_mock_id_9999',
      }),
    } as unknown as Response;
  }) as typeof fetch;

  const provider = new Msg91SmsProvider();
  assert.strictEqual(provider.isConfigured(), true, 'Provider is configured with test credentials');

  console.log('--- TEST 1: MSG91 Flow API v5 Payload Structure ---');
  const result = await provider.send({
    recipientPhone: '9876543210',
    messageType: 'INVOICE',
    messageBody: 'Test invoice message body',
    shopId: 'shop-test-1',
    dltTemplateId: 'flow_inv_prod_101',
    variables: {
      farmer_name: 'Dnyaneshwar Patil',
      invoice_number: 'KOS-2026-0888',
      amount: '4500.00',
      shop_name: 'Shree Krushi Seva Kendra',
      document_url: 'https://krushios.vercel.app/docs/v/abc123token',
    },
    idempotencyKey: 'idemp-test-msg91-001',
  });

  assert.strictEqual(result.success, true, 'Send call succeeded');
  assert.strictEqual(result.status, 'submitted', 'Status is submitted');
  assert.strictEqual(result.providerMessageId, 'req_msg91_mock_id_9999', 'Message ID captured');

  // Verify URL and Headers
  assert.strictEqual(capturedUrl, 'https://control.msg91.com/api/v5/flow/', 'Sent to correct v5 Flow endpoint');
  assert.strictEqual(capturedHeaders['authkey'], 'test_auth_key_123456', 'authkey header present');
  assert.strictEqual(capturedHeaders['Content-Type'], 'application/json', 'Content-Type is JSON');

  // Verify MSG91 Flow v5 Recipients Array Specification
  assert.ok(capturedBody, 'Captured body exists');
  assert.strictEqual(capturedBody.template_id, 'flow_inv_prod_101', 'Template ID matches');
  assert.strictEqual(capturedBody.sender, 'KRUSHI', 'Sender ID matches');
  assert.strictEqual(capturedBody.short_url, '0', 'short_url is "0"');

  // CRITICAL ASSERTION: recipients must be an array of objects containing mobiles and variables
  assert.ok(Array.isArray(capturedBody.recipients), 'Body MUST have recipients array');
  assert.strictEqual(capturedBody.recipients.length, 1, 'Recipients has 1 recipient');
  const recipient0 = capturedBody.recipients[0];
  assert.strictEqual(recipient0.mobiles, '919876543210', 'Normalized 12-digit Indian mobile with 91 prefix');
  assert.strictEqual(recipient0.farmer_name, 'Dnyaneshwar Patil', 'Variable farmer_name is inside recipient object');
  assert.strictEqual(recipient0.invoice_number, 'KOS-2026-0888', 'Variable invoice_number is inside recipient object');
  assert.strictEqual(recipient0.amount, '4500.00', 'Variable amount is inside recipient object');
  assert.strictEqual(recipient0.document_url, 'https://krushios.vercel.app/docs/v/abc123token', 'Variable document_url is inside recipient object');

  // Verify variables are NOT duplicated at the top level
  assert.strictEqual(capturedBody.mobiles, undefined, 'mobiles must NOT exist at top level');
  assert.strictEqual(capturedBody.farmer_name, undefined, 'farmer_name must NOT exist at top level');

  console.log('✓ 1.1 MSG91 Flow API v5 recipients array specification verified with exact structure');
  console.log('✓ 1.2 Phone normalized to 91XXXXXXXXXX');
  console.log('✓ 1.3 Variables correctly embedded inside recipients[0]');

  console.log('\n--- TEST 2: Provider Error Response Handling ---');
  globalThis.fetch = (async () => {
    return {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        type: 'error',
        message: 'Invalid template ID or sender',
      }),
    } as unknown as Response;
  }) as typeof fetch;

  const errorResult = await provider.send({
    recipientPhone: '9876543210',
    messageType: 'INVOICE',
    messageBody: 'Test error message body',
    shopId: 'shop-test-1',
    idempotencyKey: 'idemp-error-test',
  });

  assert.strictEqual(errorResult.success, false, 'Failed result captured');
  assert.strictEqual(errorResult.status, 'failed', 'Status is failed');
  assert.strictEqual(errorResult.errorCode, 'MSG91_400', 'Error code format matches MSG91_400');
  assert.strictEqual(errorResult.errorMessage, 'Invalid template ID or sender', 'Error message extracted');
  console.log('✓ 2.1 Provider error response handled gracefully without throwing unhandled exceptions');

} finally {
  globalThis.fetch = originalFetch;
}

console.log('\n================================================================');
console.log('🎉 ALL MSG91 PAYLOAD SPECIFICATION TESTS PASSED SUCCESSFULLY!');
console.log('================================================================');
