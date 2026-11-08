import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';

export const metadata: Metadata = {
  title: 'Acceptable Use Policy — KRUSHI OS',
  description: 'Rules and guidelines for lawful and authorized usage of the KRUSHI OS platform by Krushi Seva Kendras.',
};

export default function AcceptableUsePage() {
  return (
    <LegalPageLayout
      title="Acceptable Use Policy"
      subtitle="Operational Standards & Regulatory Integrity for Agricultural Dealers"
      lastUpdated="November 2026"
    >
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">1. Purpose & Scope</h2>
        <p>
          This Acceptable Use Policy (&quot;AUP&quot;) governs the conduct of all registered dealers, staff members, and users accessing KRUSHI OS. The policy ensures platform stability, security, and strict adherence to Indian agricultural retail laws.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">2. Permitted & Intended Use</h2>
        <p>
          KRUSHI OS is intended solely for licensed agricultural input retailers, seed dealers, fertilizer distributors, and farmer service centers operating in the Republic of India to manage legitimate retail billing, inventory, customer ledger accounts, and statutory tax compliance.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">3. Strictly Prohibited Activities</h2>
        <p>Subscribers and users must NOT:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Record Unlawful or Banned Commodities:</strong> Use KRUSHI OS to generate invoices, stock entries, or sales records for agricultural chemicals, insecticides, or formulations banned or revoked by the Central Insecticides Board & Registration Committee (CIB&RC) or the Ministry of Agriculture and Farmers Welfare.
          </li>
          <li>
            <strong>Spamming or Unsolicited SMS:</strong> Use the SMS notification infrastructure to send promotional spam, bulk unsolicited advertisements, political messages, or content unrelated to the recipient&apos;s legitimate retail transaction with the store.
          </li>
          <li>
            <strong>Security Tampering:</strong> Probe, scan, or test the vulnerability of the system without authorization, or attempt to bypass Supabase Row Level Security or tenant isolation.
          </li>
          <li>
            <strong>Credential Sharing:</strong> Share individual staff login accounts across unauthorized third parties outside the licensed retail shop.
          </li>
          <li>
            <strong>Fabrication of Financial Records:</strong> Use the platform to deliberately create fictitious invoice sequences or fraudulent input tax credit (ITC) claims in violation of the Central Goods and Services Tax Act, 2017.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">4. Reporting Violations & Enforcement</h2>
        <p>
          Violations of this Acceptable Use Policy may result in immediate suspension or termination of platform access without refund. Suspected illegal trading of restricted agricultural inputs may be reported to competent statutory licensing authorities.
        </p>
        <p>
          To report suspected violations of this policy, please email: <strong>[ABUSE_EMAIL]</strong>.
        </p>
      </section>
    </LegalPageLayout>
  );
}
