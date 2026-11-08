import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';
import { Download, Trash2, ShieldAlert, CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Data Requests & Account Deletion — KRUSHI OS',
  description: 'Procedures for requesting data exports, data correction, or account deletion in accordance with the DPDP Act 2023.',
};

export default function DataRequestPage() {
  return (
    <LegalPageLayout
      title="Data Requests & Account Deletion"
      subtitle="Exercise Your Rights to Data Portability, Correction, and Erasure"
      lastUpdated="November 2026"
    >
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">1. Your Data Rights</h2>
        <p>
          In accordance with the <strong>Digital Personal Data Protection Act, 2023</strong>, all users and data principals have statutory rights regarding the personal data processed by KRUSHI OS.
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl border border-border bg-card space-y-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Download className="h-4 w-4" />
          </div>
          <h3 className="font-bold text-base text-foreground">Data Export & Portability</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Shopkeepers can export their complete product catalog, sales invoices, customer lists, and financial ledgers at any time via Settings &gt; Reports &gt; Export CSV.
          </p>
        </div>

        <div className="p-5 rounded-xl border border-border bg-card space-y-2">
          <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive">
            <Trash2 className="h-4 w-4" />
          </div>
          <h3 className="font-bold text-base text-foreground">Account Deletion & Erasure</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Shopkeepers may request complete closure of their store account and deletion of associated data, subject to mandatory statutory tax retention laws.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">2. Statutory Retention Exceptions</h2>
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs sm:text-sm text-amber-900 dark:text-amber-300 space-y-2">
          <div className="flex items-center gap-2 font-bold">
            <ShieldAlert className="h-4 w-4" />
            <span>Important Legal Notice Regarding Tax & Agricultural Records</span>
          </div>
          <p>
            Under Section 36 of the Central Goods and Services Tax Act, 2017, registered dealers are legally required to retain all books of account, tax invoices, and credit/debit records for a minimum period of <strong>72 months (6 years)</strong> from the due date of furnishing of the annual return.
          </p>
          <p>
            Consequently, statutory tax invoices, sales registers, and audited ledger entries cannot be erased prior to the expiry of the statutory retention period. Upon account closure, such records are locked into an encrypted, read-only archival partition and will not be processed for any other purpose.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">3. How to Submit a Data Request</h2>
        <p>To request data correction, data export, or account deletion:</p>
        <ol className="list-decimal pl-5 space-y-2 text-xs sm:text-sm">
          <li>
            Send an email from your registered store email address to: <strong>[DATA_REQUEST_EMAIL]</strong>.
          </li>
          <li>
            Specify the request type in the subject line (e.g. <em>&quot;Data Export Request — [Shop Name]&quot;</em> or <em>&quot;Account Erasure Request&quot;</em>).
          </li>
          <li>
            Attach proof of identity (such as a copy of your state retail pesticide/fertilizer license or GST registration certificate) to verify account ownership.
          </li>
          <li>
            Our data privacy team will verify the request and complete the action within <strong>15 business days</strong>.
          </li>
        </ol>
      </section>
    </LegalPageLayout>
  );
}
