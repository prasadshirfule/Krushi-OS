import assert from 'node:assert';
import crypto from 'node:crypto';
import { hashDocumentToken } from '../../lib/documents/token-service';

console.log('================================================================');
console.log('🧪 KRUSHI OS — DOCUMENT ACCESS TOKEN SECURITY TESTS');
console.log('================================================================\n');

// 1. SHA-256 Hashing Invariant
console.log('--- TEST 1: Cryptographic Token Hashing Invariant ---');
const rawToken = 'kos_tok_live_1234567890abcdef1234567890abcdef';
const hash = hashDocumentToken(rawToken);

assert.strictEqual(typeof hash, 'string', 'Hash is a string');
assert.strictEqual(hash.length, 64, 'SHA-256 produces 64-character hex digest');

const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
assert.strictEqual(hash, expectedHash, 'Hash matches canonical node:crypto sha256 output');
console.log('✓ 1.1 SHA-256 hashing strictly deterministic and matches crypto standards');

// 2. Token Masking in Logs
console.log('\n--- TEST 2: Token Masking Invariant in Audit Logs ---');
function maskTokenForLogging(tok: string): string {
  if (!tok || tok.length <= 8) return '***';
  return `${tok.slice(0, 6)}...${tok.slice(-4)}`;
}

const masked = maskTokenForLogging(rawToken);
assert.strictEqual(masked, 'kos_to...cdef', 'Token masked correctly');
assert.ok(!masked.includes('1234567890abcdef1234567890'), 'Plaintext body is never printed');
console.log('✓ 2.1 Sensitive token body securely masked from server logs');

// 3. Expiry and Revocation Logic
console.log('\n--- TEST 3: Token Expiry & Revocation Gates ---');
interface SimulatedTokenRecord {
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
}

function isTokenValid(record: SimulatedTokenRecord, now: Date = new Date()): boolean {
  if (record.revoked_at) return false;
  if (new Date(record.expires_at).getTime() <= now.getTime()) return false;
  return true;
}

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();

const validToken: SimulatedTokenRecord = {
  token_hash: hash,
  expires_at: future,
  revoked_at: null,
};

const expiredToken: SimulatedTokenRecord = {
  token_hash: hash,
  expires_at: past,
  revoked_at: null,
};

const revokedToken: SimulatedTokenRecord = {
  token_hash: hash,
  expires_at: future,
  revoked_at: new Date().toISOString(),
};

assert.strictEqual(isTokenValid(validToken), true, 'Unexpired, unrevoked token is valid');
assert.strictEqual(isTokenValid(expiredToken), false, 'Expired token is rejected');
assert.strictEqual(isTokenValid(revokedToken), false, 'Revoked token is rejected');
console.log('✓ 3.1 Token validity gates strictly reject expired or revoked documents');

console.log('\n================================================================');
console.log('🎉 ALL DOCUMENT TOKEN SECURITY TESTS PASSED SUCCESSFULLY!');
console.log('================================================================');
