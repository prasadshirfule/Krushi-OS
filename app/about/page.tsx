import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';

export const metadata: Metadata = {
  title: 'About Us — KRUSHI OS',
  description: 'Built for rural Indian agricultural retailers and Krushi Seva Kendras to streamline billing and inventory.',
};

export default function AboutPage() {
  return (
    <LegalPageLayout
      title="About KRUSHI OS"
      subtitle="Modernizing Agricultural Input Retail for India's Farming Ecosystem"
      lastUpdated="November 2026"
    >
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">Our Mission</h2>
        <p>
          KRUSHI OS was created with a single objective: to provide licensed agricultural input retailers (Krushi Seva Kendras) with a modern, dependable, and simple operating system for day-to-day retail billing, inventory management, batch expiry tracking, and farmer credit accounts.
        </p>
        <p>
          Across rural India, agricultural retailers manage complex inventories of fertilizers, pesticides, and hybrid seeds, while maintaining credit registers (&quot;Khata&quot;) for hundreds of farming families. Traditional desktop software is often complicated, fragile, and lacks real-time mobile accessibility.
        </p>
        <p>
          KRUSHI OS combines cutting-edge cloud infrastructure with an intuitive interface designed for busy counter operations. With built-in camera barcode and QR scanning, instant Marathi and English printing, and automated SMS notifications, KRUSHI OS empowers agri-dealers to serve farmers faster and manage their business with absolute clarity.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">Core Principles</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Data Privacy & Security:</strong> We enforce strict tenant isolation using PostgreSQL Row Level Security. Every shop&apos;s customer list and pricing remain confidential.</li>
          <li><strong>Farmer-First Accessibility:</strong> Transactional SMS notifications ensure farmers on any phone receive clear billing and outstanding balance receipts.</li>
          <li><strong>Regulatory Compliance:</strong> Standard GST tax invoices and batch-level tracking comply with Indian agricultural retail regulations.</li>
        </ul>
      </section>
    </LegalPageLayout>
  );
}
