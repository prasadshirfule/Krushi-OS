import {
  getDemoCustomersClient,
  saveDemoCustomerClient,
  updateDemoCustomerClient,
  deleteDemoCustomerClient,
  getDemoSalesClient,
  saveDemoSaleClient,
  getDemoSalesSummaryClient,
  KRUSHI_DEMO_CUSTOMERS_KEY,
  KRUSHI_DEMO_SALES_KEY
} from '@/lib/client-demo-store';

// Set up mock window and localStorage for Node test environment
const mockStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { for (const k in mockStorage) delete mockStorage[k]; }
};

class MockCustomEvent {
  type: string;
  detail: any;
  constructor(type: string, options?: { detail: any }) {
    this.type = type;
    this.detail = options?.detail;
  }
}
(global as any).CustomEvent = MockCustomEvent;

const listeners: Record<string, Function[]> = {};
(global as any).window = {
  dispatchEvent: (event: any) => {
    (listeners[event.type] || []).forEach(fn => fn(event));
    return true;
  },
  addEventListener: (type: string, fn: Function) => {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(fn);
  },
  removeEventListener: (type: string, fn: Function) => {
    if (listeners[type]) listeners[type] = listeners[type].filter(f => f !== fn);
  }
};

async function runTests() {
  console.log('--- TEST 1: Initial Mock Customers & Sales ---');
  const custs = getDemoCustomersClient();
  console.log('Initial customers count:', custs.length);
  if (custs.length !== 3) throw new Error(`Expected 3 customers, got ${custs.length}`);

  const sales = getDemoSalesClient();
  console.log('Initial sales count:', sales.length);
  if (sales.length !== 2) throw new Error(`Expected 2 sales, got ${sales.length}`);

  const summary = getDemoSalesSummaryClient();
  console.log('Initial today revenue:', summary.todayRevenue);
  console.log('Initial bills today:', summary.billsToday);
  console.log('Initial total invoices:', summary.totalInvoices);
  if (summary.totalInvoices !== 2) throw new Error(`Expected 2 total invoices, got ${summary.totalInvoices}`);

  console.log('\n--- TEST 2: Customer Creation ("Prasad Shirfule") ---');
  const newCust = saveDemoCustomerClient({
    name: 'Prasad Shirfule',
    mobile: '9890341388',
    address: 'bakori phata wagholi, pune',
    village: 'wagholi, pune'
  });

  console.log('Created customer ID:', newCust.id);
  console.log('Created customer Name:', newCust.name);
  console.log('Created customer Mobile:', newCust.mobile);
  console.log('Created customer Address:', newCust.address);

  if (newCust.name !== 'Prasad Shirfule') throw new Error('Customer name mismatch');
  if (newCust.mobile !== '9890341388') throw new Error('Mobile mismatch');

  // Verify persistence in localStorage
  const afterCreateCusts = getDemoCustomersClient();
  if (afterCreateCusts.length !== 4) throw new Error(`Expected 4 customers, got ${afterCreateCusts.length}`);
  if (afterCreateCusts[0].name !== 'Prasad Shirfule') throw new Error('New customer should be at top');

  console.log('\n--- TEST 3: Bill Creation (Customer: Prasad Shirfule, DAP 1 bag = ₹1,350) ---');
  const bill1 = saveDemoSaleClient({
    customer_id: newCust.id,
    customer_name: newCust.name,
    customer_phone: newCust.mobile,
    payment_method: 'Cash',
    items: [
      {
        product_id: 'p-102',
        product_name: 'DAP Fertilizer 50kg (IFFCO)',
        quantity: 1,
        unit_price: 1350,
        discount_percent: 0,
        gst_rate: 5
      }
    ]
  });

  console.log('Bill 1 Invoice Number:', bill1.invoice_number);
  console.log('Bill 1 Customer Name:', bill1.customer_name);
  console.log('Bill 1 Customer ID:', bill1.customer_id);
  console.log('Bill 1 Total Amount:', bill1.total_amount);
  console.log('Bill 1 Status:', bill1.status);

  if (bill1.invoice_number !== 'KOS-2026-003') throw new Error(`Expected invoice KOS-2026-003, got ${bill1.invoice_number}`);
  if (bill1.customer_id !== newCust.id) throw new Error('Customer ID relationship not preserved');
  if (bill1.customer_name !== 'Prasad Shirfule') throw new Error('Customer name mismatch');
  if (bill1.total_amount !== 1350) throw new Error(`Expected total ₹1,350, got ${bill1.total_amount}`);
  if (bill1.status !== 'COMPLETED') throw new Error(`Expected status COMPLETED, got ${bill1.status}`);

  console.log('\n--- Statistics Check After Bill 1 ---');
  const stats1 = getDemoSalesSummaryClient();
  console.log("Today's Revenue:", stats1.todayRevenue);
  console.log('Bills Today:', stats1.billsToday);
  console.log('Total Invoices:', stats1.totalInvoices);

  if (stats1.todayRevenue !== 1350) throw new Error(`Expected ₹1,350 today revenue, got ${stats1.todayRevenue}`);
  if (stats1.billsToday !== 1) throw new Error(`Expected 1 bill today, got ${stats1.billsToday}`);
  if (stats1.totalInvoices !== 3) throw new Error(`Expected 3 total invoices, got ${stats1.totalInvoices}`);

  console.log('\n--- TEST 4: Second Bill Creation (Urea 45kg = ₹266) ---');
  const bill2 = saveDemoSaleClient({
    customer_id: 'walk-in',
    customer_name: 'Walk-in Customer',
    payment_method: 'Cash',
    items: [
      {
        product_id: 'p-103',
        product_name: 'Urea 45kg Neem Coated',
        quantity: 1,
        unit_price: 266,
        discount_percent: 0,
        gst_rate: 5
      }
    ]
  });

  console.log('Bill 2 Invoice Number:', bill2.invoice_number);
  console.log('Bill 2 Total Amount:', bill2.total_amount);

  if (bill2.invoice_number !== 'KOS-2026-004') throw new Error(`Expected invoice KOS-2026-004, got ${bill2.invoice_number}`);
  if (bill2.total_amount !== 266) throw new Error(`Expected total ₹266, got ${bill2.total_amount}`);

  console.log('\n--- Statistics Check After Bill 2 ---');
  const stats2 = getDemoSalesSummaryClient();
  console.log("Today's Revenue:", stats2.todayRevenue);
  console.log('Bills Today:', stats2.billsToday);
  console.log('Total Invoices:', stats2.totalInvoices);

  if (stats2.todayRevenue !== 1616) throw new Error(`Expected ₹1,616 today revenue (1350 + 266), got ${stats2.todayRevenue}`);
  if (stats2.billsToday !== 2) throw new Error(`Expected 2 bills today, got ${stats2.billsToday}`);
  if (stats2.totalInvoices !== 4) throw new Error(`Expected 4 total invoices, got ${stats2.totalInvoices}`);

  console.log('\n--- TEST 5: Customer Edit and Persistence ---');
  const updatedCust = updateDemoCustomerClient(newCust.id, {
    name: 'Prasad Shirfule Patil'
  });
  console.log('Updated Customer Name:', updatedCust.name);
  if (updatedCust.name !== 'Prasad Shirfule Patil') throw new Error('Update failed');

  // Verify in sales that customer relation resolves updated name
  const salesAfterUpdate = getDemoSalesClient();
  const foundSale = salesAfterUpdate.find(s => s.id === bill1.id);
  console.log('Sale customer resolved after edit:', foundSale.customer_name);
  if (foundSale.customer_name !== 'Prasad Shirfule Patil') {
    throw new Error('Sale customer relationship did not dynamically resolve updated customer');
  }

  console.log('\n--- TEST 6: Customer Delete ---');
  deleteDemoCustomerClient(newCust.id);
  const remainingCusts = getDemoCustomersClient();
  if (remainingCusts.some(c => c.id === newCust.id)) {
    throw new Error('Customer was not deleted');
  }
  console.log('Remaining customers after deletion:', remainingCusts.length);

  console.log('\n========================================');
  console.log('🎉 ALL INTEGRATION & PERSISTENCE TESTS PASSED!');
  console.log('========================================');
}

runTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
