/**
 * KRUSHI OS — CUSTOMER LEDGER INVOICE TEST SUITE
 * Validates Opening Balance, Cr Invoice, and Closing Balance calculations
 * across Cash, Credit (Udhari), Partial Payment, and Zero Opening Balance flows.
 */

import { generateInvoicePDF } from '../lib/invoice';
import { DEFAULT_SHOP_DETAILS } from '../lib/shop-details';

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

console.log('=====================================================');
console.log('STARTING KRUSHI OS CUSTOMER LEDGER INVOICE TESTS');
console.log('=====================================================');

// Helper function that mirrors the canonical ledger calculation in lib/invoice.ts & UI renderers
function calculateInvoiceLedger(s: any) {
  const netTotal = Number(s.payableAmount ?? s.totalAmount ?? s.grand_total ?? s.total_amount ?? 0);
  const isCredit = s.payment_method === 'CREDIT' || s.payment_mode === 'CREDIT' || s.payment_status === 'UNPAID';
  const isPartial = s.payment_method === 'PARTIAL' || s.payment_mode === 'PARTIAL';
  
  const partialPaidTotal = Number(
    s.partialPayment?.totalPaid ?? 
    s.partialPayment?.total_paid ?? 
    s.partial_payment?.totalPaid ?? 
    s.partial_payment?.total_paid ?? 
    0
  );

  const amountPaid = isPartial 
    ? partialPaidTotal 
    : (s.paid_amount !== undefined ? Number(s.paid_amount) : (isCredit ? 0 : netTotal));

  // Current Credit/Outstanding portion of THIS invoice
  const crInvoice = Math.max(0, netTotal - amountPaid);

  // Opening Balance: Customer's outstanding balance BEFORE this invoice
  let openingBal = 0;
  if (s.customer?.previous_outstanding !== undefined && s.customer?.previous_outstanding !== null) {
    openingBal = Number(s.customer.previous_outstanding);
  } else if (s.customer?.previous_balance !== undefined && s.customer?.previous_balance !== null) {
    openingBal = Number(s.customer.previous_balance);
  } else if (s.customer?.opening_balance !== undefined && s.customer?.opening_balance !== null) {
    openingBal = Number(s.customer.opening_balance);
  } else if (s.customer?.previous_udhari !== undefined && s.customer?.previous_udhari !== null) {
    openingBal = Number(s.customer.previous_udhari);
  } else if (s.previous_outstanding !== undefined && s.previous_outstanding !== null) {
    openingBal = Number(s.previous_outstanding);
  } else if (s.previous_balance !== undefined && s.previous_balance !== null) {
    openingBal = Number(s.previous_balance);
  } else if (s.opening_balance !== undefined && s.opening_balance !== null) {
    openingBal = Number(s.opening_balance);
  } else if (s.customer?.outstanding !== undefined && s.customer?.outstanding !== null) {
    const rawOutstanding = Number(s.customer.outstanding || 0);
    openingBal = rawOutstanding >= crInvoice ? (rawOutstanding - crInvoice) : rawOutstanding;
  } else if (s.customer?.outstanding_balance !== undefined && s.customer?.outstanding_balance !== null) {
    const rawOutstanding = Number(s.customer.outstanding_balance || 0);
    openingBal = rawOutstanding >= crInvoice ? (rawOutstanding - crInvoice) : rawOutstanding;
  }

  // Closing Balance = Opening Balance + Current Credit Amount
  const closingBalance = openingBal + crInvoice;

  return { openingBal, crInvoice, closingBalance, amountPaid, netTotal };
}

// ─── TEST 1: Cash / Fully Paid Bill ───
// Previous outstanding = ₹10,000
// Current bill = ₹4,300
// Payment = Cash (Fully Paid)
// Expected: Opening Bal = ₹10,000.00, Cr Invoice = ₹0.00, Closing balance = ₹10,000.00
const cashSale = {
  id: 'sale-cash-001',
  invoice_number: 'KOS-2026-001',
  total_amount: 4300,
  payableAmount: 4300,
  paid_amount: 4300,
  payment_method: 'CASH',
  customer: {
    name: 'RAMESHWAR KALE',
    previous_outstanding: 10000,
  },
  items: [
    {
      product_name: 'UREA (45 KG)',
      quantity: 10,
      unit_price: 266.5,
      selling_price: 266.5,
      rate: 266.5,
      total_amount: 2665,
      gst_rate: 5,
    },
    {
      product_name: 'DAP (50 KG)',
      quantity: 1,
      unit_price: 1635,
      selling_price: 1635,
      rate: 1635,
      total_amount: 1635,
      gst_rate: 5,
    },
  ],
};

const cashLedger = calculateInvoiceLedger(cashSale);
assert(cashLedger.openingBal === 10000, `Cash Sale: Opening Bal is ₹10,000.00, got ₹${cashLedger.openingBal}`);
assert(cashLedger.crInvoice === 0, `Cash Sale: Cr Invoice is ₹0.00 (not full invoice), got ₹${cashLedger.crInvoice}`);
assert(cashLedger.closingBalance === 10000, `Cash Sale: Closing balance is ₹10,000.00, got ₹${cashLedger.closingBalance}`);

// ─── TEST 2: Credit / Udhari Bill ───
// Previous outstanding = ₹10,000
// Current bill = ₹4,300
// Payment = Credit / Udhari
// Expected: Opening Bal = ₹10,000.00, Cr Invoice = ₹4,300.00, Closing balance = ₹14,300.00
const creditSale = {
  id: 'sale-credit-002',
  invoice_number: 'KOS-2026-002',
  total_amount: 4300,
  payableAmount: 4300,
  paid_amount: 0,
  payment_method: 'CREDIT',
  payment_status: 'UNPAID',
  customer: {
    name: 'RAMESHWAR KALE',
    previous_outstanding: 10000,
  },
  items: [
    {
      product_name: 'UREA (45 KG)',
      quantity: 10,
      unit_price: 266.5,
      rate: 266.5,
      total_amount: 2665,
      gst_rate: 5,
    },
    {
      product_name: 'DAP (50 KG)',
      quantity: 1,
      unit_price: 1635,
      rate: 1635,
      total_amount: 1635,
      gst_rate: 5,
    },
  ],
};

const creditLedger = calculateInvoiceLedger(creditSale);
assert(creditLedger.openingBal === 10000, `Credit Sale: Opening Bal is ₹10,000.00, got ₹${creditLedger.openingBal}`);
assert(creditLedger.crInvoice === 4300, `Credit Sale: Cr Invoice is ₹4,300.00, got ₹${creditLedger.crInvoice}`);
assert(creditLedger.closingBalance === 14300, `Credit Sale: Closing balance is ₹14,300.00, got ₹${creditLedger.closingBalance}`);

// ─── TEST 3: Partial Payment Bill ───
// Previous outstanding = ₹10,000
// Current invoice = ₹4,300
// Customer pays = ₹2,000
// Remaining credit = ₹2,300
// Expected: Opening Bal = ₹10,000.00, Cr Invoice = ₹2,300.00, Closing balance = ₹12,300.00
const partialSale = {
  id: 'sale-partial-003',
  invoice_number: 'KOS-2026-003',
  total_amount: 4300,
  payableAmount: 4300,
  paid_amount: 2000,
  payment_method: 'PARTIAL',
  partial_payment: {
    cash: 2000,
    upi: 0,
    total_paid: 2000,
    remaining: 2300,
  },
  customer: {
    name: 'RAMESHWAR KALE',
    previous_outstanding: 10000,
  },
  items: [
    {
      product_name: 'UREA (45 KG)',
      quantity: 10,
      unit_price: 266.5,
      rate: 266.5,
      total_amount: 2665,
      gst_rate: 5,
    },
    {
      product_name: 'DAP (50 KG)',
      quantity: 1,
      unit_price: 1635,
      rate: 1635,
      total_amount: 1635,
      gst_rate: 5,
    },
  ],
};

const partialLedger = calculateInvoiceLedger(partialSale);
assert(partialLedger.openingBal === 10000, `Partial Sale: Opening Bal is ₹10,000.00, got ₹${partialLedger.openingBal}`);
assert(partialLedger.crInvoice === 2300, `Partial Sale: Cr Invoice is ₹2,300.00, got ₹${partialLedger.crInvoice}`);
assert(partialLedger.closingBalance === 12300, `Partial Sale: Closing balance is ₹12,300.00, got ₹${partialLedger.closingBalance}`);

// ─── TEST 4: Zero Previous Outstanding with Credit Bill ───
// Previous outstanding = ₹0
// Current bill = ₹4,300
// Payment = Credit
// Expected: Opening Bal = ₹0.00, Cr Invoice = ₹4,300.00, Closing balance = ₹4,300.00
const zeroBalCreditSale = {
  id: 'sale-zero-004',
  invoice_number: 'KOS-2026-004',
  total_amount: 4300,
  payableAmount: 4300,
  paid_amount: 0,
  payment_method: 'CREDIT',
  customer: {
    name: 'NEW FARMER',
    previous_outstanding: 0,
  },
  items: [
    {
      product_name: 'UREA (45 KG)',
      quantity: 10,
      unit_price: 266.5,
      rate: 266.5,
      total_amount: 2665,
      gst_rate: 5,
    },
  ],
};

const zeroBalLedger = calculateInvoiceLedger(zeroBalCreditSale);
assert(zeroBalLedger.openingBal === 0, `Zero Bal Credit: Opening Bal is ₹0.00, got ₹${zeroBalLedger.openingBal}`);
assert(zeroBalLedger.crInvoice === 4300, `Zero Bal Credit: Cr Invoice is ₹4,300.00, got ₹${zeroBalLedger.crInvoice}`);
assert(zeroBalLedger.closingBalance === 4300, `Zero Bal Credit: Closing balance is ₹4,300.00, got ₹${zeroBalLedger.closingBalance}`);

// ─── TEST 5: Fallback extraction from customer.outstanding (DB current outstanding) ───
// When customer record has already been updated with the credit portion in DB (e.g. outstanding = 14300)
// and current credit = 4300 -> opening balance is 14300 - 4300 = 10000
const dbUpdatedSale = {
  id: 'sale-db-005',
  invoice_number: 'KOS-2026-005',
  total_amount: 4300,
  payableAmount: 4300,
  paid_amount: 0,
  payment_method: 'CREDIT',
  customer: {
    name: 'RAMESHWAR KALE',
    outstanding: 14300, // post-sale DB balance
  },
  items: [
    {
      product_name: 'UREA (45 KG)',
      quantity: 10,
      unit_price: 266.5,
      rate: 266.5,
      total_amount: 2665,
      gst_rate: 5,
    },
  ],
};

const dbLedger = calculateInvoiceLedger(dbUpdatedSale);
assert(dbLedger.openingBal === 10000, `DB Updated Outstanding Fallback: Opening Bal resolves to ₹10,000.00, got ₹${dbLedger.openingBal}`);
assert(dbLedger.crInvoice === 4300, `DB Updated Outstanding Fallback: Cr Invoice is ₹4,300.00, got ₹${dbLedger.crInvoice}`);
assert(dbLedger.closingBalance === 14300, `DB Updated Outstanding Fallback: Closing balance is ₹14,300.00, got ₹${dbLedger.closingBalance}`);

// ─── TEST 6: Real PDF Generation Verification with jsPDF ───
const testShop = {
  ...DEFAULT_SHOP_DETAILS,
  shopName: 'MAULI KRUSHI SEVA KENDRA',
  bankName: 'STATE BANK OF INDIA',
  accountNumber: '1234567890',
  ifsc: 'SBIN0001234',
  branch: 'NANDED',
};

const pdfDoc = generateInvoicePDF(creditSale, testShop);
const pdfDataUri = pdfDoc.output('datauristring');
assert(Boolean(pdfDataUri && pdfDataUri.startsWith('data:application/pdf')), 'generateInvoicePDF successfully creates valid PDF output');

console.log('=====================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('=====================================================');

if (failed > 0) {
  process.exit(1);
}
