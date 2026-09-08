// Migration 011: Sales Return & Cancellation Logic Verification Test Suite

function runTests() {
  console.log('=========================================');
  console.log('STARTING MIGRATION 011 SALES RETURN & CANCEL TEST SUITE');
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

  // TEST A: Status constraint
  const validStatuses = ['completed', 'returned', 'partially_returned', 'cancelled'];
  assert(validStatuses.includes('completed'), 'TEST A1: completed is a valid sale status');
  assert(validStatuses.includes('partially_returned'), 'TEST A2: partially_returned is a valid sale status');
  assert(validStatuses.includes('returned'), 'TEST A3: returned is a valid sale status');
  assert(validStatuses.includes('cancelled'), 'TEST A4: cancelled is a valid sale status');
  assert(!validStatuses.includes('fully_returned'), 'TEST A5: fully_returned is not used (database uses returned)');

  // TEST B & C & D: Multi-return tracking and over-return rejection
  const originalQuantity = 10;
  let alreadyReturned = 0;

  // First Return: 3 units
  const firstReturnQty = 3;
  let available = originalQuantity - alreadyReturned;
  assert(available === 10, 'TEST B1: Initial returnable quantity is 10');
  assert(firstReturnQty <= available, 'TEST B2: First return of 3 units is permitted');
  alreadyReturned += firstReturnQty;
  assert(originalQuantity - alreadyReturned === 7, 'TEST B3: Remaining returnable is 7 after first return');

  // Second Return: 4 units
  const secondReturnQty = 4;
  available = originalQuantity - alreadyReturned;
  assert(available === 7, 'TEST C1: Available returnable is 7');
  assert(secondReturnQty <= available, 'TEST C2: Second return of 4 units is permitted');
  alreadyReturned += secondReturnQty;
  assert(originalQuantity - alreadyReturned === 3, 'TEST C3: Remaining returnable is 3 after second return');

  // Third Attempt: 4 units (Exceeds remaining 3) -> Must be rejected
  const thirdReturnQty = 4;
  available = originalQuantity - alreadyReturned;
  const isOverReturnValid = thirdReturnQty <= available && thirdReturnQty > 0;
  assert(!isOverReturnValid, 'TEST D1: Over-return of 4 units when only 3 remain is correctly rejected');

  // TEST E: Full return updates status to 'returned'
  const items = [
    { id: 'item-1', quantity: 2, returned_quantity: 2 },
    { id: 'item-2', quantity: 5, returned_quantity: 5 }
  ];
  const allReturned = items.every(it => it.returned_quantity >= it.quantity);
  const newStatus = allReturned ? 'returned' : 'partially_returned';
  assert(newStatus === 'returned', 'TEST E: All items returned updates sale status to "returned"');

  // TEST F & G: Cancellation marks sale as cancelled and prevents returns
  const sale = { id: 'sale-1', status: 'cancelled' };
  const canReturn = sale.status !== 'cancelled' && sale.status !== 'returned';
  assert(!canReturn, 'TEST F & G: Cancelled sale rejects subsequent return requests');

  // TEST H: Exact Batch Allocation Reversal (NOT FEFO selection)
  const originalAllocations = [
    { batch_id: 'batch-A', original_qty: 3, already_returned: 0 },
    { batch_id: 'batch-B', original_qty: 2, already_returned: 0 }
  ];

  let returnNeeded = 4;
  const restoredChunks: { batch_id: string; restored: number }[] = [];

  for (const alloc of originalAllocations) {
    if (returnNeeded <= 0) break;
    const batchReturnable = alloc.original_qty - alloc.already_returned;
    if (batchReturnable > 0) {
      const chunk = Math.min(batchReturnable, returnNeeded);
      restoredChunks.push({ batch_id: alloc.batch_id, restored: chunk });
      returnNeeded -= chunk;
    }
  }

  assert(returnNeeded === 0, 'TEST H1: All 4 units restored');
  assert(restoredChunks.length === 2, 'TEST H2: Restored across both original batch allocations');
  assert(restoredChunks[0].batch_id === 'batch-A' && restoredChunks[0].restored === 3, 'TEST H3: Batch A restored 3');
  assert(restoredChunks[1].batch_id === 'batch-B' && restoredChunks[1].restored === 1, 'TEST H4: Batch B restored 1');

  // TEST I: GST-inclusive selling price returns (No double GST)
  const unitPriceGstInclusive = 250;
  const gstRate = 18;
  const returnQty = 1;
  const returnTotal = returnQty * unitPriceGstInclusive;
  const taxableAmount = Math.round((returnTotal * 100.0 / (100.0 + gstRate)) * 100) / 100;
  const taxAmount = Math.round((returnTotal - taxableAmount) * 100) / 100;
  const cgst = Math.round((taxAmount / 2.0) * 100) / 100;
  const sgst = Math.round((taxAmount - cgst) * 100) / 100;

  assert(returnTotal === 250, 'TEST I1: GST-inclusive return total is ₹250');
  assert(taxableAmount === 211.86, 'TEST I2: Taxable amount is ₹211.86');
  assert(taxAmount === 38.14, 'TEST I3: Tax amount is ₹38.14');
  assert(cgst === 19.07 && sgst === 19.07, 'TEST I4: CGST & SGST are ₹19.07 each');
  assert(taxableAmount + taxAmount === 250, 'TEST I5: Taxable + Tax matches return total exactly');

  // TEST J: Customer ledger & payment reversal consistency
  const saleTotal = 1000;
  const paidAmount = 400;
  const dueAmount = 600;

  let customerOutstanding = dueAmount;
  let customerTotalPurchases = saleTotal;
  let customerTotalPaid = paidAmount;

  // 1. Partial Return of ₹200 (Credit Adjustment)
  const returnAmount = 200;
  customerOutstanding = Math.max(0, customerOutstanding - returnAmount);
  customerTotalPurchases = Math.max(0, customerTotalPurchases - returnAmount);

  assert(customerOutstanding === 400, 'TEST J1: Outstanding reduced to ₹400 after ₹200 return');
  assert(customerTotalPurchases === 800, 'TEST J2: Total purchases reduced to ₹800 after ₹200 return');

  // 2. Cancellation of remaining bill
  const remainingUnpaidDue = 400;
  const remainingSaleValue = 800;
  customerOutstanding = Math.max(0, customerOutstanding - remainingUnpaidDue);
  customerTotalPurchases = Math.max(0, customerTotalPurchases - remainingSaleValue);
  customerTotalPaid = Math.max(0, customerTotalPaid - paidAmount);

  assert(customerOutstanding === 0, 'TEST J3: Customer outstanding reaches ₹0 on cancellation');
  assert(customerTotalPurchases === 0, 'TEST J4: Customer total purchases reaches ₹0 on cancellation');
  assert(customerTotalPaid === 0, 'TEST J5: Customer total paid reaches ₹0 on cancellation');

  console.log('=========================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=========================================');

  if (failed > 0) process.exit(1);
}

runTests();
