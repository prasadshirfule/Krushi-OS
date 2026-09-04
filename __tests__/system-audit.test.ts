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

// Simulated Central Stock Engine & FEFO Return Allocation Verification
class MockFEFOReturnState {
  products: Map<string, { current_stock: number }> = new Map();
  batches: Map<string, { batch_number: string; quantity_available: number }> = new Map();
  sale_item_batches: Array<{ id: string; sale_item_id: string; batch_id: string; quantity: number }> = [];
  sale_return_item_batches: Array<{ sale_item_id: string; sale_item_batch_id: string; batch_id: string; quantity: number }> = [];
  stock_transactions: Array<{ product_id: string; batch_id: string | null; transaction_type: string; change: number }> = [];

  processSaleReturn(productId: string, saleItemId: string, returnQty: number) {
    const totalSold = this.sale_item_batches
      .filter(s => s.sale_item_id === saleItemId)
      .reduce((sum, b) => sum + b.quantity, 0);

    const totalAlreadyReturned = this.sale_return_item_batches
      .filter(r => r.sale_item_id === saleItemId)
      .reduce((sum, r) => sum + r.quantity, 0);

    const maxReturnable = totalSold - totalAlreadyReturned;
    if (returnQty > maxReturnable) {
      throw new Error(`Cannot return ${returnQty} units. Maximum returnable remaining is ${maxReturnable} units (Sold: ${totalSold}, Already Returned: ${totalAlreadyReturned})`);
    }

    let qtyToRestore = returnQty;
    const allocations = this.sale_item_batches
      .filter(s => s.sale_item_id === saleItemId)
      .sort((a, b) => a.id.localeCompare(b.id));

    // Deep clone snapshot for atomic rollback simulation
    const productsSnapshot = new Map(Array.from(this.products.entries()).map(([k, v]) => [k, { ...v }]));
    const batchesSnapshot = new Map(Array.from(this.batches.entries()).map(([k, v]) => [k, { ...v }]));
    const returnsSnapshot = [...this.sale_return_item_batches];
    const transSnapshot = [...this.stock_transactions];

    try {
      for (const sib of allocations) {
        if (qtyToRestore <= 0) break;

        const batchReturned = this.sale_return_item_batches
          .filter(r => r.sale_item_batch_id === sib.id)
          .reduce((sum, r) => sum + r.quantity, 0);

        const batchReturnable = sib.quantity - batchReturned;

        if (batchReturnable > 0) {
          const restoreChunk = Math.min(batchReturnable, qtyToRestore);

          // Restore batch stock
          const b = this.batches.get(sib.batch_id);
          if (!b) throw new Error('Batch not found');
          b.quantity_available += restoreChunk;

          // Restore product stock
          const p = this.products.get(productId);
          if (!p) throw new Error('Product not found');
          p.current_stock += restoreChunk;

          this.stock_transactions.push({ product_id: productId, batch_id: sib.batch_id, transaction_type: 'SALE_RETURN', change: restoreChunk });
          this.sale_return_item_batches.push({ sale_item_id: saleItemId, sale_item_batch_id: sib.id, batch_id: sib.batch_id, quantity: restoreChunk });

          qtyToRestore -= restoreChunk;
        }
      }

      if (qtyToRestore > 0) {
        throw new Error('Unallocated return quantity remaining');
      }
    } catch (err) {
      // Rollback snapshot on failure
      this.products = productsSnapshot;
      this.batches = batchesSnapshot;
      this.sale_return_item_batches = returnsSnapshot;
      this.stock_transactions = transSnapshot;
      throw err;
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
    opening_stock: 10,
    batch_number: 'BATCH-001',
    expiry_date: '04/09/2027',
  });
  assert(!invalidNameRes.success, 'TEST 1: Product validation fails when name is less than 2 characters');

  // TEST 2: Valid Agricultural Product Validation
  const validProductRes = productSchema.safeParse({
    name: 'Chlorpyrifos 20% EC',
    category_id: 'cat-123',
    purchase_price: 120,
    selling_price: 180,
    gst_rate: 18,
    unit: 'Bottle',
    min_stock: 10,
    opening_stock: 50,
    batch_number: 'CHLOR-2026-01',
    expiry_date: '04/09/2027',
    product_type: 'Pesticide',
    active_ingredient: 'Chlorpyrifos 20% EC',
    licence_number: 'CIB-998811/2026',
  });
  assert(validProductRes.success, 'TEST 2: Valid agricultural product payload passes schema validation');


  // TEST 3: FEFO Return Allocation - TEST CASE 1 (Return 8 of 12: A = 5, B = 3)
  const dbReturn = new MockFEFOReturnState();
  dbReturn.products.set('p1', { current_stock: 3 }); // Remaining 3 out of 15
  dbReturn.batches.set('b-a', { batch_number: 'BATCH-A', quantity_available: 0 }); // 5 sold
  dbReturn.batches.set('b-b', { batch_number: 'BATCH-B', quantity_available: 3 }); // 7 sold out of 10

  dbReturn.sale_item_batches.push(
    { id: 'sib-1', sale_item_id: 'item-1', batch_id: 'b-a', quantity: 5 },
    { id: 'sib-2', sale_item_id: 'item-1', batch_id: 'b-b', quantity: 7 }
  );

  dbReturn.processSaleReturn('p1', 'item-1', 8);

  const restoredBatchA = dbReturn.batches.get('b-a')?.quantity_available;
  const restoredBatchB = dbReturn.batches.get('b-b')?.quantity_available;
  const restoredProdStock = dbReturn.products.get('p1')?.current_stock;

  assert(restoredBatchA === 5, 'TEST 3a: FEFO Return 1 - Batch A restored to 5 (0 + 5)');
  assert(restoredBatchB === 6, 'TEST 3b: FEFO Return 1 - Batch B restored to 6 (3 + 3)');
  assert(restoredProdStock === 11, 'TEST 3c: Product current_stock restored from 3 to 11 (3 + 8)');

  // TEST 4: FEFO Return Allocation - TEST CASE 2 (Second Return of 4 units -> Batch B restored by 4)
  dbReturn.processSaleReturn('p1', 'item-1', 4);
  const finalBatchA = dbReturn.batches.get('b-a')?.quantity_available;
  const finalBatchB = dbReturn.batches.get('b-b')?.quantity_available;

  assert(finalBatchA === 5, 'TEST 4a: FEFO Return 2 - Batch A remains 5 (no extra restoration to A)');
  assert(finalBatchB === 10, 'TEST 4b: FEFO Return 2 - Batch B restored by 4 (6 -> 10)');
  assert(dbReturn.products.get('p1')?.current_stock === 15, 'TEST 4c: Product stock fully restored back to 15');

  // TEST 5: FEFO Return Validation - TEST CASE 3 (Attempt Return 5 when 12/12 already returned -> REJECT)
  let overReturnErr = false;
  try {
    dbReturn.processSaleReturn('p1', 'item-1', 5);
  } catch (err: any) {
    overReturnErr = err.message.includes('Maximum returnable remaining is 0 units');
  }
  assert(overReturnErr, 'TEST 5: Attempting to return 5 units when 12/12 already returned is rejected with exception');

  // TEST 6: Atomic Rollback Simulation - TEST CASE 4 (Force DB failure during return)
  const dbRollback = new MockFEFOReturnState();
  dbRollback.products.set('p-fail', { current_stock: 0 });
  dbRollback.batches.set('b-valid', { batch_number: 'B-VALID', quantity_available: 0 });
  dbRollback.sale_item_batches.push(
    { id: 'sib-fail-1', sale_item_id: 'item-fail', batch_id: 'b-valid', quantity: 5 },
    { id: 'sib-fail-2', sale_item_id: 'item-fail', batch_id: 'b-nonexistent', quantity: 5 }
  );

  let rollbackErr = false;
  try {
    dbRollback.processSaleReturn('p-fail', 'item-fail', 8);
  } catch (err: any) {
    rollbackErr = true;
  }

  assert(rollbackErr, 'TEST 6a: Forcing failure during multi-batch return raises exception');
  assert(dbRollback.products.get('p-fail')?.current_stock === 0, 'TEST 6b: Product stock rolls back completely to 0');
  assert(dbRollback.batches.get('b-valid')?.quantity_available === 0, 'TEST 6c: Batch A stock rolls back completely to 0');
  assert(dbRollback.sale_return_item_batches.length === 0, 'TEST 6d: Zero partial return records remain in sale_return_item_batches');

  console.log("\n=========================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=========================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSystemAuditTests();
