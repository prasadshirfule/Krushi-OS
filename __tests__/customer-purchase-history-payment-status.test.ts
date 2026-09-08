// Test Suite for Customer Purchase History Payment Status Resolution

import { normalizeSale } from '../services/sales.service';

function runCustomerPaymentStatusTests() {
  console.log('=====================================================');
  console.log('STARTING CUSTOMER PURCHASE HISTORY PAYMENT STATUS TESTS');
  console.log('=====================================================');

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

  // 1. Helper function mimicking the updated CustomerPurchaseHistory badge logic
  const resolveHistoryBadges = (sale: any) => {
    const rawPaymentMethod = (sale.payment_method || sale.payment_mode || sale.payments?.[0]?.payment_method || sale.payments?.[0]?.method || (sale.payment_status?.toLowerCase() === 'credit' ? 'CREDIT' : 'CASH')).toString().toUpperCase();
    const rawPaymentStatus = (sale.payment_status || '').toString().toLowerCase().trim();
    const rawStatus = (sale.status || '').toString().toLowerCase().trim();

    const isCancelled = rawStatus === 'cancelled' || rawPaymentStatus === 'cancelled';
    const isFullyReturned = rawStatus === 'returned' || rawStatus === 'fully returned';
    const isPartiallyReturned = rawStatus === 'partially_returned';
    const isCredit = rawPaymentStatus === 'credit' || rawPaymentStatus === 'unpaid' || rawPaymentMethod === 'CREDIT';
    const isPartial = rawPaymentStatus === 'partial' || rawPaymentMethod === 'PARTIAL';
    const isPaid = !isCancelled && !isCredit && !isPartial;

    let displayPaymentMethod = 'Cash';
    if (rawPaymentMethod === 'CREDIT') displayPaymentMethod = 'Credit';
    else if (rawPaymentMethod === 'UPI') displayPaymentMethod = 'UPI';
    else if (rawPaymentMethod === 'BANK_TRANSFER') displayPaymentMethod = 'Bank Transfer';
    else if (rawPaymentMethod === 'CARD') displayPaymentMethod = 'Card';
    else if (rawPaymentMethod === 'PARTIAL') displayPaymentMethod = 'Partial';
    else if (rawPaymentMethod === 'CASH') displayPaymentMethod = 'Cash';
    else if (sale.payment_method || sale.payment_mode) displayPaymentMethod = sale.payment_method || sale.payment_mode;

    let displayStatus = 'PAID';
    if (isCancelled) displayStatus = 'CANCELLED';
    else if (isFullyReturned) displayStatus = 'FULLY RETURNED';
    else if (isPartiallyReturned) displayStatus = 'PARTIALLY RETURNED';
    else if (isPaid) displayStatus = 'PAID';
    else if (isPartial) displayStatus = 'PARTIAL';
    else displayStatus = 'CREDIT';

    return {
      paymentMethod: displayPaymentMethod,
      status: displayStatus,
    };
  };

  // Test Case 1: Real DB Bill with lowercase 'paid' (like KOS-000025)
  const cashPaidSale = {
    id: 'sale-1',
    invoice_number: 'KOS-000025',
    total_amount: 3450,
    payment_status: 'paid', // Real PostgreSQL output is lowercase
    status: 'completed',
    payment_method: 'CASH',
  };

  const cashRes = resolveHistoryBadges(cashPaidSale);
  assert(cashRes.paymentMethod === 'Cash', 'KOS-000025: Payment Method is Cash');
  assert(cashRes.status === 'PAID', 'KOS-000025: Payment Status is PAID (not Unpaid!)');

  // Test Case 2: UPI Paid Sale
  const upiPaidSale = {
    id: 'sale-2',
    invoice_number: 'KOS-000026',
    total_amount: 1200,
    payment_status: 'paid',
    status: 'completed',
    payment_method: 'UPI',
  };
  const upiRes = resolveHistoryBadges(upiPaidSale);
  assert(upiRes.paymentMethod === 'UPI', 'UPI Bill: Payment Method is UPI');
  assert(upiRes.status === 'PAID', 'UPI Bill: Payment Status is PAID');

  // Test Case 3: Partial Payment Sale
  const partialSale = {
    id: 'sale-3',
    invoice_number: 'KOS-000027',
    total_amount: 2000,
    payment_status: 'partial',
    status: 'completed',
    payment_method: 'PARTIAL',
  };
  const partialRes = resolveHistoryBadges(partialSale);
  assert(partialRes.paymentMethod === 'Partial', 'Partial Bill: Payment Method is Partial');
  assert(partialRes.status === 'PARTIAL', 'Partial Bill: Payment Status is PARTIAL');

  // Test Case 4: Credit Sale (Udhar)
  const creditSale = {
    id: 'sale-4',
    invoice_number: 'KOS-000028',
    total_amount: 5000,
    payment_status: 'credit',
    status: 'completed',
    payment_method: 'CREDIT',
  };
  const creditRes = resolveHistoryBadges(creditSale);
  assert(creditRes.paymentMethod === 'Credit', 'Credit Bill: Payment Method is Credit');
  assert(creditRes.status === 'CREDIT', 'Credit Bill: Payment Status is CREDIT');

  // Test Case 5: Cancelled Bill
  const cancelledSale = {
    id: 'sale-5',
    invoice_number: 'KOS-000029',
    total_amount: 1500,
    payment_status: 'cancelled',
    status: 'cancelled',
    payment_method: 'CASH',
  };
  const cancelledRes = resolveHistoryBadges(cancelledSale);
  assert(cancelledRes.status === 'CANCELLED', 'Cancelled Bill: Status is CANCELLED');

  // Test Case 6: Partially Returned Bill
  const partiallyReturnedSale = {
    id: 'sale-6',
    invoice_number: 'KOS-000030',
    total_amount: 1000,
    payment_status: 'paid',
    status: 'partially_returned',
    payment_method: 'CASH',
  };
  const partRetRes = resolveHistoryBadges(partiallyReturnedSale);
  assert(partRetRes.status === 'PARTIALLY RETURNED', 'Partially Returned Bill: Status is PARTIALLY RETURNED');

  // Test Case 7: Fully Returned Bill
  const fullyReturnedSale = {
    id: 'sale-7',
    invoice_number: 'KOS-000031',
    total_amount: 800,
    payment_status: 'paid',
    status: 'returned',
    payment_method: 'CASH',
  };
  const fullRetRes = resolveHistoryBadges(fullyReturnedSale);
  assert(fullRetRes.status === 'FULLY RETURNED', 'Fully Returned Bill: Status is FULLY RETURNED');

  // Test Case 8: normalizeSale service test
  const normalized = normalizeSale({
    id: 'sale-10',
    invoice_number: 'KOS-000025',
    payment_status: 'paid',
    status: 'completed',
    items: [],
  });
  assert(normalized.payment_status === 'PAID', 'normalizeSale converts lowercase "paid" to "PAID"');
  assert(normalized.payment_method === 'CASH', 'normalizeSale assigns default "CASH" when payment_status is paid');

  console.log('=====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runCustomerPaymentStatusTests();
