import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';

export const metadata: Metadata = {
  title: 'Subscription & Billing Policy — KRUSHI OS',
  description: 'Pricing plans, invoicing, payment methods, and billing cycles for KRUSHI OS agricultural ERP.',
};

export default function BillingPolicyPage() {
  return (
    <LegalPageLayout
      title="Subscription & Billing Policy"
      subtitle="Transparent Pricing, GST Tax Invoices, and Subscription Lifecycle"
      lastUpdated="November 2026"
    >
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">1. Subscription Plans & Quotas</h2>
        <p>
          KRUSHI OS provides tiered software subscription plans designed for agricultural dealers in India:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left border border-border rounded-lg text-xs sm:text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-3 border-b border-border">Plan</th>
                <th className="p-3 border-b border-border">Fee (INR)</th>
                <th className="p-3 border-b border-border">Monthly Invoices</th>
                <th className="p-3 border-b border-border">Monthly SMS</th>
                <th className="p-3 border-b border-border">Devices / Counters</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 font-semibold">14-Day Trial</td>
                <td className="p-3">₹0</td>
                <td className="p-3">100</td>
                <td className="p-3">50</td>
                <td className="p-3">2 Devices</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 font-semibold">Krushi Starter</td>
                <td className="p-3">₹499 / mo</td>
                <td className="p-3">500</td>
                <td className="p-3">250</td>
                <td className="p-3">2 Devices</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 font-semibold">Krushi Pro</td>
                <td className="p-3">₹999 / mo</td>
                <td className="p-3">Unlimited</td>
                <td className="p-3">1,000</td>
                <td className="p-3">5 Devices</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold">Enterprise</td>
                <td className="p-3">₹2,499 / mo</td>
                <td className="p-3">Unlimited</td>
                <td className="p-3">3,000</td>
                <td className="p-3">Multi-Branch</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">2. Payment Methods & Security</h2>
        <p>
          We accept all major Indian payment methods powered by RBI-authorized payment aggregators (Razorpay):
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Unified Payments Interface (UPI) — Google Pay, PhonePe, Paytm, BHIM.</li>
          <li>Net Banking from 50+ Indian banks.</li>
          <li>Domestic Debit and Credit Cards (RuPay, Visa, MasterCard).</li>
          <li>Business and Corporate Net Banking.</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          All payment card transactions adhere strictly to PCI-DSS Level 1 compliance and RBI tokenization regulations. KRUSHI OS never stores complete debit/credit card numbers or CVVs on our servers.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">3. GST Invoicing for Subscription Fees</h2>
        <p>
          All subscription charges are subject to Goods and Services Tax (GST) at the prevailing statutory rate (currently 18% for software services, SAC code 998314).
        </p>
        <p>
          If you provide a valid GSTIN during subscription setup, a B2B GST tax invoice with full input tax credit eligibility will be automatically generated and made downloadable from your Settings &gt; Subscription tab.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">4. Grace Period & Overdue Policy</h2>
        <p>
          If a renewal payment fails:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Days 1 to 15 (Grace Period):</strong> Your store continues operating normally. You have 15 days to renew without service disruption.</li>
          <li><strong>Day 16 onwards (Read-Only Mode):</strong> If payment is not completed, new invoice creation is paused. All historical customer ledgers, inventory counts, and past invoices remain completely viewable and exportable.</li>
          <li><strong>Data Preservation:</strong> Your data is protected and will never be deleted due to subscription expiration.</li>
        </ul>
      </section>
    </LegalPageLayout>
  );
}
