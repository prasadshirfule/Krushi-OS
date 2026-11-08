import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';
import { Scan, QrCode, Receipt, Users, Warehouse, ShieldCheck, Smartphone, IndianRupee } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Features — KRUSHI OS',
  description: 'Point-of-Sale, smart barcode scanning, batch expiry tracking, and farmer khata built for Indian Krushi Seva Kendras.',
};

export default function FeaturesPage() {
  const features = [
    {
      icon: <Scan className="h-6 w-6 text-primary" />,
      title: 'Smart Camera Barcode & QR Scanner',
      desc: 'Instant camera scanning on mobile, tablet, and desktop webcams. Decodes GS1 barcodes, QR codes, EAN-13, and multi-format agricultural packaging.',
    },
    {
      icon: <Receipt className="h-6 w-6 text-primary" />,
      title: 'GST-Compliant Agricultural Billing',
      desc: 'Bilingual Marathi/English invoicing. Multi-format printing: A4 Tax Invoice, A5 Compact, and 80mm Thermal Receipts.',
    },
    {
      icon: <Warehouse className="h-6 w-6 text-primary" />,
      title: 'Batch, Lot & Expiry Management',
      desc: 'FEFO (First-Expired-First-Out) automatic batch allocation. Strict segregation of Expiry Date vs Best Before Date.',
    },
    {
      icon: <Users className="h-6 w-6 text-primary" />,
      title: 'Farmer Khata & Ledger Management',
      desc: 'Complete credit tracking, payment receipts, outstanding balances, and mathematical debit/credit reconciliation.',
    },
    {
      icon: <Smartphone className="h-6 w-6 text-primary" />,
      title: 'Instant SMS Transaction Delivery',
      desc: 'TRAI DLT-compliant SMS notifications delivering bill summaries and cryptographically secure digital statement links directly to farmers.',
    },
    {
      icon: <ShieldCheck className="h-6 w-6 text-primary" />,
      title: 'Multi-Tenant Security & Privacy',
      desc: 'Enterprise PostgreSQL Row Level Security (RLS). Complete tenant isolation ensures your customer records remain private and secure.',
    },
  ];

  return (
    <LegalPageLayout
      title="Platform Features"
      subtitle="Purpose-Built Retail ERP for Indian Krushi Seva Kendras & Agri-Input Dealers"
      lastUpdated="November 2026"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose my-6">
        {features.map((f, i) => (
          <div key={i} className="p-6 rounded-2xl border border-border bg-card shadow-xs flex flex-col justify-between">
            <div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="font-bold text-lg text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </LegalPageLayout>
  );
}
