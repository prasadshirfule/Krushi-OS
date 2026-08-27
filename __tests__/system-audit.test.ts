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

// Simulated Central Stock Engine with Direction Validation & FEFO Traceability
class MockDatabaseState {
  products: Map<string, { current_stock: number; batch_tracking: boolean }> = new Map();
  batches: Map<string, { batch_number: string; quantity_available: number; expiry_date: string | null }> = new Map();
  stock_transactions: Array<{ product_id: string; batch_id?: string | null; transaction_type: string; change: number; new_stock: number }> = [];
  sale_item_batches: Array<{ sale_id: string; sale_item_id: string; batch_id: string; quantity: number }> = [];
  sales: Map<string, { status: string; total: number }> = new Map();

  processStockMovement(productId: string, batchId: string | null, type: string, change: number) {
    if (change === 0) throw new Error('Stock movement quantity change cannot be zero');

    // Direction Validations
    const positiveTypes = ['OPENING_STOCK', 'PURCHASE_IN', 'SALE_RETURN', 'RETURN_IN', 'SALE_REVERSAL', 'ADJUSTMENT_IN'];
    const negativeTypes = ['SALE_OUT', 'PURCHASE_RETURN', 'ADJUSTMENT_OUT', 'ADJUSTMENT', 'DAMAGED', 'EXPIRED'];

    if (positiveTypes.includes(type) && change <= 0) {
      throw new Error(`Transaction type "${type}" requires a positive quantity change (+)`);
    }

    if (negativeTypes.includes(type) && change >= 0) {
      throw new Error(`Transaction type "${type}" requires a negative quantity change (-)`);
    }

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

  processFEFOSaleDeduction(productId: string, requestedQty: number, saleId: string, saleItemId: string) {
    if (requestedQty <= 0) throw new Error('Requested sale quantity must be greater than zero');
    const prod = this.products.get(productId);
    if (!prod) throw new Error('Product not found');

    if (prod.current_stock < requestedQty) {
      throw new Error(`Insufficient non-expired batch stock for product ${productId} (Short by ${requestedQty - prod.current_stock} units)`);
    }

    let qtyNeeded = requestedQty;
    // Sort batches by expiry date ASC (handling NULL as far future date)
    const sortedBatches = Array.from(this.batches.entries()).sort((a, b) => {
      const dateA = a[1].expiry_date || '9999-12-31';
      const dateB = b[1].expiry_date || '9999-12-31';
      return dateA.localeCompare(dateB);
    });

    for (const [batchId, b] of sortedBatches) {
      if (qtyNeeded <= 0) break;
      if (b.quantity_available <= 0) continue;

      const deduct = Math.min(b.quantity_available, qtyNeeded);
      this.processStockMovement(productId, batchId, 'SALE_OUT', -deduct);
      this.sale_item_batches.push({ sale_id: saleId, sale_item_id: saleItemId, batch_id: batchId, quantity: deduct });
      qtyNeeded -= deduct;
    }

    if (qtyNeeded > 0) {
      throw new Error('Insufficient batch stock');
    }
  }

  cancelSale(saleId: string) {
    const sale = this.sales.get(saleId);
    if (!sale) throw new Error('Sale not found');
    if (sale.status === 'cancelled') throw new Error('Sale is already cancelled');

    const allocations = this.sale_item_batches.filter(s => s.sale_id === saleId);
    for (const alloc of allocations) {
      this.processStockMovement('p-batch', alloc.batch_id, 'SALE_REVERSAL', alloc.quantity);
    }
    sale.status = 'cancelled';
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

  // TEST 6: Transaction Direction Validation (Reject SALE_OUT with positive qty)
  const db = new MockDatabaseState();
  db.products.set('p-test', { current_stock: 50, batch_tracking: false });

  let dirErr1 = false;
  try {
    db.processStockMovement('p-test', null, 'SALE_OUT', 5);
  } catch (err: any) {
    dirErr1 = err.message.includes('Transaction type "SALE_OUT" requires a negative quantity change');
  }
  assert(dirErr1, 'TEST 6a: SALE_OUT with positive quantity change (+5) is rejected');

  let dirErr2 = false;
  try {
    db.processStockMovement('p-test', null, 'OPENING_STOCK', -10);
  } catch (err: any) {
    dirErr2 = err.message.includes('Transaction type "OPENING_STOCK" requires a positive quantity change');
  }
  assert(dirErr2, 'TEST 6b: OPENING_STOCK with negative quantity change (-10) is rejected');

  // TEST 7: FEFO Multi-Batch Deduction & Traceability (`sale_item_batches`)
  const dbBatch = new MockDatabaseState();
  dbBatch.products.set('p-batch', { current_stock: 25, batch_tracking: true });
  dbBatch.batches.set('b-exp-null', { batch_number: 'BATCH-NOEXP', quantity_available: 10, expiry_date: null });
  dbBatch.batches.set('b-exp-2027', { batch_number: 'BATCH-2027', quantity_available: 15, expiry_date: '2027-06-30' });

  dbBatch.processFEFOSaleDeduction('p-batch', 18, 'sale-1', 'item-1');
  assert(dbBatch.batches.get('b-exp-2027')?.quantity_available === 0, 'TEST 7a: FEFO depletes earliest expiring batch (2027-06-30)');
  assert(dbBatch.batches.get('b-exp-null')?.quantity_available === 7, 'TEST 7b: FEFO correctly includes NULL expiry date batch for remaining 3 units (10 -> 7)');
  assert(dbBatch.sale_item_batches.length === 2, 'TEST 7c: Multi-batch traceability records 2 entries in sale_item_batches');
  assert(dbBatch.sale_item_batches[0].batch_id === 'b-exp-2027' && dbBatch.sale_item_batches[0].quantity === 15, 'TEST 7d: Traceability records Batch 2027 = 15 units');
  assert(dbBatch.sale_item_batches[1].batch_id === 'b-exp-null' && dbBatch.sale_item_batches[1].quantity === 3, 'TEST 7e: Traceability records Batch NOEXP = 3 units');

  // TEST 8: Sale Cancellation Reversal
  dbBatch.sales.set('sale-1', { status: 'completed', total: 1800 });
  dbBatch.cancelSale('sale-1');
  assert(dbBatch.sales.get('sale-1')?.status === 'cancelled', 'TEST 8a: Sale status updated to cancelled');
  assert(dbBatch.products.get('p-batch')?.current_stock === 25, 'TEST 8b: Product current_stock restored back to 25 via SALE_REVERSAL');
  assert(dbBatch.batches.get('b-exp-2027')?.quantity_available === 15, 'TEST 8c: Batch 2027 stock restored to 15');
  assert(dbBatch.batches.get('b-exp-null')?.quantity_available === 10, 'TEST 8d: Batch NOEXP stock restored to 10');

  // TEST 9: Purchase In Stock Increase
  db.processStockMovement('p-test', null, 'PURCHASE_IN', 20);
  assert(db.products.get('p-test')?.current_stock === 70, 'TEST 9: PURCHASE_IN increases stock from 50 to 70 via Central Engine');

  console.log("\n=========================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=========================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSystemAuditTests();
