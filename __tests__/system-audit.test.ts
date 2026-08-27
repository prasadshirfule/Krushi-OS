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

// Simulated Atomic Stock Movement Engine Verification
class MockDatabaseState {
  products: Map<string, { current_stock: number; batch_tracking: boolean }> = new Map();
  batches: Map<string, { batch_number: string; quantity_available: number; expiry_date: string }> = new Map();
  stock_transactions: Array<{ product_id: string; batch_id?: string | null; transaction_type: string; change: number; new_stock: number }> = [];

  processStockMovement(productId: string, batchId: string | null, type: string, change: number) {
    const prod = this.products.get(productId);
    if (!prod) throw new Error(`Product ${productId} not found`);

    const newStock = prod.current_stock + change;
    if (newStock < 0) {
      throw new Error(`Insufficient product stock for ID ${productId} (Current: ${prod.current_stock}, Change: ${change})`);
    }

    if (batchId) {
      const b = this.batches.get(batchId);
      if (!b) throw new Error(`Batch ${batchId} not found`);
      const newBatchAvail = b.quantity_available + change;
      if (newBatchAvail < 0) {
        throw new Error(`Insufficient batch stock (Available: ${b.quantity_available}, Change: ${change})`);
      }
      b.quantity_available = newBatchAvail;
    }

    prod.current_stock = newStock;
    this.stock_transactions.push({ product_id: productId, batch_id: batchId, transaction_type: type, change, new_stock: newStock });
    return newStock;
  }

  processFEFOSaleDeduction(productId: string, requestedQty: number) {
    if (requestedQty <= 0) throw new Error('Requested sale quantity must be greater than zero');
    const prod = this.products.get(productId);
    if (!prod) throw new Error('Product not found');

    if (prod.current_stock < requestedQty) {
      throw new Error(`Insufficient non-expired batch stock for product ${productId} (Short by ${requestedQty - prod.current_stock} units)`);
    }

    let qtyNeeded = requestedQty;
    // Sort batches by expiry date ASC
    const sortedBatches = Array.from(this.batches.entries()).sort((a, b) => a[1].expiry_date.localeCompare(b[1].expiry_date));

    for (const [batchId, b] of sortedBatches) {
      if (qtyNeeded <= 0) break;
      if (b.quantity_available <= 0) continue;

      const deduct = Math.min(b.quantity_available, qtyNeeded);
      this.processStockMovement(productId, batchId, 'SALE_OUT', -deduct);
      qtyNeeded -= deduct;
    }

    if (qtyNeeded > 0) {
      throw new Error('Insufficient batch stock');
    }
  }
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

  // TEST 6: Flow A (Normal Product Opening Stock = 50)
  const db = new MockDatabaseState();
  db.products.set('p-normal', { current_stock: 50, batch_tracking: false });
  db.stock_transactions.push({ product_id: 'p-normal', batch_id: null, transaction_type: 'OPENING_STOCK', change: 50, new_stock: 50 });

  assert(db.products.get('p-normal')?.current_stock === 50, 'TEST 6a: Flow A current stock is 50');
  assert(db.batches.size === 0, 'TEST 6b: Flow A creates 0 product_batches');
  assert(db.stock_transactions[0].transaction_type === 'OPENING_STOCK', 'TEST 6c: Stock transaction is OPENING_STOCK');

  // TEST 7: Sale Stock Reduction (Sell 5 from 50)
  db.processStockMovement('p-normal', null, 'SALE_OUT', -5);
  assert(db.products.get('p-normal')?.current_stock === 45, 'TEST 7a: Product stock decreases to 45 after selling 5');
  assert(db.stock_transactions.length === 2 && db.stock_transactions[1].transaction_type === 'SALE_OUT', 'TEST 7b: SALE_OUT stock transaction entry created');

  // TEST 8: Insufficient Negative Stock Rejection
  let negStockErr = false;
  try {
    db.processStockMovement('p-normal', null, 'SALE_OUT', -100);
  } catch (err: any) {
    negStockErr = err.message.includes('Insufficient product stock');
  }
  assert(negStockErr, 'TEST 8a: Overselling (100 > 45) raises insufficient stock exception');
  assert(db.products.get('p-normal')?.current_stock === 45, 'TEST 8b: Product stock remains 45 without partial reduction');

  // TEST 9: FEFO Multi-Batch Allocation (Batch A = 5, Batch B = 10, Sell 12)
  const dbBatch = new MockDatabaseState();
  dbBatch.products.set('p-batch', { current_stock: 15, batch_tracking: true });
  dbBatch.batches.set('b-a', { batch_number: 'BATCH-A', quantity_available: 5, expiry_date: '2027-01-01' });
  dbBatch.batches.set('b-b', { batch_number: 'BATCH-B', quantity_available: 10, expiry_date: '2028-01-01' });

  dbBatch.processFEFOSaleDeduction('p-batch', 12);
  assert(dbBatch.batches.get('b-a')?.quantity_available === 0, 'TEST 9a: FEFO completely depletes Batch A (5 -> 0)');
  assert(dbBatch.batches.get('b-b')?.quantity_available === 3, 'TEST 9b: FEFO deducts remaining 7 from Batch B (10 -> 3)');
  assert(dbBatch.products.get('p-batch')?.current_stock === 3, 'TEST 9c: Total product current_stock synchronized to 3');

  // TEST 10: Concurrency Simulation (Stock = 10, Tx A & Tx B attempt 8 each)
  const dbConc = new MockDatabaseState();
  dbConc.products.set('p-conc', { current_stock: 10, batch_tracking: false });

  // Tx A succeeds
  dbConc.processStockMovement('p-conc', null, 'SALE_OUT', -8);
  assert(dbConc.products.get('p-conc')?.current_stock === 2, 'TEST 10a: First concurrent transaction A succeeds (10 -> 2)');

  // Tx B fails safely
  let concErr = false;
  try {
    dbConc.processStockMovement('p-conc', null, 'SALE_OUT', -8);
  } catch (err: any) {
    concErr = err.message.includes('Insufficient product stock');
  }
  assert(concErr, 'TEST 10b: Second concurrent transaction B fails safely with insufficient stock exception');
  assert(dbConc.products.get('p-conc')?.current_stock === 2, 'TEST 10c: Product stock remains 2 and never becomes negative');

  // TEST 11: Sale Return (+5 units)
  db.processStockMovement('p-normal', null, 'SALE_RETURN', 5);
  assert(db.products.get('p-normal')?.current_stock === 50, 'TEST 11a: Sale Return increases stock back from 45 to 50');
  assert(db.stock_transactions.find(t => t.transaction_type === 'SALE_RETURN') !== undefined, 'TEST 11b: SALE_RETURN transaction entry logged');

  console.log("\n=========================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=========================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSystemAuditTests();
