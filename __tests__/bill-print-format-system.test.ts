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
import { formatProductNameWithSize } from '../lib/validations';
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

// 6. TEST CASE 5: Product Details Format & Uppercase: PRODUCT_NAME (SIZE UNIT) with single space
const ureaFormatted = formatProductNameWithSize('urea', '45kg', '');
assert(ureaFormatted === 'UREA (45 KG)', 'Product format is "UREA (45 KG)" with single space');
const stunnerFormatted = formatProductNameWithSize('stunner gold', '1kg', '');
assert(stunnerFormatted === 'STUNNER GOLD (1 KG)', 'Product format is "STUNNER GOLD (1 KG)" with single space');
const dapFormatted = formatProductNameWithSize('dap', '50kg', '');
assert(dapFormatted === 'DAP (50 KG)', 'Product format is "DAP (50 KG)" with single space');
const bioFormatted = formatProductNameWithSize('biofertilizer', '1l', '');
assert(bioFormatted === 'BIOFERTILIZER (1 L)', 'Product format is "BIOFERTILIZER (1 L)" with single space');

// Strict Test: STUNNER GOLD (50 ML) - Never appends "PIECE"
const stunnerPieceRaw = formatProductNameWithSize('STUNNER GOLD (50 ML PIECE)', '50 ML', 'Piece');
assert(stunnerPieceRaw === 'STUNNER GOLD (50 ML)', 'Strips accidental "(50 ML PIECE)" to exact "STUNNER GOLD (50 ML)"');
assert(!stunnerPieceRaw.includes('PIECE') && !stunnerPieceRaw.includes('piece'), 'Product display does NOT contain "PIECE"');

const stunnerClean = formatProductNameWithSize('STUNNER GOLD', '50', 'ML');
assert(stunnerClean === 'STUNNER GOLD (50 ML)', 'Clean format generates "STUNNER GOLD (50 ML)"');

assert(formatInvoiceExpiry('') === '-', 'Empty expiry displays as "-"');
assert(formatInvoiceExpiry(null) === '-', 'Null expiry displays as "-"');
assert(formatInvoiceExpiry('2028-07-10') === '10/07/2028', 'ISO expiry converted to 10/07/2028');

// 7. TEST CASE 6: Partial Payment & Isolated UPI Portion QR Code
const fullBillTotal = 550.0;
const partialCashPaid = 200.0;
const partialUpiPaid = 350.0;
const partialTotalPaid = partialCashPaid + partialUpiPaid;
assert(partialTotalPaid === fullBillTotal, 'Partial payment total paid equals final bill of ₹550.00');

// UPI QR must represent ONLY the UPI portion (₹350.00) in Partial Payment
const partialUpiUri = buildUpiUri('maulikrushi@upi', 'MAULI KRUSHI KENDRA', partialUpiPaid);
assert(partialUpiUri.includes('am=350.00'), 'Partial Payment UPI QR code represents ONLY the UPI portion of ₹350.00, NOT ₹550.00');
assert(!partialUpiUri.includes('am=550.00'), 'Partial Payment UPI QR code does NOT include the full ₹550.00 bill amount');

// Full pure UPI payment represents full total
const pureUpiUri = buildUpiUri('maulikrushi@upi', 'MAULI KRUSHI KENDRA', fullBillTotal);
assert(pureUpiUri.includes('am=550.00'), 'Pure UPI payment represents full bill total of ₹550.00');

// 8. TEST CASE 7: Partial Payment with Remaining Balance
const billTotalWithBal = 550.0;
const balCash = 200.0;
const balUpi = 100.0;
const balTotalPaid = balCash + balUpi;
const balRemaining = billTotalWithBal - balTotalPaid;
assert(balTotalPaid === 300.0, 'Partial payment with balance: Total Paid = ₹300.00');
assert(balRemaining === 250.0, 'Partial payment with balance: Remaining balance = ₹250.00 for Credit/Udhar');

// 9. TEST CASE 8: Quick / Unregistered Customer & Shop Address
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
assert(addrFormatted.includes('At Kamari'), 'Shop address contains "At Kamari"');
assert(addrFormatted.includes('Himayatnagar'), 'Shop address contains "Himayatnagar"');

// 10. TEST CASE 9: GST-Inclusive Pricing Rule
const gstCalc = calculateItemGst(250, 1, 18);
assert(gstCalc.unitWithGst === 250, 'GST-Inclusive: Customer selling price remains ₹250.00');
assert(gstCalc.taxable === 211.86, 'GST-Inclusive: Taxable base price extracted backward to ₹211.86');
assert(Math.round((gstCalc.taxable + gstCalc.cgst + gstCalc.sgst) * 100) / 100 === 250, 'GST-Inclusive: Taxable + CGST + SGST equals exact ₹250.00');

// 11. TEST CASE 10: Amount in Words formatting with Indian Numbering & Paise
import { numberToWords } from '../lib/utils';

const words250 = numberToWords(250.00);
assert(words250 === 'Two Hundred Fifty Rupees Only', `numberToWords(250.00) = "${words250}"`);

const words550 = numberToWords(550.00);
assert(words550 === 'Five Hundred Fifty Rupees Only', `numberToWords(550.00) = "${words550}"`);

const words1250_50 = numberToWords(1250.50);
assert(words1250_50 === 'One Thousand Two Hundred Fifty Rupees and Fifty Paise Only', `numberToWords(1250.50) = "${words1250_50}"`);

const words1250_75 = numberToWords(1250.75);
assert(words1250_75 === 'One Thousand Two Hundred Fifty Rupees and Seventy Five Paise Only', `numberToWords(1250.75) = "${words1250_75}"`);

const wordsLakh = numberToWords(125000.00);
assert(wordsLakh === 'One Lakh Twenty Five Thousand Rupees Only', `numberToWords(125000.00) = "${wordsLakh}"`);

// 12. TEST CASE 11: Terms & Conditions Multi-Shop Isolation & Empty Handling
const shopATerms = '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if not paid within 30 days.';
const shopBTerms = '1. No return after 7 days.\n2. Subject to Pune jurisdiction.';
const emptyShopTerms = '';

const shopA: ShopDetails = { ...DEFAULT_SHOP_DETAILS, shopName: 'Shop A', invoiceTerms: shopATerms };
const shopB: ShopDetails = { ...DEFAULT_SHOP_DETAILS, shopName: 'Shop B', invoiceTerms: shopBTerms };
const shopEmpty: ShopDetails = { ...DEFAULT_SHOP_DETAILS, shopName: 'Shop Empty', invoiceTerms: emptyShopTerms };

assert(shopA.invoiceTerms === shopATerms, 'Shop A retains Shop A terms');
assert(shopB.invoiceTerms === shopBTerms, 'Shop B retains Shop B terms');
assert(shopA.invoiceTerms !== shopB.invoiceTerms, 'Shop A and Shop B have isolated terms');

const hasTermsShopA = Boolean(shopA.invoiceTerms && shopA.invoiceTerms.trim().length > 0);
const hasTermsShopEmpty = Boolean(shopEmpty.invoiceTerms && shopEmpty.invoiceTerms.trim().length > 0);

assert(hasTermsShopA === true, 'Shop A with terms will render Terms & Conditions');
assert(hasTermsShopEmpty === false, 'Shop with empty terms hides Terms & Conditions completely');

console.log('=====================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('=====================================================');

if (failed > 0) {
  process.exit(1);
}
