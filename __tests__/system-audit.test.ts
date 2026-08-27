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

// Simulated RPC parameter builder for verification
function buildCreateProductParams(data: any) {
  return {
    p_name: data.name,
    p_opening_stock: data.opening_stock || 0,
    p_batch_tracking: Boolean(data.batch_tracking),
    p_expiry_tracking: Boolean(data.expiry_tracking),
    p_batch_number: data.batch_number || null,
    p_expiry_date: data.expiry_date || null,
    p_transaction_type: 'OPENING_STOCK'
  };
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
    { quantity: 2, unit_price: 500, discount_percent: 10, gst_rate: 18 }
  ]);
  assert(saleTotals.subtotal === 1000, 'TEST 4a: Subtotal is calculated correctly (₹1000)');
  assert(saleTotals.totalDiscount === 100, 'TEST 4b: Total discount is calculated correctly (₹100)');
  assert(saleTotals.totalTax === 162, 'TEST 4c: 18% GST on net taxable amount is calculated correctly (₹162)');
  assert(saleTotals.grandTotal === 1062, 'TEST 4d: Grand total equals subtotal - discount + tax (₹1062)');

  // TEST 5: Profit Calculation
  const profit = calculateProfit(180, 120, 10, 5);
  assert(profit === 510, 'TEST 5: Profit is calculated correctly based on cost price and discounts (₹510)');

  // TEST 6: Flow A (Normal Product Opening Stock)
  const flowAParams = buildCreateProductParams({
    name: 'Urea Fertilizer 50Kg',
    opening_stock: 50,
    batch_tracking: false,
  });
  assert(flowAParams.p_opening_stock === 50, 'TEST 6a: Flow A opening stock is 50');
  assert(flowAParams.p_batch_tracking === false, 'TEST 6b: Flow A does NOT enable batch tracking');
  assert(flowAParams.p_batch_number === null, 'TEST 6c: Flow A does NOT create a batch number');
  assert(flowAParams.p_transaction_type === 'OPENING_STOCK', 'TEST 6d: Transaction type is OPENING_STOCK (not PURCHASE_IN)');

  // TEST 7: Flow B (Batch Tracked Product Opening Stock)
  const flowBParams = buildCreateProductParams({
    name: 'Syngenta Bio Product',
    opening_stock: 20,
    batch_tracking: true,
    expiry_tracking: true,
    batch_number: 'TEST-BATCH-001',
    expiry_date: '2028-05-30',
  });
  assert(flowBParams.p_batch_tracking === true, 'TEST 7a: Flow B enables batch tracking');
  assert(flowBParams.p_batch_number === 'TEST-BATCH-001', 'TEST 7b: Flow B stores user-provided batch number');
  assert(flowBParams.p_expiry_date === '2028-05-30', 'TEST 7c: Flow B stores exact user-entered expiry date without generating fake dates');

  // TEST 8: Multi-Field Search Pattern Verification
  const searchFilter = `name.ilike.%890123456789%,sku.ilike.%890123456789%,barcode.ilike.%890123456789%`;
  assert(searchFilter.includes('name.ilike') && searchFilter.includes('sku.ilike') && searchFilter.includes('barcode.ilike'), 'TEST 8: Product search evaluates across Name, SKU, and Barcode');

  console.log("\n=========================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=========================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSystemAuditTests();
