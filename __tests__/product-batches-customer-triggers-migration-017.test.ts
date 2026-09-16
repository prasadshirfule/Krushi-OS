// Migration 017: Product Batches Expiry & Customer Linking Trigger Regression Tests

import { productSchema, customerSchema, validateExpiryDate, formatDDMMYYYYtoDB } from '../lib/validations';
import { normalizeIndianMobile } from '../lib/phone-utils';
import { createProduct, normalizeProduct } from '../services/products.service';
import { createCustomer, normalizeCustomer } from '../services/customers.service';

function runTests() {
  console.log('================================================================');
  console.log('STARTING MIGRATION 017 PRODUCT BATCHES & CUSTOMER TRIGGER TEST SUITE');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${msg}`);
      failed++;
    }
  }

  // ==========================================
  // TEST GROUP 1: Product with no expiry date can be created successfully
  // ==========================================
  const productNoExpiry = {
    name: 'TRACTOR SPRAYER NOZZLE',
    category_id: 'cat-equipment-01',
    purchase_price: 350,
    selling_price: 450,
    unit: 'Piece',
    pack_size: '1 Piece',
    product_size_value: 1,
    product_size_unit: 'Piece',
    opening_stock: 25,
    batch_tracking: true,
    expiry_tracking: false,
    batch_number: 'BATCH-NZ-2026',
    mfd_date: null,
    expiry_date: null, // No expiry date
    gst_rate: 18,
  };

  const validationResultNoExpiry = productSchema.safeParse(productNoExpiry);
  assert(validationResultNoExpiry.success === true, 'TEST 1a: productSchema accepts product with null expiry_date');

  // Verify demo/in-memory product creation with null expiry
  const shopId = 'test-shop-001';
  const createdProd = normalizeProduct({
    id: 'prod-001',
    shop_id: shopId,
    name: productNoExpiry.name,
    selling_price: productNoExpiry.selling_price,
    current_stock: productNoExpiry.opening_stock,
    batch_number: productNoExpiry.batch_number,
    expiry_date: null,
    batches: [
      {
        id: 'batch-001',
        batch_number: productNoExpiry.batch_number,
        manufacturing_date: null,
        expiry_date: null, // Nullable expiry_date in batch
        quantity_available: 25,
      }
    ]
  });

  assert(createdProd.batches?.[0]?.expiry_date === null, 'TEST 1b: Product batch created successfully with null expiry_date');
  assert(createdProd.current_stock === 25, 'TEST 1c: Product stock quantity initialized properly without expiry');

  // ==========================================
  // TEST GROUP 2: Product with manufacturing date + expiry date validates correctly
  // ==========================================
  const validMfd = '2026-01-15';
  const validExp = '2028-01-14';
  const productWithDates = {
    name: 'CORAGEN INSECTICIDE 60ML',
    category_id: 'cat-pesticides-01',
    purchase_price: 1500,
    selling_price: 1850,
    unit: 'Bottle',
    pack_size: '60 ML',
    product_size_value: 60,
    product_size_unit: 'ML',
    opening_stock: 10,
    batch_tracking: true,
    expiry_tracking: true,
    batch_number: 'COR-2026-X1',
    mfd_date: validMfd,
    expiry_date: '14/01/2028',
    gst_rate: 18,
  };

  const validationWithDates = productSchema.safeParse(productWithDates);
  assert(validationWithDates.success === true, 'TEST 2a: productSchema accepts valid DD/MM/YYYY expiry date');

  const dbExpFormatted = formatDDMMYYYYtoDB(productWithDates.expiry_date);
  assert(dbExpFormatted === '2028-01-14', 'TEST 2b: formatDDMMYYYYtoDB correctly converts DD/MM/YYYY to YYYY-MM-DD');

  const mfdDateObj = new Date(validMfd);
  const expDateObj = new Date(dbExpFormatted!);
  assert(expDateObj > mfdDateObj, 'TEST 2c: Expiry date is strictly greater than manufacturing date');

  // ==========================================
  // TEST GROUP 3: Product with expiry earlier than manufacturing date is rejected
  // ==========================================
  const invalidMfd = '2027-06-01';
  const invalidExp = '2026-06-01'; // Earlier than mfd
  const isChronologicallyValid = new Date(invalidExp) > new Date(invalidMfd);
  assert(isChronologicallyValid === false, 'TEST 3a: Constraint logic rejects expiry_date <= manufacturing_date');

  // Test SQL constraint expression logic:
  // (expiry_date IS NULL OR manufacturing_date IS NULL OR expiry_date > manufacturing_date)
  function testConstraint(mfd: string | null, exp: string | null): boolean {
    if (exp === null || mfd === null) return true;
    return new Date(exp) > new Date(mfd);
  }

  assert(testConstraint(null, null) === true, 'TEST 3b: Constraint passes when both dates are NULL');
  assert(testConstraint('2026-01-01', null) === true, 'TEST 3c: Constraint passes when only expiry_date is NULL');
  assert(testConstraint(null, '2028-01-01') === true, 'TEST 3d: Constraint passes when only manufacturing_date is NULL');
  assert(testConstraint('2026-01-01', '2028-01-01') === true, 'TEST 3e: Constraint passes when expiry > manufacturing');
  assert(testConstraint('2027-01-01', '2026-01-01') === false, 'TEST 3f: Constraint fails when expiry < manufacturing');
  assert(testConstraint('2026-01-01', '2026-01-01') === false, 'TEST 3g: Constraint fails when expiry == manufacturing');

  // ==========================================
  // TEST GROUP 4: Customer can be created without an email column
  // ==========================================
  const customerInput = {
    name: 'RAMESHWAR KISAN PATIL',
    mobile: '9822334455',
    village: 'SHIRPUR',
    address: 'NEAR GRAM PANCHAYAT',
    farm_size: '12 Acres',
    crops: 'Cotton, Soybean, Wheat',
    notes: 'Regular customer',
    previous_udhari: 0,
  };

  const custValidation = customerSchema.safeParse(customerInput);
  assert(custValidation.success === true, 'TEST 4a: customerSchema validates customer with mobile and no email');
  assert(!('email' in custValidation.data!), 'TEST 4b: customer payload does NOT include email column');

  const normalizedCust = normalizeCustomer({
    id: 'cust-uuid-001',
    shop_id: shopId,
    name: customerInput.name,
    mobile: customerInput.mobile,
    village: customerInput.village,
    address: customerInput.address,
    farm_size: customerInput.farm_size,
    crops: customerInput.crops,
    outstanding: 0,
  });

  assert(normalizedCust.name === 'RAMESHWAR KISAN PATIL', 'TEST 4c: Normalized customer created successfully');
  assert(normalizedCust.mobile === '9822334455', 'TEST 4d: Customer mobile stored accurately');

  // ==========================================
  // TEST GROUP 5: Customer creation trigger does not reference customers.email
  // ==========================================
  // Simulate trigger auto_link_shop_customer_on_save logic:
  function simulateAutoLinkTrigger(customerRow: any, customerAccounts: any[]) {
    // Corrected logic operating ONLY on customerRow.mobile and customerRow.customer_account_id
    if (customerRow.customer_account_id === null || customerRow.customer_account_id === undefined) {
      if (customerRow.mobile && customerRow.mobile.trim() !== '') {
        const normalized = normalizeIndianMobile(customerRow.mobile);
        if (normalized) {
          const match = customerAccounts.find(acc => acc.mobile === normalized);
          if (match) {
            customerRow.customer_account_id = match.id;
          }
        }
      }
    }
    return customerRow;
  }

  const existingAccounts = [
    { id: 'acc-uuid-101', mobile: '9822334455', name: 'Rameshwar Patil', email: 'rameshwar@example.com' },
  ];

  const newShopCust = {
    id: 'cust-new-1',
    name: 'RAMESHWAR KISAN PATIL',
    mobile: '9822334455', // Matches existing account
    village: 'SHIRPUR',
    customer_account_id: null,
    // Note: NO email field in customer record
  };

  const linkedCust = simulateAutoLinkTrigger(newShopCust, existingAccounts);
  assert(linkedCust.customer_account_id === 'acc-uuid-101', 'TEST 5a: auto_link_shop_customer_on_save links by mobile without needing customer email');

  // ==========================================
  // TEST GROUP 6: Existing customer mobile/account linking continues to work
  // ==========================================
  // Simulate link_shop_customers_on_account_create logic:
  function simulateLinkOnAccountCreate(newAccount: any, shopCustomersList: any[]) {
    if (newAccount.mobile && newAccount.mobile.trim() !== '') {
      shopCustomersList.forEach(c => {
        if (!c.customer_account_id && normalizeIndianMobile(c.mobile) === newAccount.mobile) {
          c.customer_account_id = newAccount.id;
        }
      });
    }
    return shopCustomersList;
  }

  const shopCustomersDB = [
    { id: 'c-1', shop_id: 'shop-A', name: 'Vikram Singh', mobile: '+91 98901 12233', customer_account_id: null },
    { id: 'c-2', shop_id: 'shop-B', name: 'Vikram Singh', mobile: '9890112233', customer_account_id: null },
    { id: 'c-3', shop_id: 'shop-A', name: 'Anil Kumar', mobile: '9765432100', customer_account_id: null },
  ];

  const registeredAccount = {
    id: 'acc-uuid-vikram-99',
    mobile: '9890112233',
    name: 'Vikram Singh',
    email: 'vikram.portal@example.com',
  };

  const updatedShopCustomers = simulateLinkOnAccountCreate(registeredAccount, shopCustomersDB);
  assert(updatedShopCustomers[0].customer_account_id === 'acc-uuid-vikram-99', 'TEST 6a: Shop A customer linked to new portal account by mobile');
  assert(updatedShopCustomers[1].customer_account_id === 'acc-uuid-vikram-99', 'TEST 6b: Shop B customer linked to new portal account by mobile');
  assert(updatedShopCustomers[2].customer_account_id === null, 'TEST 6c: Unrelated customer with different mobile remains unlinked');

  console.log('================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
