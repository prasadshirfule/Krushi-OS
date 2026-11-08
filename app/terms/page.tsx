import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';

export const metadata: Metadata = {
  title: 'Terms of Service — KRUSHI OS',
  description: 'Terms and Conditions governing the use of the KRUSHI OS cloud billing and management platform by Krushi Seva Kendras.',
};

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      subtitle="Standard Commercial SaaS Agreement for Agricultural Retailers & Krushi Seva Kendras"
      lastUpdated="November 2026"
    >
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">1. Acceptance of Terms</h2>
        <p>
          These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between <strong>[LEGAL_ENTITY_NAME]</strong> (&quot;KRUSHI OS&quot;, &quot;we&quot;, &quot;us&quot;) and the subscribing business entity or individual (&quot;Subscriber&quot;, &quot;Shopkeeper&quot;, &quot;you&quot;) operating an agricultural retail shop, dealership, or Krushi Seva Kendra.
        </p>
        <p>
          By creating an account, subscribing to a plan, or accessing KRUSHI OS via web or mobile applications, you agree to be bound by these Terms and our Privacy Policy.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">2. Nature of Services</h2>
        <p>
          KRUSHI OS provides a specialized cloud-based Software-as-a-Service (SaaS) platform offering:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Point-of-Sale (POS) counter billing with multi-format camera barcode/QR scanning.</li>
          <li>Batch, lot, manufacturing date, and expiry date management for agricultural inputs.</li>
          <li>Farmer Khata ledger management, credit sales tracking, and payment receipts.</li>
          <li>Purchase entry, supplier ledger, and inventory stock tracking.</li>
          <li>Automated transactional SMS notifications and combined digital PDF account statements.</li>
          <li>Tax invoice generation complying with standard Indian GST formats.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">3. Shopkeeper Obligations & Regulatory Compliance</h2>
        <p>As a Subscriber operating an agricultural retail business, you represent and warrant that:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>You hold valid and subsisting retail licenses issued by the State Department of Agriculture under the Fertilizer (Control) Order, 1985, Insecticides Act, 1968, and Seeds Act, 1966.</li>
          <li>You are solely responsible for ensuring that product prices, GST rates, HSN codes, and batch expiry details entered into KRUSHI OS reflect statutory compliance and physical stock.</li>
          <li>You will maintain the confidentiality of your login credentials and immediately notify us of any unauthorized account access.</li>
          <li>You will obtain necessary consent from farmers before recording their mobile numbers for transactional bill delivery.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">4. Customer & Business Data Ownership</h2>
        <p className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold">
          Data Ownership Guarantee: You retain 100% exclusive ownership of all customer records, transaction histories, inventory data, invoices, and financial ledger entries entered into KRUSHI OS.
        </p>
        <p>
          KRUSHI OS does not claim any intellectual property rights or ownership over your business data. We process your data solely to deliver the platform services. You may export your products, sales, and customer ledgers at any time in standard CSV/Excel format.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">5. Subscription Terms & Billing</h2>
        <p>
          KRUSHI OS is offered on a subscription model (Monthly or Annual plans) with an initial 14-day free trial.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Trial Period:</strong> New accounts receive full platform access during the 14-day trial without requiring credit card details.</li>
          <li><strong>Renewals:</strong> Subscriptions are prepaid. Failure to renew upon expiration transitions the account into a 15-day Grace Period.</li>
          <li><strong>Grace Period Policy:</strong> During the 15-day Grace Period, all past records, invoices, and customer ledgers remain accessible for viewing and printing. New invoice creation is paused until renewal.</li>
          <li><strong>Zero Data Deletion on Expiry:</strong> Subscription expiration will NEVER cause the deletion or loss of your historical business or financial records.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">6. Prohibited Activities</h2>
        <p>You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Use KRUSHI OS to record fraudulent transactions, counterfeit agrochemicals, or banned substances.</li>
          <li>Attempt to reverse-engineer, decompile, or compromise the security or tenant isolation of the platform.</li>
          <li>Access or attempt to access another shopkeeper&apos;s data or tenant partition.</li>
          <li>Use automated scripts or scrapers to overwhelm the API or infrastructure.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">7. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by applicable Indian law, KRUSHI OS shall not be liable for any indirect, incidental, special, or consequential damages, including loss of business profits, crop yields, or agricultural disputes between dealers and farmers.
        </p>
        <p>
          Our total aggregate liability arising out of or related to these Terms shall not exceed the total subscription fees paid by you in the 3 (three) months preceding the incident.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">8. Governing Law & Dispute Resolution</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of the Republic of India. Any legal dispute, controversy, or claim arising out of these Terms shall be subject to the exclusive jurisdiction of the competent courts at <strong>[CITY/DISTRICT, STATE]</strong>, India.
        </p>
      </section>
    </LegalPageLayout>
  );
}
