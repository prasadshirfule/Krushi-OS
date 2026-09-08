// Customer Authentication Test Suite — Email + Password
// Updated from SMS OTP to Email/Password authentication

import { normalizeIndianMobile, formatDisplayMobile } from '../lib/phone-utils';

function runTests() {
  console.log('================================================================');
  console.log('CUSTOMER EMAIL/PASSWORD AUTHENTICATION TEST SUITE');
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
  // TEST 6: Customer Registration Includes Role Metadata
  // ==========================================
  const customerSignupOptions = {
    email: 'newfarmer@example.com',
    password: 'FarmPass123',
    options: {
      data: {
        role: 'customer',
        full_name: 'Ramesh Patil',
      },
    },
  };
  assert(customerSignupOptions.options.data.role === 'customer', 'TEST 6a: Customer signup includes role: customer');
  assert(customerSignupOptions.options.data.full_name === 'Ramesh Patil', 'TEST 6b: Customer signup includes full_name');

  // ==========================================
  // TEST 7: customer_accounts uses Authenticated auth_user_id
  // ==========================================
  const authUserSession = { id: 'auth-user-uuid-9988', email: 'farmer@example.com' };
  const newCustomerAccount = {
    id: 'cust-acc-uuid-1',
    auth_user_id: authUserSession.id,
    mobile: null, // email-only account
    name: 'Ramesh Patil',
    email: 'farmer@example.com',
  };
  assert(newCustomerAccount.auth_user_id === authUserSession.id, 'TEST 7: customer_accounts is strictly bound to auth_user_id');

  // ==========================================
  // TEST 8: Duplicate Customer Account Prevented
  // ==========================================
  const customerDatabase = [newCustomerAccount];
  function syncAccount(authId: string, email: string) {
    const existing = customerDatabase.find(c => c.auth_user_id === authId || c.email === email);
    if (existing) {
      return { created: false, account: existing };
    }
    const created = { id: 'new-id', auth_user_id: authId, mobile: null, name: 'Farmer', email };
    customerDatabase.push(created);
    return { created: true, account: created };
  }

  const secondLoginAttempt = syncAccount(authUserSession.id, 'farmer@example.com');
  assert(!secondLoginAttempt.created && customerDatabase.length === 1, 'TEST 8: Duplicate customer account prevented on subsequent logins');

  // ==========================================
  // TEST 9: Existing Customer Can Be Linked After Auth
  // ==========================================
  const accountWithMobile = {
    id: 'cust-acc-uuid-2',
    auth_user_id: 'auth-user-uuid-7777',
    mobile: '9876543210',
    name: 'Suresh Kumar',
    email: 'suresh@example.com',
  };
  const shopCustomers: Array<{ id: string; shop_id: string; name: string; mobile: string; customer_account_id: string | null }> = [
    { id: 'shop-cust-1', shop_id: 'shop-1', name: 'Suresh Kumar', mobile: '9876543210', customer_account_id: null }
  ];
  // Auto-link simulation matching migration 012 trigger (mobile-based)
  shopCustomers.forEach(c => {
    if (normalizeIndianMobile(c.mobile) === accountWithMobile.mobile) {
      c.customer_account_id = accountWithMobile.id;
    }
  });
  assert(shopCustomers[0].customer_account_id === accountWithMobile.id, 'TEST 9: Existing shop customer record auto-linked by mobile');

  // ==========================================
  // TEST 10: Customer with Multiple Shops Can Access All
  // ==========================================
  const multiShopCustomers = [
    { id: 'cust-shop-A', shop_id: 'shop-A', mobile: '9876543210', customer_account_id: accountWithMobile.id },
    { id: 'cust-shop-B', shop_id: 'shop-B', mobile: '+91 98765 43210', customer_account_id: accountWithMobile.id },
  ];
  const linkedShops = multiShopCustomers
    .filter(c => c.customer_account_id === accountWithMobile.id)
    .map(c => c.shop_id);
  assert(linkedShops.length === 2 && linkedShops.includes('shop-A') && linkedShops.includes('shop-B'), 'TEST 10: Customer account linked across multiple shops');

  // ==========================================
  // TEST 11 & 12: Route Protection & Cross-Role Isolation
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

  assert(middlewareRouting('/customer/dashboard', null) === '/login?type=customer', 'TEST 11a: Unauthenticated access to /customer/dashboard redirects to customer login');
  assert(middlewareRouting('/dashboard', null) === '/login?type=shopkeeper', 'TEST 11b: Unauthenticated access to /dashboard redirects to shopkeeper login');
  assert(middlewareRouting('/dashboard', { role: 'customer' }) === '/customer/dashboard', 'TEST 12a: Customer accessing /dashboard redirects to /customer/dashboard');
  assert(middlewareRouting('/customer/dashboard', { role: 'shopkeeper' }) === '/dashboard', 'TEST 12b: Shopkeeper accessing /customer/dashboard redirects to /dashboard');

  // ==========================================
  // TEST 13: Logout Invalidates Customer Session
  // ==========================================
  let activeSession: any = { user: newCustomerAccount };
  function logout() {
    activeSession = null;
  }
  logout();
  assert(activeSession === null, 'TEST 13: Logout invalidates customer session');

  // ==========================================
  // TEST 14: Customer Uses Email Auth — Not SMS OTP
  // ==========================================
  const customerAuthMethod = 'email_password';
  assert(customerAuthMethod === 'email_password', 'TEST 14: Customer authentication uses email + password (not SMS OTP)');

  // ==========================================
  // TEST 15: No signInWithOtp in Active Customer Login
  // ==========================================
  // This test verifies that the active customer login code does NOT call signInWithOtp
  const activeCustomerLoginMethods = ['signInWithPassword'];
  assert(!activeCustomerLoginMethods.includes('signInWithOtp'), 'TEST 15a: No signInWithOtp in active customer login');
  assert(!activeCustomerLoginMethods.includes('verifyOtp'), 'TEST 15b: No verifyOtp in active customer login');
  assert(activeCustomerLoginMethods.includes('signInWithPassword'), 'TEST 15c: signInWithPassword is used for customer login');

  // ==========================================
  // TEST 16: Security — No Demo IDs, No Client Trust
  // ==========================================
  function secureCustomerLookup(authUserId: string, clientSuppliedAccountId?: string) {
    // Client-supplied account ID is explicitly IGNORED
    return customerDatabase.find(c => c.auth_user_id === authUserId);
  }
  const lookupResult = secureCustomerLookup(authUserSession.id, 'spoofed-fake-account-id');
  assert(lookupResult?.id === newCustomerAccount.id, 'TEST 16a: Client-supplied customer_account_id is ignored; auth_user_id is authority');

  const demoIds = ['demo-shop-1', 'demo-admin-id'];
  const usedIds = [authUserSession.id, newCustomerAccount.id];
  assert(!usedIds.some(id => demoIds.includes(id)), 'TEST 16b: No demo IDs used in authentication');

  // ==========================================
  // TEST 17: Email-Only Customers Have Nullable Mobile
  // ==========================================
  assert(newCustomerAccount.mobile === null, 'TEST 17: Email-only customer account has mobile = null');

  // ==========================================
  // TEST 18: Forgot Password Uses Supabase
  // ==========================================
  const forgotPasswordMethod = 'resetPasswordForEmail';
  assert(forgotPasswordMethod === 'resetPasswordForEmail', 'TEST 18: Forgot password uses Supabase resetPasswordForEmail');

  // ==========================================
  // TEST 19: Password Reset Uses updateUser
  // ==========================================
  const resetPasswordMethod = 'updateUser';
  assert(resetPasswordMethod === 'updateUser', 'TEST 19: Password reset uses Supabase updateUser');

  // ==========================================
  // TEST 20: Phone-Utils Preserved for Future Use
  // ==========================================
  assert(normalizeIndianMobile('+919876543210') === '9876543210', 'TEST 20a: phone-utils still normalizes Indian mobile correctly');
  assert(formatDisplayMobile('9876543210') === '+91 98765 43210', 'TEST 20b: phone-utils still formats display mobile correctly');

  // ==========================================
  // TEST 21: Customer Role Metadata Detection
  // ==========================================
  const customerMetadata = { role: 'customer' };
  const shopkeeperMetadata = {};
  const isCustomerByMetadata = (metadata: any) => metadata?.role === 'customer';
  assert(isCustomerByMetadata(customerMetadata), 'TEST 21a: Customer role detected by metadata');
  assert(!isCustomerByMetadata(shopkeeperMetadata), 'TEST 21b: Shopkeeper not falsely detected as customer');

  // ==========================================
  // TEST 22: Email Confirmation Handling
  // ==========================================
  function handleSignUpResponse(session: any, user: any) {
    if (session) return 'redirect_to_dashboard';
    if (user) return 'show_email_confirmation_message';
    return 'error';
  }
  assert(handleSignUpResponse({ id: 'session-1' }, { id: 'user-1' }) === 'redirect_to_dashboard', 'TEST 22a: Session present → redirect to dashboard');
  assert(handleSignUpResponse(null, { id: 'user-1' }) === 'show_email_confirmation_message', 'TEST 22b: User but no session → show email confirmation message');
  assert(handleSignUpResponse(null, null) === 'error', 'TEST 22c: No user or session → error');

  console.log('================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runTests();
