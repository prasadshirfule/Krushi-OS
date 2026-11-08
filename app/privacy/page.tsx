import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';

export const metadata: Metadata = {
  title: 'Privacy Policy — KRUSHI OS',
  description: 'Privacy Policy and Data Protection practices for KRUSHI OS agricultural ERP in compliance with Digital Personal Data Protection Act, 2023.',
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="Digital Personal Data Protection Act (DPDP), 2023 & Information Technology Act Compliance"
      lastUpdated="November 2026"
    >
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">1. Introduction & Scope</h2>
        <p>
          KRUSHI OS (operated by <strong>[LEGAL_ENTITY_NAME]</strong>, referred to as &quot;KRUSHI OS&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides a cloud-based Enterprise Resource Planning (ERP), Point of Sale (POS), and billing platform designed specifically for licensed agricultural input dealers (&quot;Krushi Seva Kendras&quot;) in India.
        </p>
        <p>
          This Privacy Policy describes our practices regarding the collection, processing, storage, and transfer of digital personal data in accordance with the <strong>Digital Personal Data Protection Act, 2023 (&quot;DPDP Act&quot;)</strong>, the Information Technology Act, 2000, and applicable rules.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">2. Roles: Data Fiduciary vs Data Processor</h2>
        <p>
          Under the DPDP Act, 2023:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>The Shopkeeper (Krushi Seva Kendra)</strong> acts as the <strong>Data Fiduciary</strong> regarding the personal data of farmers, customers, and employees collected during retail sales. The shopkeeper determines the purpose and lawful basis for collecting customer information.
          </li>
          <li>
            <strong>KRUSHI OS</strong> acts as a <strong>Data Processor</strong>, processing customer and business data strictly on behalf of and under instructions from the subscribing shopkeeper to provide billing, inventory, SMS notification, and ledger services.
          </li>
          <li>
            KRUSHI OS acts as a <strong>Data Fiduciary</strong> solely regarding the account, authentication, and subscription data of registered shopkeepers and authorized platform users.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">3. Categories of Data Collected</h2>
        <h3 className="text-base font-semibold text-foreground">A. Shopkeeper & Staff Account Data</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Full name, official shop name, business email address, and mobile phone number.</li>
          <li>Fertilizer license number, pesticide license number, seed license number, and GSTIN.</li>
          <li>Store address, district, state, and pincode.</li>
          <li>Bank account details for invoice display (Bank name, Account number, IFSC code).</li>
        </ul>

        <h3 className="text-base font-semibold text-foreground">B. Farmer & Customer Data (Processed on Shop&apos;s Behalf)</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Farmer/Customer name, 10-digit mobile phone number, village name, and address.</li>
          <li>Aadhaar number (last 4 digits only, where voluntary farmer verification is requested by dealer).</li>
          <li>Transaction history, purchases of fertilizers, seeds, and pesticides, invoice amounts, payments, and credit/debit balances (Khata records).</li>
        </ul>

        <h3 className="text-base font-semibold text-foreground">C. Technical & Diagnostic Data</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Log metadata, IP address, browser/device user-agent, and document access timestamps.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">4. Purpose of Processing & Lawful Grounds</h2>
        <p>Data is collected and processed strictly for legitimate business and statutory purposes:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Generating statutory GST-compliant invoices and cash memos.</li>
          <li>Maintaining agricultural input sales registers as required under the Fertilizer (Inorganic, Organic or Mixed) (Control) Order, 1985 and Insecticides Rules, 1971.</li>
          <li>Delivering transactional SMS notifications (invoice confirmations, payment receipts, balance reminders) via approved TRAI DLT headers.</li>
          <li>Providing farmers secure web access to their combined invoice and ledger statements.</li>
          <li>Providing real-time inventory tracking, batch expiry alerts, and financial reporting for store management.</li>
        </ul>
        <p className="font-semibold text-emerald-600 dark:text-emerald-400">
          We NEVER sell, rent, monetize, or share customer or business records with advertisers or third-party marketing brokers.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">5. Sub-processors and Cloud Infrastructure</h2>
        <p>We engage vetted enterprise infrastructure providers who maintain rigorous security certifications:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left border border-border rounded-lg text-xs sm:text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-3 border-b border-border">Provider</th>
                <th className="p-3 border-b border-border">Purpose</th>
                <th className="p-3 border-b border-border">Location</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 font-semibold">Supabase Inc.</td>
                <td className="p-3">Managed PostgreSQL Database, Authentication, Row-Level Security</td>
                <td className="p-3">AWS Asia-Pacific (Mumbai / Singapore)</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 font-semibold">Vercel Inc.</td>
                <td className="p-3">Next.js Web Application Hosting & Edge Routing</td>
                <td className="p-3">Global Edge Network / Mumbai Edge</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold">MSG91 / Indian DLT Provider</td>
                <td className="p-3">Transactional SMS Delivery via TRAI-registered Headers</td>
                <td className="p-3">India</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">6. Data Security & Tenant Isolation</h2>
        <p>
          We employ multi-layered technical controls to enforce strict tenant isolation:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>PostgreSQL Row Level Security (RLS):</strong> Every tenant-owned database record is strictly locked to the authenticated shop ID. No shop can read or modify another shop&apos;s data.</li>
          <li><strong>Cryptographic Document Tokens:</strong> Direct sequential database IDs are never exposed in public links. Combined invoice statements use random cryptographic tokens with expiration and audit logging.</li>
          <li><strong>Transport Layer Security:</strong> All web and mobile communications strictly enforce HTTPS TLS 1.3 with HSTS.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">7. Data Retention & Deletion</h2>
        <p>
          Statutory invoices and financial ledger entries are retained for a minimum period of 6 (six) financial years in accordance with Section 36 of the Central Goods and Services Tax Act, 2017. Shopkeepers may request account termination or export of their data at any time via the platform settings or by submitting a data request.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">8. Your Rights Under DPDP Act, 2023</h2>
        <p>Data Principals (farmers, customers, and shopkeepers) have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access a summary of personal data being processed.</li>
          <li>Correct inaccurate or misleading personal data.</li>
          <li>Withdraw consent for optional SMS notifications or communications.</li>
          <li>Nominate an individual to exercise rights in the event of death or incapacity.</li>
          <li>Grievance redressal regarding any data protection concerns.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">9. Grievance Officer Contact Details</h2>
        <p>
          In accordance with Rule 3(2) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and Section 12 of the DPDP Act, 2023:
        </p>
        <div className="p-4 rounded-xl border border-border bg-card space-y-1 text-xs sm:text-sm">
          <p><strong>Grievance Officer:</strong> [GRIEVANCE_OFFICER_NAME]</p>
          <p><strong>Designation:</strong> Data Protection & Grievance Redressal Officer</p>
          <p><strong>Company:</strong> [LEGAL_ENTITY_NAME]</p>
          <p><strong>Address:</strong> [REGISTERED_OFFICE_ADDRESS]</p>
          <p><strong>Email:</strong> [GRIEVANCE_OFFICER_EMAIL]</p>
          <p><strong>Response Time:</strong> We acknowledge complaints within 24 hours and resolve them within 15 days.</p>
        </div>
      </section>
    </LegalPageLayout>
  );
}
