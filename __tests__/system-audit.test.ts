// System Audit & Logic Verification Test Suite for KRUSHI OS

import { productSchema } from '../lib/validations';

function calculateSaleTotals(items: Array<{ quantity: number; unit_price: number; discount_percent: number; gst_rate: number }>) {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  for (const item of items) {
    const itemSubtotal = item.quantity * item.unit_price;
    const itemDiscount = (itemSubtotal * item.discount_percent) / 100;
    const itemTaxable = itemSubtotal - itemDiscount;
    const itemTax = (itemTaxable * item.gst_rate) / 100;

    subtotal += itemSubtotal;
    totalDiscount += itemDiscount;
    totalTax += itemTax;
  }

  const grandTotal = subtotal - totalDiscount + totalTax;
  const roundOff = Math.round(grandTotal) - grandTotal;
  const payableAmount = Math.round(grandTotal);

  return { subtotal, totalDiscount, totalTax, grandTotal, roundOff, payableAmount };
}

function calculateProfit(sellingPrice: number, costPrice: number, quantity: number, discountPercent = 0) {
  const grossRevenue = sellingPrice * quantity;
  const discount = (grossRevenue * discountPercent) / 100;
  const cost = costPrice * quantity;
  return grossRevenue - discount - cost;
}

// ----------------------------------------------------
// RUN TESTS
// ----------------------------------------------------
async function runSystemAuditTests() {
  console.log("=========================================");
  console.log("STARTING KRUSHI OS AUTOMATED TEST SUITE");
  console.log("=========================================\n");

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`✗ FAIL: ${testName}`);
      failedCount++;
    }
  }

  // TEST 1: Product Schema Validation - Invalid Missing Name
  const invalidNameRes = productSchema.safeParse({
    name: 'A', // too short (<2 chars)
    category_id: 'cat-123',
    purchase_price: 100,
    selling_price: 150,
    gst_rate: 18,
    unit: 'Bottle',
    min_stock: 5,
  });
  assert(!invalidNameRes.success, 'TEST 1: Product validation fails when name is less than 2 characters');

  // TEST 2: Product Schema Validation - Invalid Negative Price
  const invalidPriceRes = productSchema.safeParse({
    name: 'Chlorpyrifos 20% EC',
    category_id: 'cat-123',
    purchase_price: -50, // invalid negative
    selling_price: 150,
    gst_rate: 18,
    unit: 'Bottle',
    min_stock: 5,
  });
  assert(!invalidPriceRes.success, 'TEST 2: Product validation fails when purchase price is negative');

  // TEST 3: Valid Agricultural Product Validation
  const validProductRes = productSchema.safeParse({
    name: 'Chlorpyrifos 20% EC',
    category_id: 'cat-123',
    purchase_price: 120,
    selling_price: 180,
    gst_rate: 18,
    unit: 'Bottle',
    min_stock: 10,
    opening_stock: 50,
    product_type: 'Pesticide',
    active_ingredient: 'Chlorpyrifos 20% EC',
    licence_number: 'CIB-998811/2026',
  });
  assert(validProductRes.success, 'TEST 3: Valid agricultural product payload passes schema validation');

  // TEST 4: Financial Calculations - GST & Grand Total
  const saleTotals = calculateSaleTotals([
    { quantity: 2, unit_price: 500, discount_percent: 10, gst_rate: 18 } // Subtotal=1000, Disc=100, Taxable=900, GST=162 -> Total=1062
  ]);
  assert(saleTotals.subtotal === 1000, 'TEST 4a: Subtotal is calculated correctly (₹1000)');
  assert(saleTotals.totalDiscount === 100, 'TEST 4b: Total discount is calculated correctly (₹100)');
  assert(saleTotals.totalTax === 162, 'TEST 4c: 18% GST on net taxable amount is calculated correctly (₹162)');
  assert(saleTotals.grandTotal === 1062, 'TEST 4d: Grand total equals subtotal - discount + tax (₹1062)');

  // TEST 5: Profit Calculation
  const profit = calculateProfit(180, 120, 10, 5); // Revenue = 1800, Disc = 90, Net = 1710, Cost = 1200 -> Profit = 510
  assert(profit === 510, 'TEST 5: Profit is calculated correctly based on cost price and discounts (₹510)');

  console.log("\n=========================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=========================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSystemAuditTests();
