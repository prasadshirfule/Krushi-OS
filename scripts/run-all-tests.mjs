import path from 'node:path';
import { fileURLToPath } from 'node:url';
import createJiti from 'jiti';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const jiti = createJiti(import.meta.url, {
  alias: {
    '@': rootDir,
  },
});

const testSuites = [
  '__tests__/security/tenant-isolation.test.ts',
  '__tests__/security/rbac-auth.test.ts',
  '__tests__/security/rate-limiter.test.ts',
  '__tests__/security/document-token.test.ts',
  '__tests__/sms/sms-queue-lifecycle.test.ts',
  '__tests__/sms/msg91-payload.test.ts',
  '__tests__/sms/queue-worker.test.ts',
  '__tests__/invoice/combined-statement.test.ts',
  '__tests__/invoice/ledger-reconciliation.test.ts',
  '__tests__/subscriptions/subscription-lifecycle.test.ts',
  '__tests__/subscriptions/enforcement.test.ts',
  '__tests__/compliance/legal-pages.test.ts',
  '__tests__/scanner/ocr-parser.test.ts',
  '__tests__/scanner/barcode-parser.test.ts',
  '__tests__/scanner/gs1-parser.test.ts',
  '__tests__/scanner/billing-scanner.test.ts',
  '__tests__/scanner/product-autofill-matching.test.ts',
  '__tests__/scanner/size-normalizer.test.ts',
];

console.log('================================================================');
console.log('🚀 KRUSHI OS — AUTOMATED TEST RUNNER (ALL SUITES)');
console.log('================================================================\n');

let passedCount = 0;
let failedCount = 0;

for (const suite of testSuites) {
  const suitePath = path.join(rootDir, suite);
  console.log(`\n▶ [START] ${suite}`);
  try {
    await jiti.import(suitePath);
    console.log(`✅ [PASS] ${suite}`);
    passedCount++;
  } catch (error) {
    console.error(`❌ [FAIL] ${suite}:`, error);
    failedCount++;
  }
}

console.log('\n================================================================');
console.log(`📊 TEST RUN SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED out of ${testSuites.length}`);
console.log('================================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
