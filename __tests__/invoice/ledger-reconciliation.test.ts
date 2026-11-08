import assert from 'node:assert';
import {
  generateCombinedInvoiceStatementPDF,
  verifyLedgerBalance,
  isOpeningBalanceEntry,
  CustomerLedgerEntry,
} from '../../lib/statement-generator';

console.log('================================================================');
console.log('🧪 KRUSHI OS — CUSTOMER LEDGER FINANCIAL RECONCILIATION TESTS');
console.log('================================================================\n');

// Mock shop
const mockShop = {
  shop_name: 'Samarth Krushi Seva Kendra',
  shop_address: 'Main Road, Rahuri, Ahmednagar',
  shop_phone: '9822001122',
  gstin: '27AAAAA0000A1Z5',
};

// --- SCENARIO 1: Customer with Opening Balance (ADJUSTMENT entry in ledger) ---
console.log('--- SCENARIO 1: Opening Balance Double-Counting Prevention ---');
{
  const openingAmount = 5000.00;
  const entries: CustomerLedgerEntry[] = [
    {
      id: 'e1',
      date: '2026-09-01',
      reference_type: 'ADJUSTMENT',
      description: 'Opening Balance (Previous Udhari)',
      debit: 5000.00,
      credit: 0,
      balance: 5000.00,
    },
    {
      id: 'e2',
      date: '2026-09-15',
      reference_type: 'SALE',
      description: 'Invoice #101 (Urea 50kg)',
      debit: 1200.00,
      credit: 0,
      balance: 6200.00,
    },
    {
      id: 'e3',
      date: '2026-09-20',
      reference_type: 'PAYMENT',
      description: 'Cash Payment',
      debit: 0,
      credit: 2000.00,
      balance: 4200.00,
    },
  ];

  // Test with openingBalance passed as 5000 (from customer record)
  const result1 = verifyLedgerBalance(openingAmount, entries);
  assert.strictEqual(result1.computedOpeningBalance, 5000.00, 'Opening balance is exactly 5000');
  assert.strictEqual(result1.computedTotalDebit, 1200.00, 'Total purchases/debits only includes new sale (1200), NOT opening balance');
  assert.strictEqual(result1.computedTotalCredit, 2000.00, 'Total credits is 2000');
  assert.strictEqual(result1.computedClosingBalance, 4200.00, 'Closing balance is 4200 (5000 + 1200 - 2000), NOT 9200');

  // Test with openingBalance passed as 0 (auto-derived from ADJUSTMENT entry)
  const result2 = verifyLedgerBalance(0, entries);
  assert.strictEqual(result2.computedOpeningBalance, 5000.00, 'Derived opening balance is 5000');
  assert.strictEqual(result2.computedTotalDebit, 1200.00, 'Purchases remain 1200');
  assert.strictEqual(result2.computedClosingBalance, 4200.00, 'Closing balance remains 4200');

  console.log('✓ Scenario 1: Zero double-counting verified. Opening balance separated from purchases.');
}

// --- SCENARIO 2: Customer with Zero Opening Balance ---
console.log('\n--- SCENARIO 2: Customer with Zero Opening Balance ---');
{
  const entries: CustomerLedgerEntry[] = [
    {
      id: 'e1',
      date: '2026-10-01',
      reference_type: 'SALE',
      description: 'Invoice #201 (DAP 50kg)',
      debit: 1350.00,
      credit: 0,
      balance: 1350.00,
    },
    {
      id: 'e2',
      date: '2026-10-10',
      reference_type: 'PAYMENT',
      description: 'UPI Payment',
      debit: 0,
      credit: 1350.00,
      balance: 0.00,
    },
  ];

  const result = verifyLedgerBalance(0, entries);
  assert.strictEqual(result.computedOpeningBalance, 0.00, 'Opening balance is 0');
  assert.strictEqual(result.computedTotalDebit, 1350.00, 'Total purchases is 1350');
  assert.strictEqual(result.computedTotalCredit, 1350.00, 'Total payments is 1350');
  assert.strictEqual(result.computedClosingBalance, 0.00, 'Closing balance is 0');
  console.log('✓ Scenario 2: Zero opening balance reconciles cleanly.');
}

// --- SCENARIO 3: Multiple Transactions with Running Balances ---
console.log('\n--- SCENARIO 3: Running Balance Consistency Over Time ---');
{
  const opening = 2500.00;
  const entries: CustomerLedgerEntry[] = [
    { id: '1', date: '2026-10-01', reference_type: 'SALE', debit: 3000.00, credit: 0, balance: 5500.00 },
    { id: '2', date: '2026-10-05', reference_type: 'PAYMENT', debit: 0, credit: 1500.00, balance: 4000.00 },
    { id: '3', date: '2026-10-12', reference_type: 'SALE', debit: 450.00, credit: 0, balance: 4450.00 },
    { id: '4', date: '2026-10-18', reference_type: 'PAYMENT', debit: 0, credit: 2000.00, balance: 2450.00 },
    { id: '5', date: '2026-10-25', reference_type: 'SALE', debit: 800.00, credit: 0, balance: 3250.00 },
  ];

  const result = verifyLedgerBalance(opening, entries);
  assert.strictEqual(result.computedTotalDebit, 4250.00, 'Total debits sum correctly (3000 + 450 + 800)');
  assert.strictEqual(result.computedTotalCredit, 3500.00, 'Total credits sum correctly (1500 + 2000)');
  assert.strictEqual(result.computedClosingBalance, 3250.00, 'Closing balance matches final entry balance');
  assert.strictEqual(
    result.computedClosingBalance,
    entries[entries.length - 1].balance,
    'Closing balance equals last running balance'
  );
  console.log('✓ Scenario 3: Continuous running balance matches ledger sequence.');
}

// --- SCENARIO 4: Walk-in / Cash Sale (No Customer ID) -> Pure Invoice, No Statement ---
console.log('\n--- SCENARIO 4: Cash Sale Document Generation (No Statement Pages) ---');
{
  const cashSale = {
    id: 'sale-cash-001',
    invoice_number: 'INV-CASH-001',
    customer_id: null,
    customer_name: 'Counter Cash Customer',
    payment_method: 'CASH',
    grand_total: 500.00,
    paid_amount: 500.00,
    balance_due: 0.00,
    sale_items: [
      { product_name: 'Zinc Sulphate 1kg', quantity: 2, unit_price: 250.00, total_price: 500.00, gst_rate: 12 },
    ],
  };

  // When no registered customer ID is present in statementData
  const cashStatementData = {
    customer: {
      id: undefined, // Unregistered walk-in
      name: 'Counter Cash Customer',
    },
    ledgerEntries: [],
  };

  const doc = generateCombinedInvoiceStatementPDF(cashSale, mockShop, cashStatementData);
  const totalPages = doc.getNumberOfPages();
  assert.strictEqual(totalPages, 1, 'Cash walk-in bill generates strictly 1 page (Invoice only)');
  console.log(`✓ Scenario 4: Cash sale generated strictly ${totalPages} page (Invoice only, no statement).`);
}

// --- SCENARIO 5: Long-time Customer (>100 Entries) ---
console.log('\n--- SCENARIO 5: Large Volume History (>120 Transactions) ---');
{
  const largeEntries: CustomerLedgerEntry[] = [];
  let currentBal = 1000.00; // Initial opening

  for (let i = 1; i <= 120; i++) {
    const isSale = i % 2 === 1;
    const amount = 100 + (i * 5);
    if (isSale) {
      currentBal += amount;
      largeEntries.push({
        id: `e-${i}`,
        date: `2026-01-01`,
        reference_type: 'SALE',
        description: `Sale #${i}`,
        debit: amount,
        credit: 0,
        balance: Math.round(currentBal * 100) / 100,
      });
    } else {
      currentBal -= amount;
      largeEntries.push({
        id: `e-${i}`,
        date: `2026-01-02`,
        reference_type: 'PAYMENT',
        description: `Payment #${i}`,
        debit: 0,
        credit: amount,
        balance: Math.round(currentBal * 100) / 100,
      });
    }
  }

  const result = verifyLedgerBalance(1000.00, largeEntries);
  assert.strictEqual(
    result.computedClosingBalance,
    Math.round(currentBal * 100) / 100,
    'Closing balance matches the 120th transaction running balance'
  );
  console.log(`✓ Scenario 5: Large volume (${largeEntries.length} entries) reconciled with exact precision.`);
}

// --- SCENARIO 6: Returns / Credit Notes Handling ---
console.log('\n--- SCENARIO 6: Sales Return & Credit Notes Ledger Processing ---');
{
  const entries: CustomerLedgerEntry[] = [
    { id: '1', date: '2026-10-01', reference_type: 'SALE', description: 'Bill #301', debit: 5000.00, credit: 0, balance: 5000.00 },
    { id: '2', date: '2026-10-05', reference_type: 'CREDIT_NOTE', description: 'Return RET-01 (Damaged bottle)', debit: 0, credit: 800.00, balance: 4200.00 },
    { id: '3', date: '2026-10-10', reference_type: 'PAYMENT', description: 'Final Settlement', debit: 0, credit: 4200.00, balance: 0.00 },
  ];

  const result = verifyLedgerBalance(0, entries);
  assert.strictEqual(result.computedTotalDebit, 5000.00, 'Original sale recorded as debit');
  assert.strictEqual(result.computedTotalCredit, 5000.00, 'Credit note (800) + Payment (4200) equals total credits');
  assert.strictEqual(result.computedClosingBalance, 0.00, 'Account fully settled at 0 balance');
  console.log('✓ Scenario 6: Sales return credit note reduces customer balance properly.');
}

// --- SCENARIO 7: Full Invariant Audit Check ---
console.log('\n--- SCENARIO 7: General Invariant Check (Formula Completeness) ---');
{
  // Test arbitrary inputs
  const op = 3456.78;
  const entries: CustomerLedgerEntry[] = [
    { id: '1', date: '2026-01-01', debit: 123.45, credit: 0, balance: 3580.23 },
    { id: '2', date: '2026-01-02', debit: 0, credit: 580.23, balance: 3000.00 },
    { id: '3', date: '2026-01-03', debit: 2000.00, credit: 0, balance: 5000.00 },
  ];

  const res = verifyLedgerBalance(op, entries);
  const mathFormula = Math.round((res.computedOpeningBalance + res.computedTotalDebit - res.computedTotalCredit) * 100) / 100;
  assert.strictEqual(res.computedClosingBalance, mathFormula, 'Invariant: Opening + Debits - Credits === Closing');
  console.log(`✓ Scenario 7: Mathematical invariant proven: ${res.computedOpeningBalance} + ${res.computedTotalDebit} - ${res.computedTotalCredit} = ${res.computedClosingBalance}`);
}

console.log('\n================================================================');
console.log('🎉 ALL 7 LEDGER RECONCILIATION SCENARIOS PASSED WITH 100% ACCURACY!');
console.log('================================================================');
