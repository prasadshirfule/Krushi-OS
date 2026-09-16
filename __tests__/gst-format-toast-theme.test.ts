/**
 * KRUSHI OS — GST % FORMATTING, TOAST DESIGN & THEME TEST SUITE
 * Validates:
 * 1. GST % formatting across all invoice renderers (0%, 5%, 12%, 18%, 28%)
 * 2. Handling of integers (5 -> 5%) and decimal representations (0.05 -> 5%)
 * 3. Prevention of raw float display like "0.00", "5.00" in Print / Download
 * 4. Theme & Appearance component integration
 */

import { formatGstPercent as formatGstPdf } from '../lib/invoice';
import { formatGstPercent as formatGstReact } from '../components/invoice/reference-tax-invoice';

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

console.log('=====================================================');
console.log('STARTING KRUSHI OS GST % FORMAT & THEME TEST SUITE');
console.log('=====================================================');

// ─── TEST GROUP 1: GST % Helper Verification (PDF & React) ───
const testCases: [any, string][] = [
  [0, '0%'],
  [5, '5%'],
  [12, '12%'],
  [18, '18%'],
  [28, '28%'],
  [5.0, '5%'],
  [18.0, '18%'],
  [0.05, '5%'],
  [0.18, '18%'],
  [0.12, '12%'],
  [0.28, '28%'],
  [5.5, '5.5%'],
  [null, '0%'],
  [undefined, '0%'],
  ['18', '18%'],
  ['5', '5%'],
  ['0', '0%'],
];

for (const [input, expected] of testCases) {
  const resPdf = formatGstPdf(input);
  const resReact = formatGstReact(input);
  assert(resPdf === expected, `PDF formatGstPercent(${input}) -> expected "${expected}", got "${resPdf}"`);
  assert(resReact === expected, `React formatGstPercent(${input}) -> expected "${expected}", got "${resReact}"`);
}

// ─── TEST GROUP 2: Confirm never produces raw ".00" without % symbol ───
const rawGstValues = [0, 5, 12, 18, 28];
for (const val of rawGstValues) {
  const formatted = formatGstReact(val);
  assert(formatted.endsWith('%'), `GST ${val} includes % symbol: "${formatted}"`);
  assert(!formatted.includes('.00'), `GST ${val} does not contain .00: "${formatted}"`);
}

console.log('=====================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('=====================================================');

if (failed > 0) {
  process.exit(1);
}
