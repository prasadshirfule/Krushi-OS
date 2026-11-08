import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';

export const metadata: Metadata = {
  title: 'Data Processing Agreement & Policy — KRUSHI OS',
  description: 'Data Processing Agreement (DPA) between KRUSHI OS and subscribing Krushi Seva Kendras under DPDP Act, 2023.',
};

export default function DataProcessingPage() {
  return (
    <LegalPageLayout
      title="Data Processing Agreement & Policy"
      subtitle="Standard Contractual Clauses under Digital Personal Data Protection Act, 2023"
      lastUpdated="November 2026"
    >
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">1. Purpose & Relationship of Parties</h2>
        <p>
          This Data Processing Agreement (&quot;DPA&quot;) governs the processing of customer and business data uploaded, created, or managed by the subscribing Krushi Seva Kendra (&quot;Data Fiduciary&quot;) on the KRUSHI OS platform operated by <strong>[LEGAL_ENTITY_NAME]</strong> (&quot;Data Processor&quot;).
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">2. Scope & Nature of Processing</h2>
        <p>The Data Processor agrees to process personal data strictly:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>For the sole purpose of providing, hosting, securing, and maintaining the KRUSHI OS billing and management service.</li>
          <li>In strict accordance with documented written instructions from the Data Fiduciary.</li>
          <li>Without selling, leasing, monetizing, or utilizing data for independent commercial or advertising purposes.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">3. Security Safeguards & Technical Measures</h2>
        <p>The Data Processor maintains comprehensive technical and organizational safeguards:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Database Encryption:</strong> Data encrypted in transit using TLS 1.3 and at rest using AES-256 in Supabase PostgreSQL partitions.</li>
          <li><strong>Row Level Security (RLS):</strong> Mandatory RLS applied to all tables containing tenant data. Access is strictly scoped to the authenticated shop ID.</li>
          <li><strong>Restricted Platform Administrator Access:</strong> Platform staff and operators have restricted access limited to system health and troubleshooting. Staff never access customer khata or retail pricing without explicit authorized support requests.</li>
          <li><strong>Audit Trail:</strong> System audit logs track sensitive actions, user logins, role assignments, and invoice modifications.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">4. Sub-processors</h2>
        <p>
          The Data Fiduciary grants general authorization to the Data Processor to engage vetted infrastructure sub-processors (Supabase Inc. for database hosting, Vercel Inc. for edge application routing, and MSG91 for Indian DLT SMS delivery). The Data Processor remains responsible for sub-processors&apos; compliance with data security obligations.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">5. Data Breach Notification</h2>
        <p>
          In the unlikely event of a confirmed personal data breach affecting the Data Fiduciary&apos;s data, the Data Processor shall notify the Data Fiduciary without undue delay (within 72 hours of becoming aware) and provide reasonable assistance in fulfilling statutory breach notification duties under the DPDP Act, 2023.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">6. Return or Deletion of Data</h2>
        <p>
          Upon subscription termination, the Data Fiduciary may request a full export of their data in standard CSV/Excel formats. Following export, the Data Processor shall securely delete or anonymize personal data within 90 days, except where retention is required by applicable Indian tax or agricultural retail laws.
        </p>
      </section>
    </LegalPageLayout>
  );
}
