import assert from 'node:assert';
import { checkRateLimit, resetRateLimit } from '../../lib/security/rate-limiter';

console.log('================================================================');
console.log('🧪 KRUSHI OS — DISTRIBUTED RATE LIMITER TESTS');
console.log('================================================================\n');

resetRateLimit();

console.log('--- TEST 1: Sliding Window Counter Increment ---');
const id1 = 'test-client-ip-1';

const r1 = await checkRateLimit(id1, { windowMs: 10000, maxRequests: 3 });
assert.strictEqual(r1.success, true, 'Request 1 is allowed');
assert.strictEqual(r1.remaining, 2, '2 remaining requests');

const r2 = await checkRateLimit(id1, { windowMs: 10000, maxRequests: 3 });
assert.strictEqual(r2.success, true, 'Request 2 is allowed');
assert.strictEqual(r2.remaining, 1, '1 remaining request');

const r3 = await checkRateLimit(id1, { windowMs: 10000, maxRequests: 3 });
assert.strictEqual(r3.success, true, 'Request 3 is allowed');
assert.strictEqual(r3.remaining, 0, '0 remaining requests');

const r4 = await checkRateLimit(id1, { windowMs: 10000, maxRequests: 3 });
assert.strictEqual(r4.success, false, 'Request 4 is blocked (rate limit exceeded)');
assert.strictEqual(r4.remaining, 0, '0 remaining after limit exceeded');
console.log('✓ 1.1 In-memory rate limiter strictly bounds burst requests to max limit');

console.log('\n--- TEST 2: Tenant & Client IP Isolation ---');
const id2 = 'test-client-ip-2';
const rOther = await checkRateLimit(id2, { windowMs: 10000, maxRequests: 3 });
assert.strictEqual(rOther.success, true, 'Different IP is unaffected by blocked IP');
assert.strictEqual(rOther.remaining, 2, 'Different IP starts with its own quota');
console.log('✓ 2.1 Partition isolation verified between different client identifiers');

console.log('\n--- TEST 3: Rate Limiter Reset ---');
resetRateLimit(id1);
const rAfterReset = await checkRateLimit(id1, { windowMs: 10000, maxRequests: 3 });
assert.strictEqual(rAfterReset.success, true, 'Resetting identifier restores capacity');
assert.strictEqual(rAfterReset.remaining, 2, 'Fresh quota available after reset');
console.log('✓ 3.1 Rate limit counter reset verified');

console.log('\n================================================================');
console.log('🎉 ALL RATE LIMITER TESTS PASSED SUCCESSFULLY!');
console.log('================================================================');
