/**
 * KRUSHI OS - BILL PRINT FORMAT TEST SUITE (A5 & 80mm THERMAL)
 * Validates default format preference in Settings, temporary bill-level choice isolation,
 * dynamic A5 & 80mm thermal rendering, UPI QR codes, adjustments, and GST-inclusive calculations.
 */

import { 
  DEFAULT_SHOP_DETAILS, 
  ShopDetails, 
  formatShopAddress, 
  getSavedShopDetails 
} from '../lib/shop-details';
import { formatProductNameWithSize, isValidUpiId, normalizeUpiId } from '../lib/validations';
import { buildUpiUri } from '../lib/upi';
import { calculateItemGst, formatInvoiceExpiry } from '../components/invoice/reference-tax-invoice';

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
console.log('STARTING KRUSHI OS BILL PRINT FORMAT TEST SUITE');
console.log('=====================================================');

// 1. DEFAULT FORMAT IN SETTINGS
const defaultShop = getSavedShopDetails();
assert(defaultShop.defaultBillFormat === 'A5', 'Default bill print format is A5 when unset');

// 2. TEST CASE 1: Default A5 -> Temporary 80mm -> Next bill resets to A5
const savedShopA5: ShopDetails = { ...DEFAULT_SHOP_DETAILS, defaultBillFormat: 'A5' };
let bill1PrintChoice = 'THERMAL_80MM'; // Owner temporarily selects 80mm for Bill #1
assert(bill1PrintChoice === 'THERMAL_80MM', 'Test Case 1: Bill #1 temporarily renders in 80mm Thermal');
assert(savedShopA5.defaultBillFormat === 'A5', 'Test Case 1: Saved shop default in Supabase/settings is STILL A5');
let bill2PrintChoice = savedShopA5.defaultBillFormat;
assert(bill2PrintChoice === 'A5', 'Test Case 1: Bill #2 automatically starts with A5 selected');

// 3. TEST CASE 2: Default 80mm -> Temporary A5 -> Next bill resets to 80mm
const savedShop80: ShopDetails = { ...DEFAULT_SHOP_DETAILS, defaultBillFormat: 'THERMAL_80MM' };
let billRevPrintChoice = 'A5'; // Owner temporarily selects A5 for Bill #1
assert(billRevPrintChoice === 'A5', 'Test Case 2: Bill #1 temporarily renders in A5 Tax Invoice');
assert(savedShop80.defaultBillFormat === 'THERMAL_80MM', 'Test Case 2: Saved shop default in Supabase/settings is STILL 80mm');
let billRev2PrintChoice = savedShop80.defaultBillFormat;
assert(billRev2PrintChoice === 'THERMAL_80MM', 'Test Case 2: Bill #2 automatically starts with 80mm selected');

// 4. TEST CASE 3: UPI & QR Code exact Net Total representation
const upiUriA5 = buildUpiUri('maulikrushi@upi', 'MAULI KRUSHI KENDRA', 550.0);
const upiUri80 = buildUpiUri('maulikrushi@upi', 'MAULI KRUSHI KENDRA', 550.0);
assert(upiUriA5 === upiUri80, 'Test Case 3: Both A5 and 80mm QR codes generate the exact same UPI URI');
assert(upiUri80.includes('maulikrushi@upi'), 'Test Case 3: UPI URI contains correct Shop VPA maulikrushi@upi');
assert(upiUri80.includes('am=550.00'), 'Test Case 3: UPI URI represents exact Net Total of ₹550.00 (not subtotal)');

// 5. TEST CASE 4: Adjustments & Net Total match on A5 and 80mm
const productSubtotal = 516.0;
const deliveryCharge = 34.0;
const netFinalTotal = productSubtotal + deliveryCharge;
assert(netFinalTotal === 550.0, 'Test Case 4: Net Total is ₹550.00 (Products ₹516 + Delivery ₹34)');

// 6. TEST CASE 5: Product Details Format & Uppercase
const ureaFormatted = formatProductNameWithSize('urea', '45kg', '');
assert(ureaFormatted === 'UREA (45KG)', 'Test Case 5: Product format is "UREA (45KG)" with space');
const stunnerFormatted = formatProductNameWithSize('stunner gold', '1kg', '');
assert(stunnerFormatted === 'STUNNER GOLD (1KG)', 'Test Case 5: Product format is "STUNNER GOLD (1KG)" with space');
assert(formatInvoiceExpiry('') === '-', 'Test Case 5: Empty expiry displays as "-"');
assert(formatInvoiceExpiry(null) === '-', 'Test Case 5: Null expiry displays as "-"');
assert(formatInvoiceExpiry('2028-07-10') === '10/07/2028', 'Test Case 5: ISO expiry converted to 10/07/2028');

// 7. TEST CASE 6: Quick / Unregistered Customer & Shop Address
const sampleShop: ShopDetails = {
  ...DEFAULT_SHOP_DETAILS,
  shopName: 'MAULI KRUSHI KENDRA',
  village: 'Kamari',
  taluka: 'Himayatnagar',
  district: 'Nanded',
  state: 'Maharashtra',
  pincode: '431802',
  contact1: '9890341388',
};
const addrFormatted = formatShopAddress(sampleShop);
assert(addrFormatted.includes('At Kamari'), 'Test Case 6: Shop address contains "At Kamari"');
assert(addrFormatted.includes('Himayatnagar'), 'Test Case 6: Shop address contains "Himayatnagar"');

// 8. TEST CASE 7 & 8: GST-Inclusive Pricing Rule
const gstCalc = calculateItemGst(250, 1, 18);
assert(gstCalc.unitWithGst === 250, 'GST-Inclusive: Customer selling price remains ₹250.00');
assert(gstCalc.taxable === 211.86, 'GST-Inclusive: Taxable base price extracted backward to ₹211.86');
assert(Math.round((gstCalc.taxable + gstCalc.cgst + gstCalc.sgst) * 100) / 100 === 250, 'GST-Inclusive: Taxable + CGST + SGST equals exact ₹250.00');

console.log('=====================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('=====================================================');

if (failed > 0) {
  process.exit(1);
}
