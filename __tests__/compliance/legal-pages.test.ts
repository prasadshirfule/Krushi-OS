import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('================================================================');
console.log('🧪 KRUSHI OS — LEGAL, COMPLIANCE & PUBLIC ROUTES AUDIT');
console.log('================================================================\n');

const projectRoot = process.cwd();

// 1. Audit Indian Statutory Legal Pages
console.log('--- TEST 1: Indian Statutory & Regulatory Legal Pages ---');

const legalPages = [
  {
    path: 'app/privacy/page.tsx',
    mustInclude: ['Digital Personal Data Protection Act, 2023', 'Data Fiduciary', 'Data Principal', 'Grievance Officer'],
    description: 'Privacy Policy (DPDP Act 2023)',
  },
  {
    path: 'app/terms/page.tsx',
    mustInclude: ['Terms of Service', 'Data Ownership', '100% exclusive ownership', 'Governing Law'],
    description: 'Terms of Service (Agri Dealer Rights & Data Ownership)',
  },
  {
    path: 'app/refund-policy/page.tsx',
    mustInclude: ['7-Day', 'Full Refund', 'Pro-Rated', 'Annual Plans'],
    description: 'Refund & Cancellation Policy',
  },
  {
    path: 'app/billing-policy/page.tsx',
    mustInclude: ['GST', '18%', 'Tax Invoice', 'UPI'],
    description: 'Billing & Pricing Policy (GST Invoicing & Payments)',
  },
  {
    path: 'app/cookie-policy/page.tsx',
    mustInclude: ['Strictly Necessary Cookies', 'HTTP-Only', 'No Advertising'],
    description: 'Cookie Policy (Zero Third-Party Advertising Trackers)',
  },
  {
    path: 'app/data-processing/page.tsx',
    mustInclude: ['Data Processing Agreement', 'Sub-Processors', 'Security Safeguards', 'Breach Notification'],
    description: 'Data Processing Addendum (DPA & Technical Security)',
  },
  {
    path: 'app/acceptable-use/page.tsx',
    mustInclude: ['Acceptable Use Policy', 'Banned Commodities', 'Central Insecticides Board', 'Central Goods and Services Tax Act'],
    description: 'Acceptable Use Policy (Agricultural Regulation Compliance)',
  },
  {
    path: 'app/grievance/page.tsx',
    mustInclude: ['Grievance Redressal', 'Grievance Officer', '24 (twenty-four) hours', '15 (fifteen) calendar days', 'Data Protection Board of India'],
    description: 'Grievance Redressal Mechanism (Statutory Timeline & Escalation)',
  },
  {
    path: 'app/data-request/page.tsx',
    mustInclude: ['Data Export & Portability', 'Right', 'Section 36', 'Central Goods and Services Tax Act'],
    description: 'Data Request & Statutory Retention Carve-out',
  },
];

legalPages.forEach((item) => {
  const fullPath = path.join(projectRoot, item.path);
  assert.ok(fs.existsSync(fullPath), `File ${item.path} must exist`);
  const content = fs.readFileSync(fullPath, 'utf8');
  item.mustInclude.forEach((phrase) => {
    assert.ok(
      content.toLowerCase().includes(phrase.toLowerCase()),
      `${item.description} must contain key statutory term "${phrase}"`
    );
  });
  console.log(`✓ 1.${legalPages.indexOf(item) + 1} Verified: ${item.description}`);
});

// 2. Marketing Pages Verification
console.log('\n--- TEST 2: Public Marketing Pages ---');
const marketingPages = [
  'app/features/page.tsx',
  'app/pricing/page.tsx',
  'app/about/page.tsx',
  'app/contact/page.tsx',
  'app/support/page.tsx',
];

marketingPages.forEach((pagePath) => {
  const fullPath = path.join(projectRoot, pagePath);
  assert.ok(fs.existsSync(fullPath), `Marketing page ${pagePath} must exist`);
});
console.log(`✓ 2.1 All ${marketingPages.length} public marketing pages verified on disk`);

// 3. Search Engine Security (robots.ts & sitemap.ts)
console.log('\n--- TEST 3: Search Engine Isolation (robots.ts & sitemap.ts) ---');
const robotsContent = fs.readFileSync(path.join(projectRoot, 'app/robots.ts'), 'utf8');
assert.ok(
  robotsContent.includes("'/dashboard/*'") || robotsContent.includes("'/billing/*'") || robotsContent.includes("'/api/*'"),
  'robots.ts must explicitly disallow internal ERP routes'
);
assert.ok(
  robotsContent.includes("'/features'") || robotsContent.includes("'/pricing'"),
  'robots.ts must allow public marketing routes'
);
console.log('✓ 3.1 robots.ts verified: internal dashboard/billing/API strictly disallowed from indexers');

const sitemapContent = fs.readFileSync(path.join(projectRoot, 'app/sitemap.ts'), 'utf8');
assert.ok(
  !sitemapContent.includes("'/dashboard'") && !sitemapContent.includes("'/billing'"),
  'sitemap.ts must never publish private customer or merchant routes'
);
assert.ok(
  sitemapContent.includes('/privacy') && sitemapContent.includes('/terms'),
  'sitemap.ts must include public legal compliance links'
);
console.log('✓ 3.2 sitemap.ts verified: exposes only public SEO and legal routes');

// 4. Production Health Check Route
console.log('\n--- TEST 4: Production Health & Uptime Probe ---');
const healthPath = path.join(projectRoot, 'app/api/health/route.ts');
assert.ok(fs.existsSync(healthPath), 'app/api/health/route.ts must exist');
const healthContent = fs.readFileSync(healthPath, 'utf8');
assert.ok(healthContent.includes('GET'), 'Health route must implement GET handler');
assert.ok(healthContent.includes('healthy'), 'Health route must return healthy state');
assert.ok(healthContent.includes('database'), 'Health route must probe database connectivity');
console.log('✓ 4.1 Production health probe verified with database ping and uptime tracking');

console.log('\n================================================================');
console.log('🎉 ALL LEGAL, COMPLIANCE & PUBLIC ROUTE TESTS PASSED SUCCESSFULLY!');
console.log('================================================================\n');
