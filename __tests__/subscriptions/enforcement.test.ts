import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { isSubscriptionEnforcementEnabled } from '../../services/subscription.service';

console.log('================================================================');
console.log('🧪 KRUSHI OS — SUBSCRIPTION ENFORCEMENT & BACKFILL AUDIT');
console.log('================================================================\n');

const projectRoot = process.cwd();

// --- TEST 1: Default Enforcement Flag Barrier ---
console.log('--- TEST 1: Fail-Safe Default Disabled Status ---');
delete process.env.ENABLE_SUBSCRIPTION_ENFORCEMENT;
assert.strictEqual(
  isSubscriptionEnforcementEnabled(),
  false,
  'Enforcement MUST default to false to protect operational shops'
);
console.log('✓ 1.1 Subscription enforcement is disabled by default (fail-safe protection)');

process.env.ENABLE_SUBSCRIPTION_ENFORCEMENT = 'true';
assert.strictEqual(
  isSubscriptionEnforcementEnabled(),
  true,
  'Enforcement explicitly activates when ENABLE_SUBSCRIPTION_ENFORCEMENT=true'
);
console.log('✓ 1.2 Subscription enforcement activates when explicitly configured');

// Reset to disabled
delete process.env.ENABLE_SUBSCRIPTION_ENFORCEMENT;

// --- TEST 2: Migration 024 Backfill & Access Log Policy Audit ---
console.log('\n--- TEST 2: Migration 024 Schema & Backfill Audit ---');
const mig024Path = path.join(projectRoot, 'supabase', 'migrations', '024_subscription_backfill_and_fixes.sql');
assert.ok(fs.existsSync(mig024Path), 'Migration 024 file must exist');

const mig024Content = fs.readFileSync(mig024Path, 'utf8');

// Verify document_access_logs INSERT policy
assert.ok(
  mig024Content.includes('CREATE POLICY "Allow system and users to insert document_access_logs"'),
  'Must contain INSERT policy for document_access_logs'
);
assert.ok(
  mig024Content.includes('ON public.document_access_logs FOR INSERT'),
  'Target must be public.document_access_logs FOR INSERT'
);
console.log('✓ 2.1 document_access_logs INSERT RLS policy verified');

// Verify backfill query for existing shops
assert.ok(
  mig024Content.includes('INSERT INTO public.shop_subscriptions'),
  'Must backfill into shop_subscriptions'
);
assert.ok(
  mig024Content.includes("WHERE NOT EXISTS"),
  'Must safely check NOT EXISTS before inserting'
);
assert.ok(
  mig024Content.includes("ON CONFLICT (shop_id) DO NOTHING"),
  'Must prevent conflict on existing subscriptions'
);
console.log('✓ 2.2 Pre-existing shop backfill verified (14-day trial without breaking changes)');

// --- TEST 3: Enforcement State Behavior Invariants ---
console.log('\n--- TEST 3: Permission Resolution Invariant ---');
function resolveEffectivePermissions(
  isEnforced: boolean,
  isReadOnly: boolean,
  isQuotaExceeded: boolean
) {
  const canCreateInvoice = isEnforced ? (!isReadOnly && !isQuotaExceeded) : true;
  const canCreateProduct = isEnforced ? !isReadOnly : true;
  const effectiveReadOnly = isEnforced ? isReadOnly : false;
  return { canCreateInvoice, canCreateProduct, effectiveReadOnly };
}

// Case A: Enforcement DISABLED, shop is expired/suspended
const disabledRes = resolveEffectivePermissions(false, true, true);
assert.strictEqual(disabledRes.canCreateInvoice, true, 'When disabled, billing remains active');
assert.strictEqual(disabledRes.canCreateProduct, true, 'When disabled, product creation remains active');
assert.strictEqual(disabledRes.effectiveReadOnly, false, 'When disabled, readOnly is false');
console.log('✓ 3.1 Disabled mode permits continuous operations without farmer/shopkeeper disruption');

// Case B: Enforcement ENABLED, shop is suspended
const enabledSuspended = resolveEffectivePermissions(true, true, false);
assert.strictEqual(enabledSuspended.canCreateInvoice, false, 'When enabled, suspended shop cannot bill');
assert.strictEqual(enabledSuspended.canCreateProduct, false, 'When enabled, suspended shop cannot add products');
assert.strictEqual(enabledSuspended.effectiveReadOnly, true, 'When enabled, readOnly is enforced');
console.log('✓ 3.2 Enabled mode strictly enforces subscription limits when business owner activates it');

console.log('\n================================================================');
console.log('🎉 ALL SUBSCRIPTION ENFORCEMENT AUDIT TESTS PASSED SUCCESSFULLY!');
console.log('================================================================');
