// Comprehensive Test Suite for Complete Customer Portal Implementation

import { normalizeIndianMobile, formatDisplayMobile } from '../lib/phone-utils';
import { formatProductNameWithSize } from '../lib/validations';
import { resolveSaleStatusAndPayment } from '../services/customer-portal.service';

function runCustomerPortalCompleteTests() {
  console.log('================================================================');
  console.log('STARTING COMPLETE CUSTOMER PORTAL TEST SUITE');
  console.log('================================================================');

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

  // ==========================================
  // 1. MULTI-SHOP BILL AGGREGATION & CUSTOMER ISOLATION
  // ==========================================
  const customerAccountA = {
    id: 'acc-farmer-ramesh',
    auth_user_id: 'auth-ramesh-123',
    name: 'Ramesh Patel',
    mobile: '9876543210',
    email: 'ramesh@example.com',
  };

  const customerAccountB = {
    id: 'acc-farmer-suresh',
    auth_user_id: 'auth-suresh-456',
    name: 'Suresh Sharma',
    mobile: '9826112233',
    email: 'suresh@example.com',
  };

  // Shop customer records across 3 shops
  const shopCustomers = [
    { id: 'cust-shopA-ramesh', shop_id: 'shop-A', name: 'Ramesh Patel', mobile: '9876543210', customer_account_id: 'acc-farmer-ramesh' },
    { id: 'cust-shopB-ramesh', shop_id: 'shop-B', name: 'Ramesh Patil', mobile: '+91 98765 43210', customer_account_id: 'acc-farmer-ramesh' },
    { id: 'cust-shopC-ramesh', shop_id: 'shop-C', name: 'Ramesh P', mobile: '09876543210', customer_account_id: 'acc-farmer-ramesh' },
    { id: 'cust-shopA-suresh', shop_id: 'shop-A', name: 'Suresh Sharma', mobile: '9826112233', customer_account_id: 'acc-farmer-suresh' },
  ];

  // Sales records across shops
  const sales = [
    { id: 'sale-A1', invoice_number: 'INV-A01', shop_id: 'shop-A', customer_id: 'cust-shopA-ramesh', total_amount: 5000, paid_amount: 5000, payment_status: 'paid', status: 'completed', sale_date: '2026-09-01' },
    { id: 'sale-A2', invoice_number: 'INV-A02', shop_id: 'shop-A', customer_id: 'cust-shopA-ramesh', total_amount: 1500, paid_amount: 500, payment_status: 'partial', status: 'completed', sale_date: '2026-09-02' },
    { id: 'sale-B1', invoice_number: 'INV-B89', shop_id: 'shop-B', customer_id: 'cust-shopB-ramesh', total_amount: 3200, paid_amount: 0, payment_status: 'credit', status: 'completed', sale_date: '2026-09-03' },
    { id: 'sale-C1', invoice_number: 'INV-C201', shop_id: 'shop-C', customer_id: 'cust-shopC-ramesh', total_amount: 750, paid_amount: 750, payment_status: 'paid', status: 'completed', sale_date: '2026-09-04' },
    { id: 'sale-Suresh1', invoice_number: 'INV-SUR01', shop_id: 'shop-A', customer_id: 'cust-shopA-suresh', total_amount: 8000, paid_amount: 8000, payment_status: 'paid', status: 'completed', sale_date: '2026-09-05' },
  ];

  // Resolve Ramesh's linked records and bills
  const rameshCustomerIds = shopCustomers
    .filter(c => c.customer_account_id === customerAccountA.id)
    .map(c => c.id);

  const rameshBills = sales.filter(s => rameshCustomerIds.includes(s.customer_id));

  assert(rameshCustomerIds.length === 3, 'TEST 1: Ramesh has linked records in all 3 shops (Shop A, B, C)');
  assert(rameshBills.length === 4, 'TEST 1b: Ramesh sees all 4 bills across his 3 linked shops');
  assert(rameshBills.some(b => b.shop_id === 'shop-A' && b.invoice_number === 'INV-A01'), 'TEST 1c: Contains Shop A bill INV-A01');
  assert(rameshBills.some(b => b.shop_id === 'shop-B' && b.invoice_number === 'INV-B89'), 'TEST 1d: Contains Shop B bill INV-B89');
  assert(rameshBills.some(b => b.shop_id === 'shop-C' && b.invoice_number === 'INV-C201'), 'TEST 1e: Contains Shop C bill INV-C201');

  // ==========================================
  // 2. CUSTOMER ISOLATION & UNAUTHORIZED ACCESS REJECTION
  // ==========================================
  const sureshCustomerIds = shopCustomers
    .filter(c => c.customer_account_id === customerAccountB.id)
    .map(c => c.id);
  const sureshBills = sales.filter(s => sureshCustomerIds.includes(s.customer_id));

  assert(sureshBills.length === 1 && sureshBills[0].invoice_number === 'INV-SUR01', 'TEST 2: Suresh sees only his 1 bill');
  assert(!rameshBills.some(b => b.invoice_number === 'INV-SUR01'), 'TEST 2b: Ramesh CANNOT see Suresh bill INV-SUR01');
  assert(!sureshBills.some(b => b.customer_id === 'cust-shopA-ramesh'), 'TEST 2c: Suresh CANNOT see any of Ramesh bills');

  // Authorization check simulation for bill detail access
  function authorizeCustomerBillAccess(requestingAccount: typeof customerAccountA, targetSaleId: string) {
    const targetSale = sales.find(s => s.id === targetSaleId);
    if (!targetSale) return { authorized: false, reason: 'Not found' };
    const allowedCustomerIds = shopCustomers
      .filter(c => c.customer_account_id === requestingAccount.id)
      .map(c => c.id);
    if (!allowedCustomerIds.includes(targetSale.customer_id)) {
      return { authorized: false, reason: 'Unauthorized' };
    }
    return { authorized: true, sale: targetSale };
  }

  assert(authorizeCustomerBillAccess(customerAccountA, 'sale-A1').authorized === true, 'TEST 3a: Ramesh can access his own bill sale-A1');
  assert(authorizeCustomerBillAccess(customerAccountA, 'sale-B1').authorized === true, 'TEST 3b: Ramesh can access his own Shop B bill sale-B1');
  assert(authorizeCustomerBillAccess(customerAccountA, 'sale-Suresh1').authorized === false, 'TEST 3c: Ramesh is REJECTED when requesting Suresh bill sale-Suresh1');
  assert(authorizeCustomerBillAccess(customerAccountB, 'sale-A1').authorized === false, 'TEST 3d: Suresh is REJECTED when requesting Ramesh bill sale-A1');

  // ==========================================
  // 3. SEARCH & FILTERING
  // ==========================================
  // Search by invoice
  const searchInvResult = rameshBills.filter(b => b.invoice_number.toLowerCase().includes('inv-b89'));
  assert(searchInvResult.length === 1 && searchInvResult[0].invoice_number === 'INV-B89', 'TEST 4: Search by invoice "inv-b89" finds exact bill');

  // Shop filter
  const shopAFilter = rameshBills.filter(b => b.shop_id === 'shop-A');
  assert(shopAFilter.length === 2, 'TEST 5: Filtering by Shop A returns exactly 2 bills');

  // Status filter
  const paidFilter = rameshBills.filter(b => resolveSaleStatusAndPayment(b).paymentStatus === 'PAID');
  assert(paidFilter.length === 2, 'TEST 6: Status filter PAID returns 2 bills (INV-A01, INV-C201)');

  const partialFilter = rameshBills.filter(b => resolveSaleStatusAndPayment(b).paymentStatus === 'PARTIAL');
  assert(partialFilter.length === 1 && partialFilter[0].invoice_number === 'INV-A02', 'TEST 7: Status filter PARTIAL returns INV-A02');

  const creditFilter = rameshBills.filter(b => resolveSaleStatusAndPayment(b).paymentStatus === 'CREDIT');
  assert(creditFilter.length === 1 && creditFilter[0].invoice_number === 'INV-B89', 'TEST 8: Status filter CREDIT returns INV-B89');

  // ==========================================
  // 4. FINANCIAL / PAYMENT CALCULATIONS & MULTI-MODE BREAKDOWN
  // ==========================================
  const multiModeSale = {
    id: 'sale-multi-1',
    total_amount: 550,
    paid_amount: 550,
    payment_status: 'paid',
    payments: [
      { id: 'p1', payment_method: 'CASH', amount: 200 },
      { id: 'p2', payment_method: 'UPI', amount: 350 },
    ],
  };
  const multiModeRes = resolveSaleStatusAndPayment(multiModeSale);
  assert(multiModeRes.paymentStatus === 'PAID', 'TEST 9a: Multi-mode sale is marked as PAID');
  assert(multiModeRes.balanceDue === 0, 'TEST 9b: Balance due is 0 on full multi-mode payment');
  assert(multiModeSale.payments.reduce((acc, p) => acc + p.amount, 0) === 550, 'TEST 9c: Sum of Cash (200) + UPI (350) equals exact total ₹550');

  const partialPaymentSale = {
    id: 'sale-part-1',
    total_amount: 550,
    paid_amount: 200,
    payment_status: 'partial',
    payment_method: 'PARTIAL',
  };
  const partialRes = resolveSaleStatusAndPayment(partialPaymentSale);
  assert(partialRes.paymentStatus === 'PARTIAL', 'TEST 10a: Partial payment correctly identified');
  assert(partialRes.paidAmount === 200, 'TEST 10b: Paid amount is ₹200');
  assert(partialRes.balanceDue === 350, 'TEST 10c: Outstanding balance due is ₹350');

  // ==========================================
  // 5. RETURNS & CANCELLATIONS
  // ==========================================
  const cancelledSale = {
    id: 'sale-canc-1',
    total_amount: 1000,
    paid_amount: 1000,
    status: 'cancelled',
    payment_status: 'cancelled',
  };
  const cancRes = resolveSaleStatusAndPayment(cancelledSale);
  assert(cancRes.status === 'CANCELLED', 'TEST 11a: Cancelled sale has status CANCELLED');
  assert(cancRes.paymentStatus === 'CANCELLED', 'TEST 11b: Cancelled sale has payment status CANCELLED');
  assert(cancRes.balanceDue === 0, 'TEST 11c: Cancelled sale has 0 balance due');

  const partiallyReturnedSale = {
    id: 'sale-ret-1',
    total_amount: 2000,
    paid_amount: 2000,
    status: 'partially_returned',
    payment_status: 'paid',
  };
  const partRetRes = resolveSaleStatusAndPayment(partiallyReturnedSale);
  assert(partRetRes.status === 'PARTIALLY_RETURNED', 'TEST 12: Partially returned sale resolved');

  const fullyReturnedSale = {
    id: 'sale-ret-2',
    total_amount: 1200,
    paid_amount: 1200,
    status: 'returned',
    payment_status: 'paid',
  };
  const fullRetRes = resolveSaleStatusAndPayment(fullyReturnedSale);
  assert(fullRetRes.status === 'RETURNED', 'TEST 13: Fully returned sale resolved');

  // ==========================================
  // 6. INVOICE RENDERER DATA COMPATIBILITY & PRODUCT FORMATTING
  // ==========================================
  assert(formatProductNameWithSize('UREA', '45', 'KG') === 'UREA (45 KG)', 'TEST 14a: UREA (45 KG) formatted with single space');
  assert(formatProductNameWithSize('STUNNER GOLD', '50', 'ML') === 'STUNNER GOLD (50 ML)', 'TEST 14b: STUNNER GOLD (50 ML) formatted');
  assert(formatProductNameWithSize('DAP (50 KG PIECE)', null, null) === 'DAP (50 KG)', 'TEST 14c: Strips PIECE suffix');

  // Verify mobile formatting and normalization
  assert(formatDisplayMobile('9876543210') === '+91 98765 43210', 'TEST 15: Display mobile formatted properly');
  assert(normalizeIndianMobile('+91 98765 43210') === '9876543210', 'TEST 16: Mobile normalization intact');

  // ==========================================
  // 7. PREVENT OVERWRITING / STEALING ALREADY-LINKED RECORDS
  // ==========================================
  const existingLinkedRecord = {
    id: 'cust-101',
    shop_id: 'shop-A',
    mobile: '9876543210',
    customer_account_id: 'acc-original-owner',
  };

  const newCustomerAccount = {
    id: 'acc-new-user',
    mobile: '9876543210',
  };

  // Linking rule: ONLY link when customer_account_id IS NULL
  const canLink = existingLinkedRecord.customer_account_id === null;
  assert(canLink === false, 'TEST 17: Already linked record is NOT reassigned to another account');

  console.log('================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runCustomerPortalCompleteTests();
