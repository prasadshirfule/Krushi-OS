import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('================================================================');
console.log('🧪 KRUSHI OS — MOBILE UI/UX VERIFICATION (PRODUCTS & BILLING)');
console.log('================================================================\n');

const projectRoot = process.cwd();

// Helper to read file content
function readSource(relPath: string): string {
  return fs.readFileSync(path.join(projectRoot, relPath), 'utf8');
}

// ─────────────────────────────────────────────────────────────
// FEATURE 1: Products Tab — Excessive Horizontal Padding Elimination
// ─────────────────────────────────────────────────────────────
console.log('--- TEST 1: Products Tab Mobile Padding & Viewport Utilization ---');

// 1.1 New Product Page wrapper padding
const newProductPage = readSource('app/(dashboard)/products/new/page.tsx');
assert.ok(
  newProductPage.includes('p-0 sm:p-4 md:p-6'),
  'New Product Page must eliminate excessive mobile padding (p-0 on mobile, sm:p-4 on larger screens)'
);
assert.ok(
  !newProductPage.includes('p-8 pt-6'),
  'New Product Page must not use hardcoded p-8 padding on mobile'
);
console.log('✓ 1.1 New Product page wrapper uses p-0 on mobile (zero redundant side margins)');

// 1.2 Edit Product Page wrapper padding
const editProductPage = readSource('app/(dashboard)/products/[id]/edit/page.tsx');
assert.ok(
  editProductPage.includes('p-0 sm:p-4 md:p-6'),
  'Edit Product Page must eliminate excessive mobile padding (p-0 on mobile)'
);
console.log('✓ 1.2 Edit Product page wrapper uses p-0 on mobile');

// 1.3 Product Details Page wrapper padding
const detailsProductPage = readSource('app/(dashboard)/products/[id]/page.tsx');
assert.ok(
  detailsProductPage.includes('p-0 sm:p-4 md:p-6'),
  'Product Details Page must eliminate excessive mobile padding'
);
console.log('✓ 1.3 Product Details page wrapper uses p-0 on mobile');

// 1.4 Products View Catalog
const productsView = readSource('components/products/products-view.tsx');
assert.ok(
  productsView.includes('p-0 sm:p-2 md:p-6'),
  'Products View component must use p-0 on mobile to fill 94-96% viewport width'
);
assert.ok(
  productsView.includes('grid-cols-2 lg:grid-cols-4'),
  'Summary metric cards must display 2 per row on mobile to save vertical scrolling'
);
console.log('✓ 1.4 Products View catalog uses p-0 on mobile and 2-column metrics summary');

// 1.5 Product Form Responsive Layout & Invariants
const productForm = readSource('components/products/product-form.tsx');
assert.ok(
  productForm.includes('w-full max-w-4xl mx-auto'),
  'Product form must use full width up to max-w-4xl container'
);
assert.ok(
  productForm.includes('space-y-4 sm:space-y-6 md:space-y-8'),
  'Product form must use tight, responsive vertical spacing between cards on mobile'
);
assert.ok(
  productForm.includes('p-3.5 sm:p-5 md:p-6'),
  'Product form card contents must use compact p-3.5 padding on mobile'
);
assert.ok(
  productForm.includes('grid-cols-2 sm:grid-cols-2 lg:grid-cols-5'),
  'Pricing and tax fields must use responsive 2-column mobile layout'
);
assert.ok(
  productForm.includes('sticky bottom-16 sm:bottom-0'),
  'Sticky bottom action bar must sit at bottom-16 on mobile to float cleanly above MobileBottomNav'
);
console.log('✓ 1.5 Product Form responsive cards, 2-col pricing, and mobile nav clearance verified');


// ─────────────────────────────────────────────────────────────
// FEATURE 2: Billing / POS — Two Products Per Row on Mobile
// ─────────────────────────────────────────────────────────────
console.log('\n--- TEST 2: Billing / POS Two-Column Product Grid on Mobile ---');

const productSearch = readSource('components/billing/product-search.tsx');

// 2.1 CSS Grid with 2 columns on mobile
assert.ok(
  productSearch.includes('grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'),
  'Billing product grid must specify grid-cols-2 on mobile devices'
);
assert.ok(
  productSearch.includes('gap-2 sm:gap-3.5'),
  'Billing product grid must use compact gap-2 (8px) on mobile for maximum card area'
);
console.log('✓ 2.1 Billing product grid renders 2 columns on mobile (grid-cols-2)');

// 2.2 Product Card Content Requirements
// - Category badge
// - Product name
// - Product size
// - Available stock
// - Selling price
// - Add button
assert.ok(
  productSearch.includes('categoryName'),
  'Product card must display Category badge'
);
assert.ok(
  productSearch.includes('product.name'),
  'Product card must display Product name'
);
assert.ok(
  productSearch.includes('formatProductPackDisplay'),
  'Product card must display Product size badge'
);
assert.ok(
  productSearch.includes('isOut ?') && productSearch.includes('Out of stock') && productSearch.includes('left'),
  'Product card must display Available stock'
);
assert.ok(
  productSearch.includes('formatCurrency(product.selling_price'),
  'Product card must display Selling price prominently'
);
assert.ok(
  productSearch.includes('handleAdd(product)'),
  'Product card must have Add button'
);
console.log('✓ 2.2 All required card elements present (Category, Name, Size, Stock, Price, Add Button)');

// 2.3 Typography & Sizing Proportions on Mobile
assert.ok(
  productSearch.includes('text-xs sm:text-base') &&
  productSearch.includes('line-clamp-2') &&
  productSearch.includes('min-h-[2rem]'),
  'Product title must use text-xs on mobile with line-clamp-2 and min-height for uniform heights'
);
assert.ok(
  productSearch.includes('p-2 sm:p-3.5'),
  'Product card must use compact p-2 padding on mobile'
);
assert.ok(
  productSearch.includes('h-7 sm:h-9 px-2 sm:px-3.5'),
  'Add button must be compact (h-7 px-2) on mobile for easy tapping without overflowing'
);
console.log('✓ 2.3 Mobile card proportions, compact padding, and uniform height invariants verified');


// ─────────────────────────────────────────────────────────────
// FEATURE 3: Billing Page Layout & Navigation Invariants
// ─────────────────────────────────────────────────────────────
console.log('\n--- TEST 3: Billing Page Overall Spacing & Safe-Area ---');

const billingPage = readSource('app/(dashboard)/billing/page.tsx');
assert.ok(
  billingPage.includes('max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-10 min-w-0'),
  'Billing page must use responsive spacing without horizontal overflow'
);
assert.ok(
  billingPage.includes('p-3.5 sm:p-5 md:p-6'),
  'Customer / Farmer card must use compact p-3.5 padding on mobile'
);
console.log('✓ 3.1 Customer card and billing sections use consistent p-3.5 mobile padding');

const paymentPanel = readSource('components/billing/payment-panel.tsx');
assert.ok(
  paymentPanel.includes('h-14 sm:h-16 rounded-xl text-lg sm:text-xl md:text-2xl'),
  'Complete Bill button must be responsive (text-lg on mobile, text-2xl on desktop)'
);
console.log('✓ 3.2 Payment complete button responsive text size verified');

console.log('\n================================================================');
console.log('🎉 ALL MOBILE UI/UX VERIFICATION TESTS PASSED SUCCESSFULLY!');
console.log('================================================================\n');
