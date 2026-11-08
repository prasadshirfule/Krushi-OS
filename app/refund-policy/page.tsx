import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy — KRUSHI OS',
  description: 'Cancellation, renewal, and refund policies for KRUSHI OS SaaS subscriptions for Krushi Seva Kendras.',
};

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout
      title="Refund & Cancellation Policy"
      subtitle="Transparent, Fair Commercial Subscription Terms for Agricultural Retailers"
      lastUpdated="November 2026"
    >
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">1. Subscription Cancellation</h2>
        <p>
          At KRUSHI OS, we believe in giving agricultural shopkeepers full autonomy over their subscriptions without locked-in contracts or punitive cancellation hurdles.
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Cancel Anytime:</strong> You may cancel your KRUSHI OS subscription at any time directly through your shop settings or by emailing support at <strong>[SUPPORT_EMAIL]</strong>.
          </li>
          <li>
            <strong>Continued Access Until Period End:</strong> Upon cancellation, your account remains fully active with full features until the end of your current paid billing cycle.
          </li>
          <li>
            <strong>No Automatic Deletion:</strong> Cancelling your subscription will NEVER result in the deletion of your historical sales, customer Khata records, or inventory history. Your records will be preserved securely in read-only format.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">2. Refund Eligibility</h2>
        <h3 className="text-base font-semibold text-foreground">A. 7-Day Money-Back Guarantee (First Paid Cycle)</h3>
        <p>
          If you are transitioning from our 14-day free trial to your first paid subscription cycle and find that KRUSHI OS does not meet your business requirements, you are eligible for a <strong>100% full refund</strong> if requested within <strong>7 (seven) calendar days</strong> of the initial charge.
        </p>

        <h3 className="text-base font-semibold text-foreground">B. Recurring Monthly & Annual Renewals</h3>
        <p>
          For subsequent recurring billing cycles:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Monthly Plans:</strong> Monthly subscription charges are non-refundable once the 7-day initial guarantee period has passed. Cancelling prevents future renewals.
          </li>
          <li>
            <strong>Annual Plans:</strong> If you cancel an annual plan within 30 days of renewal, you may request a pro-rated refund for the remaining unused full calendar months, minus any transactional SMS carrier costs already consumed.
          </li>
        </ul>

        <h3 className="text-base font-semibold text-foreground">C. Technical Service Outages</h3>
        <p>
          If KRUSHI OS experiences critical platform downtime exceeding our 99.5% monthly availability commitment (excluding scheduled maintenance), affected subscribers are entitled to pro-rated service credits towards their next billing cycle upon verification.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">3. Failed & Duplicate Payments</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Duplicate Deductions:</strong> In the rare event of a duplicate payment deduction caused by banking network timeouts or gateway retries, the duplicate amount is automatically refunded to the original payment source within 5 to 7 business days.
          </li>
          <li>
            <strong>Payment Failures:</strong> If an automatic renewal fails due to bank card expiration or UPI decline, your account will enter the 15-day Grace Period, allowing you to update payment details without operational disruption.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">4. Refund Processing Time</h2>
        <p>
          Approved refunds are processed via our payment gateway (Razorpay) to the original payment method (Bank Account, UPI, Debit/Credit Card) within <strong>5 to 7 working days</strong>, subject to standard Indian banking processing timelines.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">5. Contact Support for Inquiries</h2>
        <div className="p-4 rounded-xl border border-border bg-card text-xs sm:text-sm space-y-1">
          <p><strong>Support & Billing Desk:</strong> [SUPPORT_EMAIL]</p>
          <p><strong>Helpline (Mon–Sat, 9:00 AM – 6:00 PM IST):</strong> [SUPPORT_PHONE]</p>
          <p><strong>Entity:</strong> [LEGAL_ENTITY_NAME], [REGISTERED_OFFICE_ADDRESS]</p>
        </div>
      </section>
    </LegalPageLayout>
  );
}
