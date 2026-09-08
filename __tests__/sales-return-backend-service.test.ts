// Step 2 Backend Services & Server Actions Test Suite

import { normalizeSale } from '../services/sales.service';
import { saleReturnSchema, saleCancelSchema, saleReturnItemInputSchema } from '../lib/validations';

function runBackendServiceTests() {
  console.log('=========================================');
  console.log('STARTING STEP 2 BACKEND SERVICES TEST SUITE');
  console.log('=========================================');

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

  // 1. Validation Schema Tests
  // Valid return schema
  const validReturnPayload = {
    saleId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    items: [
      {
        saleItemId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        quantity: 2,
        reason: 'Damaged seal',
      },
    ],
    refundMode: 'CREDIT_ADJUSTMENT',
    reason: 'Customer requested return',
  };

  const returnParseResult = saleReturnSchema.safeParse(validReturnPayload);
  assert(returnParseResult.success, 'Schema: Valid return payload passes validation');

  // Invalid quantity (0 or negative)
  const invalidQtyPayload = {
    ...validReturnPayload,
    items: [{ saleItemId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', quantity: 0 }],
  };
  const invalidQtyResult = saleReturnSchema.safeParse(invalidQtyPayload);
  assert(!invalidQtyResult.success, 'Schema: Return quantity of 0 is rejected');

  // Invalid refund mode
  const invalidModePayload = {
    ...validReturnPayload,
    refundMode: 'BITCOIN_REFUND',
  };
  const invalidModeResult = saleReturnSchema.safeParse(invalidModePayload);
  assert(!invalidModeResult.success, 'Schema: Invalid refund mode is rejected');

  // Valid cancel schema
  const validCancelPayload = {
    saleId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    reason: 'Incorrect billing entry',
  };
  const cancelParseResult = saleCancelSchema.safeParse(validCancelPayload);
  assert(cancelParseResult.success, 'Schema: Valid cancel payload passes validation');

  // Empty cancel reason
  const emptyCancelReason = {
    saleId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    reason: '',
  };
  const emptyCancelResult = saleCancelSchema.safeParse(emptyCancelReason);
  assert(!emptyCancelResult.success, 'Schema: Empty cancel reason is rejected');

  // 2. Normalization & available_to_return calculations
  const rawSaleWithReturns = {
    id: 'sale-123',
    invoice_number: 'KOS-2026-001',
    status: 'partially_returned',
    total_amount: 1500,
    items: [
      {
        id: 'item-1',
        product_name: 'DAP 50KG',
        quantity: 10,
        returned_quantity: 3,
        unit_price: 150,
      },
      {
        id: 'item-2',
        product_name: 'UREA 45KG',
        quantity: 5,
        returned_quantity: 0,
        unit_price: 250,
      },
    ],
    returns: [
      {
        id: 'ret-1',
        return_number: 'RET-2026-001-01',
        total_amount: 450,
        refund_mode: 'CREDIT_ADJUSTMENT',
      },
    ],
  };

  const normalized = normalizeSale(rawSaleWithReturns);

  assert(normalized.status === 'PARTIALLY RETURNED', 'Normalize: status is PARTIALLY RETURNED');
  assert(normalized.items[0].available_to_return === 7, 'Normalize: item 1 available_to_return is 7 (10 - 3)');
  assert(normalized.items[0].returned_quantity === 3, 'Normalize: item 1 returned_quantity is 3');
  assert(normalized.items[1].available_to_return === 5, 'Normalize: item 2 available_to_return is 5 (5 - 0)');
  assert(Array.isArray(normalized.returns) && normalized.returns.length === 1, 'Normalize: returns array attached');
  assert(normalized.returns[0].return_number === 'RET-2026-001-01', 'Normalize: return document number preserved');

  // 3. Fully Returned Sale Normalization
  const rawFullyReturnedSale = {
    id: 'sale-456',
    invoice_number: 'KOS-2026-002',
    status: 'returned',
    total_amount: 500,
    items: [
      {
        id: 'item-1',
        product_name: 'BIO FERTILIZER',
        quantity: 2,
        returned_quantity: 2,
        unit_price: 250,
      },
    ],
    returns: [
      {
        id: 'ret-2',
        return_number: 'RET-2026-002-01',
        total_amount: 500,
        refund_mode: 'CASH',
      },
    ],
  };

  const normalizedFull = normalizeSale(rawFullyReturnedSale);
  assert(normalizedFull.status === 'RETURNED', 'Normalize: fully returned sale status is RETURNED');
  assert(normalizedFull.items[0].available_to_return === 0, 'Normalize: fully returned item available_to_return is 0');

  // 4. Cancelled Sale Normalization
  const rawCancelledSale = {
    id: 'sale-789',
    invoice_number: 'KOS-2026-003',
    status: 'cancelled',
    total_amount: 800,
    items: [
      {
        id: 'item-1',
        product_name: 'PESTICIDE 1L',
        quantity: 1,
        returned_quantity: 0,
        unit_price: 800,
      },
    ],
  };

  const normalizedCancel = normalizeSale(rawCancelledSale);
  assert(normalizedCancel.status === 'CANCELLED', 'Normalize: cancelled sale status is CANCELLED');

  console.log('=========================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=========================================');

  if (failed > 0) process.exit(1);
}

runBackendServiceTests();
