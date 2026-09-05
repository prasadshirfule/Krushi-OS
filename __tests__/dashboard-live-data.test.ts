import {
  calculateTodaySales,
  calculateSaleProfit,
  calculateTotalBills,
  calculateTotalOutstanding,
  calculateLowStock,
  calculateExpiringBatches,
  calculateTopSellingProducts,
  calculateSalesChart,
  calculateRecentSales,
  getISTDateString,
  isTodayIST,
} from '../services/dashboard-data.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

console.log("=========================================");
console.log("STARTING KRUSHI OS DASHBOARD TEST SUITE");
console.log("=========================================");

const testNow = new Date('2026-09-05T12:00:00+05:30'); // Sept 5, 2026 IST

// ───────────────────────────────────────────────────
// TEST 1: IST Date string & Today detection
// ───────────────────────────────────────────────────
const istDate = getISTDateString(testNow);
assert(istDate === '2026-09-05', `IST Date for 2026-09-05T12:00:00+05:30 should be 2026-09-05, got ${istDate}`);

const isToday = isTodayIST(testNow, testNow);
assert(isToday === true, 'isTodayIST should return true for same day');

const yesterday = new Date('2026-09-04T18:00:00+05:30');
const isYesterdayToday = isTodayIST(yesterday, testNow);
assert(isYesterdayToday === false, 'isTodayIST should return false for yesterday');

// ───────────────────────────────────────────────────
// TEST 2: Today's Sales Calculation
// Sale 1 = ₹1,200, Sale 2 = ₹2,000, Sale 3 = ₹500 -> Total = ₹3,700
// ───────────────────────────────────────────────────
const sampleSales = [
  {
    id: 'sale-1',
    invoice_number: 'KOS-2026-001',
    total_amount: 1200,
    status: 'COMPLETED',
    sale_date: '2026-09-05T10:30:00+05:30',
    items: [
      { product_id: 'p-1', product_name: 'YARAVITA 1 LTR', quantity: 1, selling_price: 1200, purchase_price: 900, discount_amount: 0 }
    ]
  },
  {
    id: 'sale-2',
    invoice_number: 'KOS-2026-002',
    total_amount: 2000,
    status: 'COMPLETED',
    sale_date: '2026-09-05T14:15:00+05:30',
    items: [
      { product_id: 'p-2', product_name: 'SCORE 500 ML', quantity: 1, selling_price: 2000, purchase_price: 1600, discount_amount: 100 }
    ]
  },
  {
    id: 'sale-3',
    invoice_number: 'KOS-2026-003',
    total_amount: 500,
    status: 'COMPLETED',
    sale_date: '2026-09-05T16:45:00+05:30',
    items: [
      { product_id: 'p-3', product_name: 'BAHAR 1 LTR', quantity: 1, selling_price: 500, discount_amount: 0 } // No purchase price, test 15% fallback
    ]
  },
  {
    id: 'sale-yesterday',
    invoice_number: 'KOS-2026-000',
    total_amount: 4500,
    status: 'COMPLETED',
    sale_date: '2026-09-04T15:00:00+05:30',
    items: [
      { product_id: 'p-1', product_name: 'YARAVITA 1 LTR', quantity: 3, selling_price: 1500 }
    ]
  },
  {
    id: 'sale-cancelled',
    invoice_number: 'KOS-2026-999',
    total_amount: 3000,
    status: 'CANCELLED',
    sale_date: '2026-09-05T11:00:00+05:30',
    items: [
      { product_id: 'p-2', product_name: 'SCORE 500 ML', quantity: 2, selling_price: 1500 }
    ]
  }
];

const todaySalesResult = calculateTodaySales(sampleSales, [], testNow);
assert(todaySalesResult.count === 3, `Today sales count should be 3 (excluding yesterday & cancelled), got ${todaySalesResult.count}`);
assert(todaySalesResult.total === 3700, `Today's sales total should be 3700, got ${todaySalesResult.total}`);

// ───────────────────────────────────────────────────
// TEST 3: Today's Profit Calculation
// Sale 1 profit: (1200 - 900) * 1 - 0 = ₹300
// Sale 2 profit: (2000 - 1600) * 1 - 100 = ₹300
// Sale 3 profit: 500 * 0.15 = ₹75
// Total Profit = ₹675
// ───────────────────────────────────────────────────
assert(todaySalesResult.profit === 675, `Today's profit should be ₹675, got ₹${todaySalesResult.profit}`);

// ───────────────────────────────────────────────────
// TEST 4: Total Bills
// 4 completed sales (3 today + 1 yesterday), 1 cancelled -> Total = 4
// ───────────────────────────────────────────────────
const totalBills = calculateTotalBills(sampleSales);
assert(totalBills === 4, `Total bills should be 4, got ${totalBills}`);

// ───────────────────────────────────────────────────
// TEST 5: Outstanding Balance
// Customer A = ₹2,000, Customer B = ₹1,500, Customer C = 0 -> Outstanding = ₹3,500
// ───────────────────────────────────────────────────
const sampleCustomers = [
  { id: 'c-1', name: 'Customer A', outstanding_balance: 2000, is_active: true },
  { id: 'c-2', name: 'Customer B', outstanding: 1500, is_active: true },
  { id: 'c-3', name: 'Customer C', outstanding_balance: 0, is_active: true },
  { id: 'c-4', name: 'Inactive Customer', outstanding_balance: 500, is_active: false }
];

const totalOutstanding = calculateTotalOutstanding(sampleCustomers);
assert(totalOutstanding === 3500, `Total outstanding should be 3500, got ${totalOutstanding}`);

// ───────────────────────────────────────────────────
// TEST 6: Low Stock Card & List consistency
// ───────────────────────────────────────────────────
const sampleProducts = [
  { id: 'p-1', name: 'YARAVITA 1 LTR', current_stock: 3, min_stock: 5, is_active: true },
  { id: 'p-2', name: 'SCORE 500 ML', current_stock: 12, min_stock: 5, is_active: true },
  { id: 'p-3', name: 'BAHAR 1 LTR', current_stock: 2, min_stock: 2, is_active: true },
  { id: 'p-4', name: 'UREA 45KG', current_stock: 40, min_stock: 10, is_active: true },
  { id: 'p-5', name: 'INACTIVE ITEM', current_stock: 1, min_stock: 10, is_active: false },
];

const lowStockResult = calculateLowStock(sampleProducts);
assert(lowStockResult.count === 2, `Low stock count should be 2 (p-1 and p-3), got ${lowStockResult.count}`);
assert(lowStockResult.products.length === 2, `Low stock products list length should match card count (2), got ${lowStockResult.products.length}`);
assert(lowStockResult.products[0].id === 'p-1', 'Low stock list contains p-1');
assert(lowStockResult.products[1].id === 'p-3', 'Low stock list contains p-3');

// ───────────────────────────────────────────────────
// TEST 7: Expiring Soon Card & List consistency
// ───────────────────────────────────────────────────
const sampleBatchesProducts = [
  {
    id: 'p-1',
    name: 'Product 1',
    current_stock: 10,
    is_active: true,
    batches: [
      { id: 'b-1', batch_number: 'B1', expiry_date: '2026-09-20', quantity_available: 5 }, // 15 days ahead -> EXPIRES SOON
      { id: 'b-2', batch_number: 'B2', expiry_date: '2026-11-20', quantity_available: 5 }, // 76 days ahead -> NOT SOON (< 30 days window)
    ]
  },
  {
    id: 'p-2',
    name: 'Product 2',
    current_stock: 8,
    is_active: true,
    batches: [
      { id: 'b-3', batch_number: 'B3', expiry_date: '2026-08-15', quantity_available: 8 }, // Past date -> EXPIRED (not expiring soon)
    ]
  },
  {
    id: 'p-3',
    name: 'Product 3',
    current_stock: 14,
    is_active: true,
    batches: [
      { id: 'b-4', batch_number: 'B4', expiry_date: '2026-09-30', quantity_available: 14 }, // 25 days ahead -> EXPIRES SOON
    ]
  }
];

const expiringResult = calculateExpiringBatches(sampleBatchesProducts, 30, testNow);
assert(expiringResult.count === 2, `Expiring soon count should be 2 (B1 and B4), got ${expiringResult.count}`);
assert(expiringResult.batches.length === 2, `Expiring soon batches list length must match card count (2), got ${expiringResult.batches.length}`);
assert(expiringResult.batches[0].batch_number === 'B1', 'First expiring batch is B1');
assert(expiringResult.batches[1].batch_number === 'B4', 'Second expiring batch is B4');

// ───────────────────────────────────────────────────
// TEST 8: Top Selling Products Aggregation
// YARAVITA: 1 (sale-1) + 3 (sale-yesterday) = 4 units
// SCORE: 1 (sale-2) = 1 unit
// BAHAR: 1 (sale-3) = 1 unit
// ───────────────────────────────────────────────────
const topProducts = calculateTopSellingProducts(sampleSales, 5);
assert(topProducts.length === 3, `Top products count should be 3, got ${topProducts.length}`);
assert(topProducts[0].name === 'YARAVITA 1 LTR', `Top 1 should be YARAVITA 1 LTR, got ${topProducts[0].name}`);
assert(topProducts[0].total_sold === 4, `YARAVITA total sold should be 4, got ${topProducts[0].total_sold}`);

// ───────────────────────────────────────────────────
// TEST 9: Sales Overview Chart
// ───────────────────────────────────────────────────
const chartData = calculateSalesChart(sampleSales, 7, testNow);
assert(chartData.length >= 7, `Chart should have at least 7 days of points, got ${chartData.length}`);
const todayPoint = chartData.find(d => d.date === '2026-09-05');
assert(Boolean(todayPoint), 'Chart must have entry for today (2026-09-05)');
assert(todayPoint?.total === 3700, `Today's chart point total should be 3700, got ${todayPoint?.total}`);

// ───────────────────────────────────────────────────
// TEST 10: Recent Sales Ordering
// ───────────────────────────────────────────────────
const recentSales = calculateRecentSales(sampleSales, 10);
assert(recentSales[0].id === 'sale-3', `Most recent sale should be sale-3, got ${recentSales[0].id}`);
assert(recentSales.length === 4, `Recent sales should have 4 valid sales (excluding cancelled), got ${recentSales.length}`);

console.log("=========================================");
console.log("ALL 10 TEST SUITES PASSED SUCCESSFULLY!");
console.log("=========================================");
