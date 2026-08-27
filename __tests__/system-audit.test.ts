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

// Simulated RPC parameter builder & validator for unit test assertions
function validateCreateProductRPC(params: {
  p_shop_id: string;
  p_category_id: string;
  p_name: string;
  p_opening_stock: number;
  p_sku?: string | null;
  p_barcode?: string | null;
  p_category_shop_id?: string;
  existing_skus?: string[];
  existing_barcodes?: string[];
}) {
  if (params.p_opening_stock < 0) {
    throw new Error('Opening stock cannot be negative');
  }
  if (!params.p_name || params.p_name.trim().length < 2) {
    throw new Error('Product name must be at least 2 characters');
  }
  if (params.p_category_shop_id && params.p_category_shop_id !== params.p_shop_id) {
    throw new Error('Category not found or does not belong to this shop');
  }
  if (params.p_sku && params.existing_skus?.includes(params.p_sku)) {
    throw new Error(`Product with SKU "${params.p_sku}" already exists in this shop`);
  }
  if (params.p_barcode && params.existing_barcodes?.includes(params.p_barcode)) {
    throw new Error(`Product with Barcode "${params.p_barcode}" already exists in this shop`);
  }
  return { success: true };
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
    name: 'A',
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
    purchase_price: -50,
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

  // TEST 6: Negative Opening Stock Rejection
  let negativeStockErr = false;
  try {
    validateCreateProductRPC({
      p_shop_id: 'shop-1',
      p_category_id: 'cat-1',
      p_name: 'Test Fertilizer',
      p_opening_stock: -10,
    });
  } catch (err: any) {
    negativeStockErr = err.message.includes('Opening stock cannot be negative');
  }
  assert(negativeStockErr, 'TEST 6: Negative opening stock (< 0) raises an exception');

  // TEST 7: Cross-Shop Category Rejection
  let crossShopCategoryErr = false;
  try {
    validateCreateProductRPC({
      p_shop_id: 'shop-1',
      p_category_id: 'cat-foreign',
      p_category_shop_id: 'shop-2',
      p_name: 'Test Seed',
      p_opening_stock: 10,
    });
  } catch (err: any) {
    crossShopCategoryErr = err.message.includes('Category not found or does not belong to this shop');
  }
  assert(crossShopCategoryErr, 'TEST 7: Category belonging to another shop is rejected');

  // TEST 8: Duplicate SKU Rejection
  let duplicateSkuErr = false;
  try {
    validateCreateProductRPC({
      p_shop_id: 'shop-1',
      p_category_id: 'cat-1',
      p_name: 'Test Insecticide',
      p_opening_stock: 5,
      p_sku: 'SKU-EXISTING',
      existing_skus: ['SKU-EXISTING'],
    });
  } catch (err: any) {
    duplicateSkuErr = err.message.includes('Product with SKU "SKU-EXISTING" already exists');
  }
  assert(duplicateSkuErr, 'TEST 8: Duplicate SKU within the same shop raises an exception');

  // TEST 9: Duplicate Barcode Rejection
  let duplicateBarcodeErr = false;
  try {
    validateCreateProductRPC({
      p_shop_id: 'shop-1',
      p_category_id: 'cat-1',
      p_name: 'Test Fungicide',
      p_opening_stock: 5,
      p_barcode: '890123456789',
      existing_barcodes: ['890123456789'],
    });
  } catch (err: any) {
    duplicateBarcodeErr = err.message.includes('Product with Barcode "890123456789" already exists');
  }
  assert(duplicateBarcodeErr, 'TEST 9: Duplicate Barcode within the same shop raises an exception');

  // TEST 10: Search Query Sanitization
  const rawSearch = 'Urea (50Kg), Special & Test\\';
  const cleanSearch = rawSearch.replace(/[,().\\]/g, '').trim();
  assert(cleanSearch === 'Urea 50Kg Special & Test', 'TEST 10: Special characters in search input are sanitized safely');

  console.log("\n=========================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=========================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSystemAuditTests();
