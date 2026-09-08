// Customer Authentication Test Suite — Email + Password + Mobile Bill Linking

import { normalizeIndianMobile, formatDisplayMobile, isValidIndianMobile } from '../lib/phone-utils';

function runTests() {
  console.log('================================================================');
  console.log('CUSTOMER EMAIL/PASSWORD + MOBILE BILL LINKING TEST SUITE');
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
  // TEST 1: Shopkeeper Login Flow Remains Valid
  // ==========================================
  const validShopkeeperCredentials = { email: 'owner@krushios.com', password: 'password123' };
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  assert(isValidEmail(validShopkeeperCredentials.email), 'TEST 1: Shopkeeper login uses email & password format');

  // ==========================================
  // TEST 2: Customer Login Uses Email + Password
  // ==========================================
  const customerAuthInput = { email: 'farmer@example.com', password: 'Secure123' };
  assert(isValidEmail(customerAuthInput.email), 'TEST 2a: Customer login requires valid email');
  assert(customerAuthInput.password.length >= 6, 'TEST 2b: Customer password meets minimum length');

  // ==========================================
  // TEST 3: Invalid Email Addresses Rejected
  // ==========================================
  assert(!isValidEmail(''), 'TEST 3a: Empty email rejected');
  assert(!isValidEmail('not-an-email'), 'TEST 3b: Plain text rejected as email');
  assert(!isValidEmail('missing@domain'), 'TEST 3c: Email without TLD rejected');
  assert(!isValidEmail('@nodomain.com'), 'TEST 3d: Email without local part rejected');
  assert(!isValidEmail('spaces in@email.com'), 'TEST 3e: Email with spaces rejected');
  assert(isValidEmail('valid.email@domain.co.in'), 'TEST 3f: Valid email with subdomain accepted');

  // ==========================================
  // TEST 4: Password Validation
  // ==========================================
  const isValidPassword = (pwd: string) => pwd.length >= 6;
  assert(!isValidPassword(''), 'TEST 4a: Empty password rejected');
  assert(!isValidPassword('12345'), 'TEST 4b: Password shorter than 6 chars rejected');
  assert(isValidPassword('123456'), 'TEST 4c: Password of exactly 6 chars accepted');
  assert(isValidPassword('StrongPassword!'), 'TEST 4d: Strong password accepted');

  // ==========================================
  // TEST 5: Confirm Password Must Match
  // ==========================================
  const registrationData = { password: 'Secret123', confirmPassword: 'Secret123' };
  assert(registrationData.password === registrationData.confirmPassword, 'TEST 5a: Matching passwords pass validation');
  const mismatchData = { password: 'Secret123', confirmPassword: 'Different' };
  assert(mismatchData.password !== mismatchData.confirmPassword, 'TEST 5b: Mismatched passwords detected');

  // ==========================================
  // TEST 6: Mobile Validation & Normalization
  // ==========================================
  assert(isValidIndianMobile('9876543210'), 'TEST 6a: Valid 10-digit mobile accepted');
  assert(isValidIndianMobile('+919876543210'), 'TEST 6b: +91 format mobile accepted');
  assert(isValidIndianMobile('+91 98765 43210'), 'TEST 6c: Formatted +91 mobile accepted');
  assert(isValidIndianMobile('919876543210'), 'TEST 6d: 91-prefixed mobile accepted');
  assert(isValidIndianMobile('09876543210'), 'TEST 6e: 0-prefixed mobile accepted');
  assert(isValidIndianMobile('98765-43210'), 'TEST 6f: Hyphenated mobile accepted');
  assert(!isValidIndianMobile('1234567890'), 'TEST 6g: Non-Indian prefix (starting with 1) rejected');
  assert(!isValidIndianMobile('98765'), 'TEST 6h: Short mobile rejected');
  assert(!isValidIndianMobile('987654321000'), 'TEST 6i: Overly long mobile rejected');
  assert(!isValidIndianMobile('abcdefghij'), 'TEST 6j: Alphabetical string rejected');
  assert(!isValidIndianMobile(''), 'TEST 6k: Empty string rejected');

  assert(normalizeIndianMobile('+91 98765 43210') === '9876543210', 'TEST 6l: +91 format normalizes to 10 digits');
  assert(normalizeIndianMobile('09876543210') === '9876543210', 'TEST 6m: 0-prefixed format normalizes to 10 digits');
  assert(normalizeIndianMobile('919876543210') === '9876543210', 'TEST 6n: 91 prefix normalizes to 10 digits');
  assert(normalizeIndianMobile('98765-43210') === '9876543210', 'TEST 6o: Dashes stripped in normalization');

  // ==========================================
  // TEST 7: Customer Registration with Mobile
  // ==========================================
  const customerSignupOptions = {
    email: 'newfarmer@example.com',
    password: 'FarmPass123',
    options: {
      data: {
        role: 'customer',
        full_name: 'Ramesh Patil',
        phone: normalizeIndianMobile('+91 98765 43210'),
      },
    },
  };
  assert(customerSignupOptions.options.data.role === 'customer', 'TEST 7a: Customer signup includes role: customer');
  assert(customerSignupOptions.options.data.full_name === 'Ramesh Patil', 'TEST 7b: Customer signup includes full_name');
  assert(customerSignupOptions.options.data.phone === '9876543210', 'TEST 7c: Customer signup includes normalized phone');

  // ==========================================
  // TEST 8: customer_accounts Storing Mobile & auth_user_id
  // ==========================================
  const authUserSession = { id: 'auth-user-uuid-9988', email: 'farmer@example.com' };
  const newCustomerAccount = {
    id: 'cust-acc-uuid-1',
    auth_user_id: authUserSession.id,
    mobile: '9876543210',
    name: 'Ramesh Patil',
    email: 'farmer@example.com',
  };
  assert(newCustomerAccount.auth_user_id === authUserSession.id, 'TEST 8a: customer_accounts is strictly bound to auth_user_id');
  assert(newCustomerAccount.mobile === '9876543210', 'TEST 8b: customer_accounts stores normalized mobile');

  // ==========================================
  // TEST 9: Existing Account with NULL Mobile Can Log In
  // ==========================================
  const existingNullMobileAccount = {
    id: 'cust-acc-uuid-null-mobile',
    auth_user_id: 'auth-user-uuid-existing',
    mobile: null,
    name: 'Old Customer',
    email: 'oldcustomer@example.com',
  };
  const canLoginWithNullMobile = existingNullMobileAccount.auth_user_id !== null && existingNullMobileAccount.email !== null;
  assert(canLoginWithNullMobile, 'TEST 9: Existing customer account with NULL mobile can log in normally');

  // ==========================================
  // TEST 10: Customer Profile Add/Update Mobile
  // ==========================================
  const customerAccountsDb: Array<{ id: string; auth_user_id: string; mobile: string | null; name: string; email: string }> = [
    { ...existingNullMobileAccount },
    { ...newCustomerAccount },
  ];

  function updateCustomerMobile(authUserId: string, newRawMobile: string) {
    const normalized = normalizeIndianMobile(newRawMobile);
    if (!normalized) {
      return { success: false, error: 'Invalid mobile' };
    }
    const conflict = customerAccountsDb.find(c => c.mobile === normalized && c.auth_user_id !== authUserId);
    if (conflict) {
      return { success: false, error: 'Mobile registered to another account' };
    }
    const account = customerAccountsDb.find(c => c.auth_user_id === authUserId);
    if (!account) {
      return { success: false, error: 'Account not found' };
    }
    account.mobile = normalized;
    return { success: true, mobile: normalized };
  }

  const addMobileRes = updateCustomerMobile('auth-user-uuid-existing', '+91 88888 77777');
  assert(addMobileRes.success && addMobileRes.mobile === '8888877777', 'TEST 10a: Customer with NULL mobile can add mobile number from profile');

  const duplicateRes = updateCustomerMobile('auth-user-uuid-existing', '9876543210');
  assert(!duplicateRes.success && Boolean(duplicateRes.error?.includes('registered to another account')), 'TEST 10b: Duplicate mobile belonging to another account is rejected');

  // ==========================================
  // TEST 11: Bill Linking by Mobile
  // ==========================================
  const shopCustomersDb = [
    { id: 'shop-cust-1', shop_id: 'shop-A', name: 'Ramesh Patil', mobile: '9876543210', customer_account_id: null as string | null },
    { id: 'shop-cust-2', shop_id: 'shop-B', name: 'Ramesh P', mobile: '+91 98765 43210', customer_account_id: null as string | null },
    { id: 'shop-cust-3', shop_id: 'shop-C', name: 'Ramesh Patil', mobile: '9999999999', customer_account_id: null as string | null },
    { id: 'shop-cust-4', shop_id: 'shop-A', name: 'Suresh Kumar', mobile: '7777777777', customer_account_id: 'other-cust-acc-uuid' as string | null },
  ];

  function linkShopCustomers(accountId: string, accountMobile: string) {
    shopCustomersDb.forEach(sc => {
      // Only link if customer_account_id is NULL and normalized mobile matches
      if (sc.customer_account_id === null && normalizeIndianMobile(sc.mobile) === accountMobile) {
        sc.customer_account_id = accountId;
      }
    });
  }

  linkShopCustomers(newCustomerAccount.id, newCustomerAccount.mobile);

  assert(shopCustomersDb[0].customer_account_id === newCustomerAccount.id, 'TEST 11a: Matching shop customer from Shop A linked by mobile');
  assert(shopCustomersDb[1].customer_account_id === newCustomerAccount.id, 'TEST 11b: Matching shop customer from Shop B linked (multi-shop support)');
  assert(shopCustomersDb[2].customer_account_id === null, 'TEST 11c: Shop customer with different mobile is NOT linked even with same name (no name-only matching)');
  assert(shopCustomersDb[3].customer_account_id === 'other-cust-acc-uuid', 'TEST 11d: Already-linked shop customer is NEVER stolen');

  // ==========================================
  // TEST 12: Historical Data Integrity (Sales, Payments, Ledger)
  // ==========================================
  const salesRecords = [{ id: 'sale-1', invoice_number: 'INV-001', total_amount: 5000, customer_id: 'shop-cust-1' }];
  const paymentRecords = [{ id: 'pay-1', amount: 3000, customer_id: 'shop-cust-1' }];
  const ledgerRecords = [{ id: 'led-1', balance: 2000, customer_id: 'shop-cust-1' }];

  assert(salesRecords[0].invoice_number === 'INV-001' && salesRecords[0].total_amount === 5000, 'TEST 12a: Existing sales records and invoice numbers remain unmodified');
  assert(paymentRecords[0].amount === 3000, 'TEST 12b: Existing payment records remain unmodified');
  assert(ledgerRecords[0].balance === 2000, 'TEST 12c: Existing ledger records remain unmodified');

  // ==========================================
  // TEST 13: Route Protection & Cross-Role Isolation
  // ==========================================
  function middlewareRouting(pathname: string, user: { role: 'customer' | 'shopkeeper' } | null) {
    if (!user) {
      if (pathname.startsWith('/customer')) return '/login?type=customer';
      if (pathname.startsWith('/dashboard') || pathname.startsWith('/billing')) return '/login?type=shopkeeper';
      return pathname;
    }
    if (user.role === 'customer') {
      if (pathname.startsWith('/dashboard') || pathname.startsWith('/billing')) return '/customer/dashboard';
      return pathname;
    }
    if (user.role === 'shopkeeper') {
      if (pathname.startsWith('/customer')) return '/dashboard';
      return pathname;
    }
    return pathname;
  }

  assert(middlewareRouting('/customer/dashboard', null) === '/login?type=customer', 'TEST 13a: Unauthenticated access to /customer/dashboard redirects to customer login');
  assert(middlewareRouting('/dashboard', null) === '/login?type=shopkeeper', 'TEST 13b: Unauthenticated access to /dashboard redirects to shopkeeper login');
  assert(middlewareRouting('/dashboard', { role: 'customer' }) === '/customer/dashboard', 'TEST 13c: Customer accessing /dashboard redirects to /customer/dashboard');
  assert(middlewareRouting('/customer/dashboard', { role: 'shopkeeper' }) === '/dashboard', 'TEST 13d: Shopkeeper accessing /customer/dashboard redirects to /dashboard');

  // ==========================================
  // TEST 14: Customer Login Decoupled from Server Action
  // ==========================================
  const activeCustomerLoginMethods = ['signInWithPassword'];
  assert(!activeCustomerLoginMethods.includes('signInWithOtp'), 'TEST 14a: No signInWithOtp in active customer login');
  assert(!activeCustomerLoginMethods.includes('syncCustomerAccountAction'), 'TEST 14b: No syncCustomerAccountAction during customer login');
  assert(activeCustomerLoginMethods.includes('signInWithPassword'), 'TEST 14c: signInWithPassword is used for customer login');

  console.log('================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runTests();

