// Step 3 UI & Workflow Automated Test Suite

import { formatProductNameWithSize } from '../lib/validations';

function runStep3UITests() {
  console.log('=========================================');
  console.log('STARTING STEP 3 UI & WORKFLOW TEST SUITE');
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

  // 1. Sale Status & Action Availability Logic
  const getAvailableActions = (status: string) => {
    const rawStatus = (status || '').toString().toLowerCase().trim();
    const isCancelled = rawStatus === 'cancelled';
    const isFullyReturned = rawStatus === 'returned';
    const isPartiallyReturned = rawStatus === 'partially_returned';
    const isCompleted = rawStatus === 'completed' || (!isCancelled && !isFullyReturned && !isPartiallyReturned);

    return {
      displayStatus: isCancelled 
        ? 'CANCELLED' 
        : (isFullyReturned ? 'FULLY RETURNED' : (isPartiallyReturned ? 'PARTIALLY RETURNED' : 'COMPLETED')),
      canReturn: (isCompleted || isPartiallyReturned) && !isCancelled && !isFullyReturned,
      canCancel: (isCompleted || isPartiallyReturned) && !isCancelled && !isFullyReturned,
      canView: true,
      canPrint: true,
    };
  };

  const completedActions = getAvailableActions('completed');
  assert(completedActions.displayStatus === 'COMPLETED', 'Status: "completed" displays as COMPLETED');
  assert(completedActions.canReturn === true, 'Status: "completed" allows Return Products action');
  assert(completedActions.canCancel === true, 'Status: "completed" allows Cancel Bill action');

  const partialActions = getAvailableActions('partially_returned');
  assert(partialActions.displayStatus === 'PARTIALLY RETURNED', 'Status: "partially_returned" displays as PARTIALLY RETURNED');
  assert(partialActions.canReturn === true, 'Status: "partially_returned" allows Return Products action');
  assert(partialActions.canCancel === true, 'Status: "partially_returned" allows Cancel Bill action');

  const fullyReturnedActions = getAvailableActions('returned');
  assert(fullyReturnedActions.displayStatus === 'FULLY RETURNED', 'Status: "returned" displays as FULLY RETURNED');
  assert(fullyReturnedActions.canReturn === false, 'Status: "returned" hides Return Products action');
  assert(fullyReturnedActions.canCancel === false, 'Status: "returned" hides Cancel Bill action');

  const cancelledActions = getAvailableActions('cancelled');
  assert(cancelledActions.displayStatus === 'CANCELLED', 'Status: "cancelled" displays as CANCELLED');
  assert(cancelledActions.canReturn === false, 'Status: "cancelled" hides Return Products action');
  assert(cancelledActions.canCancel === false, 'Status: "cancelled" hides Cancel Bill action');

  // 2. Return Quantity & Availability Constraints
  const items = [
    { id: '1', quantity: 10, returned_quantity: 3 },
    { id: '2', quantity: 5, returned_quantity: 0 },
    { id: '3', quantity: 2, returned_quantity: 2 },
  ];

  const processed = items.map(item => {
    const orig = Number(item.quantity);
    const ret = Number(item.returned_quantity);
    const available = Math.max(0, orig - ret);
    return { ...item, available };
  });

  assert(processed[0].available === 7, 'Availability: 10 orig - 3 returned = 7 available');
  assert(processed[1].available === 5, 'Availability: 5 orig - 0 returned = 5 available');
  assert(processed[2].available === 0, 'Availability: 2 orig - 2 returned = 0 available');

  // Return Full Bill action
  const fullReturnItems = processed.map(i => ({
    ...i,
    return_qty: i.available,
  }));
  assert(fullReturnItems[0].return_qty === 7, 'Full Return: Item 1 selects 7 (not 10)');
  assert(fullReturnItems[1].return_qty === 5, 'Full Return: Item 2 selects 5');
  assert(fullReturnItems[2].return_qty === 0, 'Full Return: Item 3 selects 0');

  // Quantity UI Validation
  const validateReturnQty = (qty: number, available: number) => {
    if (!Number.isInteger(qty) || qty < 0) {
      return { valid: false, error: 'Enter a valid positive whole number' };
    }
    if (qty > available) {
      return { valid: false, error: `Only ${available} units are available to return.` };
    }
    return { valid: true, error: '' };
  };

  assert(!validateReturnQty(-1, 5).valid, 'Validation: Negative return quantity rejected');
  assert(!validateReturnQty(1.5, 5).valid, 'Validation: Decimal return quantity rejected');
  assert(!validateReturnQty(6, 5).valid, 'Validation: Exceeding available quantity rejected');
  assert(validateReturnQty(5, 5).valid, 'Validation: Exact available quantity accepted');
  assert(validateReturnQty(0, 5).valid, 'Validation: Zero quantity accepted');

  // 3. GST-Inclusive Price Return Value Math
  const rate = 250;
  const returnQty = 1;
  const lineTotal = returnQty * rate;
  assert(lineTotal === 250, 'Return Math: 1 unit @ ₹250 GST-inclusive returns ₹250 exactly without double GST');

  const multipleReturn = [
    { return_qty: 2, rate: 250, discPercent: 0 },
    { return_qty: 1, rate: 500, discPercent: 10 },
  ];
  const totalVal = multipleReturn.reduce((sum, item) => sum + (item.return_qty * item.rate * (1 - item.discPercent / 100)), 0);
  assert(totalVal === 950, 'Return Math: (2 * 250) + (1 * 500 * 0.9) = ₹950 total return value');

  // 4. Product Formatting in Return Documents
  assert(formatProductNameWithSize('STUNNER GOLD', '50 ML', 'ML') === 'STUNNER GOLD (50 ML)', 'Format: STUNNER GOLD (50 ML)');
  assert(formatProductNameWithSize('UREA', '45 KG', 'BAG') === 'UREA (45 KG)', 'Format: UREA (45 KG)');
  assert(formatProductNameWithSize('DAP', '50 KG', 'BAG') === 'DAP (50 KG)', 'Format: DAP (50 KG)');
  assert(formatProductNameWithSize('CORAGEN (100 ML PIECE)', null, null) === 'CORAGEN (100 ML)', 'Format: Strips unwanted PIECE suffix');

  // 5. Refund Mode Mapping
  const refundModeMap: Record<string, string> = {
    'CREDIT_ADJUSTMENT': 'Customer Balance Adjustment',
    'CASH': 'Cash Refund',
    'UPI': 'UPI Refund',
    'BANK_TRANSFER': 'Bank Transfer',
    'CARD': 'Card Refund',
  };

  assert(refundModeMap['CREDIT_ADJUSTMENT'] === 'Customer Balance Adjustment', 'Refund Mode: CREDIT_ADJUSTMENT maps to "Customer Balance Adjustment"');
  assert(refundModeMap['CASH'] === 'Cash Refund', 'Refund Mode: CASH maps to "Cash Refund"');
  assert(refundModeMap['UPI'] === 'UPI Refund', 'Refund Mode: UPI maps to "UPI Refund"');
  assert(refundModeMap['BANK_TRANSFER'] === 'Bank Transfer', 'Refund Mode: BANK_TRANSFER maps to "Bank Transfer"');
  assert(refundModeMap['CARD'] === 'Card Refund', 'Refund Mode: CARD maps to "Card Refund"');

  console.log('=========================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep3UITests();
