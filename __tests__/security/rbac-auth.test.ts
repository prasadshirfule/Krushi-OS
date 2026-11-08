import assert from 'node:assert';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  requirePermission,
  type Permission,
} from '../../lib/permissions';

console.log('================================================================');
console.log('🧪 KRUSHI OS — RBAC & AUTHORIZATION HARDENING AUDIT');
console.log('================================================================\n');

// 1. Roles Definition Audit
console.log('--- TEST 1: Role Definitions & Hierarchy ---');
const expectedRoles = [
  'SuperAdmin',
  'Admin',
  'Manager',
  'Cashier',
  'Sales Staff',
  'InventoryStaff',
  'Accountant',
];

expectedRoles.forEach((role) => {
  assert.ok(
    role in ROLE_PERMISSIONS,
    `Role '${role}' must be defined in ROLE_PERMISSIONS matrix`
  );
  assert.ok(
    Array.isArray(ROLE_PERMISSIONS[role]),
    `Role '${role}' must map to an array of permissions`
  );
});
console.log(`✓ 1.1 All ${expectedRoles.length} enterprise roles defined with permission sets`);

// 2. SuperAdmin & Admin Complete Access
console.log('\n--- TEST 2: SuperAdmin & Admin Privilege Completeness ---');
const allPermsList = Object.values(PERMISSIONS);
assert.strictEqual(
  ROLE_PERMISSIONS.SuperAdmin.length,
  allPermsList.length,
  'SuperAdmin must hold all defined permissions'
);
assert.strictEqual(
  ROLE_PERMISSIONS.Admin.length,
  allPermsList.length,
  'Admin must hold all defined permissions'
);

allPermsList.forEach((perm) => {
  assert.strictEqual(
    hasPermission('SuperAdmin', perm),
    true,
    `SuperAdmin must have ${perm}`
  );
  assert.strictEqual(
    hasPermission('Admin', perm),
    true,
    `Admin must have ${perm}`
  );
});
console.log(`✓ 2.1 SuperAdmin & Admin verified across all ${allPermsList.length} distinct capabilities`);

// 3. Cashier & Operational Staff Least Privilege Bounds
console.log('\n--- TEST 3: Principle of Least Privilege Enforcement ---');

// Cashier should be able to create sales and view inventory, but NEVER modify settings or delete products
assert.strictEqual(hasPermission('Cashier', 'sales.create'), true, 'Cashier must create sales');
assert.strictEqual(hasPermission('Cashier', 'products.view'), true, 'Cashier must view products');
assert.strictEqual(hasPermission('Cashier', 'settings.edit'), false, 'Cashier must NOT edit settings');
assert.strictEqual(hasPermission('Cashier', 'products.delete'), false, 'Cashier must NOT delete products');
assert.strictEqual(hasPermission('Cashier', 'audit.view'), false, 'Cashier must NOT access audit logs');
assert.strictEqual(hasPermission('Cashier', 'subscriptions.manage'), false, 'Cashier must NOT manage subscriptions');
console.log('✓ 3.1 Cashier role strictly confined to billing and checkout');

// Inventory Staff should adjust stock and create purchases, but NOT create retail sales
assert.strictEqual(hasPermission('InventoryStaff', 'inventory.adjust'), true, 'InventoryStaff must adjust stock');
assert.strictEqual(hasPermission('InventoryStaff', 'purchases.create'), true, 'InventoryStaff must create purchases');
assert.strictEqual(hasPermission('InventoryStaff', 'sales.create'), false, 'InventoryStaff must NOT create retail sales');
assert.strictEqual(hasPermission('InventoryStaff', 'settings.edit'), false, 'InventoryStaff must NOT edit settings');
console.log('✓ 3.2 Inventory Staff strictly bounded to warehouse operations');

// Accountant should view financial reports, expenses, and ledgers, but NOT delete products
assert.strictEqual(hasPermission('Accountant', 'reports.view'), true, 'Accountant must view reports');
assert.strictEqual(hasPermission('Accountant', 'expenses.create'), true, 'Accountant must record expenses');
assert.strictEqual(hasPermission('Accountant', 'products.delete'), false, 'Accountant must NOT delete products');
assert.strictEqual(hasPermission('Accountant', 'sales.create'), false, 'Accountant must NOT issue retail sales');
console.log('✓ 3.3 Accountant role strictly segregated to ledger, taxation & reporting');

// 4. Unknown Role & Malformed Inputs
console.log('\n--- TEST 4: Unknown Role Fallbacks & Malformed Input Handling ---');
assert.strictEqual(hasPermission('HackerRole', 'sales.create'), false, 'Unknown role must evaluate to false');
assert.strictEqual(hasPermission('', 'sales.create'), false, 'Empty role string must evaluate to false');
assert.strictEqual(hasPermission('Customer', 'settings.edit'), false, 'Customer must NOT have store admin permissions');
console.log('✓ 4.1 Safe fallback to deny-by-default on unregistered roles');

// 5. requirePermission Guard Assertion
console.log('\n--- TEST 5: requirePermission Exception Traps ---');
assert.doesNotThrow(() => {
  requirePermission('Manager', 'sales.create');
}, 'Manager must not throw for permitted action');

assert.throws(
  () => {
    requirePermission('Cashier', 'settings.edit');
  },
  /Permission denied/,
  'Cashier must throw Permission denied when attempting settings.edit'
);

assert.throws(
  () => {
    requirePermission('UnknownRole', 'products.view');
  },
  /Permission denied/,
  'UnknownRole must throw Permission denied'
);
console.log('✓ 5.1 requirePermission enforces fail-closed exception barrier');

console.log('\n================================================================');
console.log('🎉 ALL RBAC & PERMISSION AUDIT TESTS PASSED SUCCESSFULLY!');
console.log('================================================================\n');
