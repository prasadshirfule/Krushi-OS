import assert from 'node:assert';
import { generateCombinedInvoiceStatementPDF, verifyLedgerBalance } from '../../lib/statement-generator';
import { hashDocumentToken } from '../../lib/documents/token-service';

console.log('================================================================');
console.log('🧪 KRUSHI OS — COMBINED INVOICE & CUSTOMER STATEMENT TESTS');
console.log('================================================================\n');

// 1. Financial Ledger Arithmetic Consistency
console.log('--- TEST 1: Customer Ledger Balance Formula Verification ---');
const openingBalance = 1500.00;
const ledgerEntries = [
  { id: '1', date: '2026-10-01', particulars: 'Urea 50kg', debit: 266.50, credit: 0, balance: 1766.50 },
  { id: '2', date: '2026-10-05', particulars: 'Cash Payment', debit: 0, credit: 1000.00, balance: 766.50 },
  { id: '3', date: '2026-10-15', particulars: 'Coragen 60ml', debit: 1450.00, credit: 0, balance: 2216.50 },
  { id: '4', date: '2026-10-20', particulars: 'UPI Payment', debit: 0, credit: 500.00, balance: 1716.50 },
];

const balanceCheck = verifyLedgerBalance(openingBalance, ledgerEntries);
assert.strictEqual(balanceCheck.isValid, true, 'Balance check is valid');
assert.strictEqual(balanceCheck.computedTotalDebit, 1716.50, 'Total debits computed accurately (266.50 + 1450.00)');
assert.strictEqual(balanceCheck.computedTotalCredit, 1500.00, 'Total credits computed accurately (1000.00 + 500.00)');
assert.strictEqual(
  balanceCheck.computedClosingBalance,
  1716.50,
  'Closing balance satisfies: Opening (1500) + Debits (1716.50) - Credits (1500) = 1716.50'
);
console.log('✓ 1.1 Ledger equation verified: Opening Balance + Debits - Credits = Closing Balance');

// 2. Cryptographic Access Token Hashing
console.log('\n--- TEST 2: Cryptographic Document Access Token Security ---');
const rawToken1 = 'abc_123-XYZ_456-test_token';
const rawToken2 = 'abc_123-XYZ_456-test_token_different';
const hash1 = hashDocumentToken(rawToken1);
const hash2 = hashDocumentToken(rawToken2);

assert.strictEqual(typeof hash1, 'string', 'Token hash is string');
assert.strictEqual(hash1.length, 64, 'Token hash is 64 hex characters (SHA-256)');
assert.notStrictEqual(hash1, hash2, 'Different tokens produce unique hashes');
assert.strictEqual(hashDocumentToken(rawToken1), hash1, 'Hashing is deterministic');
console.log('✓ 2.1 SHA-256 cryptographic token hashing verified for secure document access');

// 3. Multi-Page Combined PDF Generation
console.log('\n--- TEST 3: Multi-Page Combined PDF Generation (Invoice + Statement) ---');
const mockSale = {
  id: 'sale-test-99',
  invoice_number: 'KOS-2026-0099',
  created_at: new Date().toISOString(),
  payment_method: 'PARTIAL',
  grand_total: 1450.00,
  subtotal: 1228.81,
  total_tax: 221.19,
  paid_amount: 500.00,
  balance_due: 950.00,
  customer_name: 'Baburao Shinde',
  customer_phone: '9876543210',
  sale_items: [
    {
      id: 'item-1',
      product_name: 'Coragen Insecticide',
      pack_size: '60',
      unit: 'ml',
      quantity: 1,
      unit_price: 1450.00,
      total_price: 1450.00,
      gst_rate: 18,
    },
  ],
};

const mockShop = {
  shop_name: 'Samarth Krushi Seva Kendra',
  shop_address: 'Main Road, Rahuri, Ahmednagar',
  shop_phone: '9822001122',
  gstin: '27AAAAA0000A1Z5',
};

const statementData = {
  customer: {
    id: 'cust-1',
    name: 'Baburao Shinde',
    phone: '9876543210',
    village: 'Rahuri',
    opening_balance: 1500.00,
    current_balance: 2450.00,
  },
  ledgerEntries,
  statementDate: new Date(),
};

const combinedDoc = generateCombinedInvoiceStatementPDF(mockSale, mockShop, statementData);
assert.ok(combinedDoc, 'PDF document generated');
// jsPDF internal getNumberOfPages()
const pageCount = combinedDoc.getNumberOfPages();
assert.strictEqual(pageCount, 2, 'Combined PDF contains exactly 2 pages (Page 1 = Invoice, Page 2 = Account Statement)');
console.log(`✓ 3.1 Combined PDF created successfully with ${pageCount} pages (Canonical Invoice + Customer Ledger Statement)`);

const outputBytes = combinedDoc.output('arraybuffer');
assert.ok(outputBytes.byteLength > 1000, 'PDF binary output generated with valid payload');
console.log(`✓ 3.2 PDF binary generated (${Math.round(outputBytes.byteLength / 1024)} KB)`);

console.log('\n================================================================');
console.log('🎉 ALL COMBINED INVOICE & STATEMENT TESTS PASSED SUCCESSFULLY!');
console.log('================================================================\n');
