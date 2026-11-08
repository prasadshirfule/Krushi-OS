import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';
import Link from 'next/link';
import { HelpCircle, FileText, Smartphone, Printer, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Help & Support — KRUSHI OS',
  description: 'Guides, FAQs, and support resources for KRUSHI OS agricultural retail management.',
};

export default function SupportPage() {
  const faqs = [
    {
      q: 'How does camera barcode scanning work on mobile devices?',
      a: 'KRUSHI OS uses your device camera via standard secure browser APIs. When clicking "Scan Barcode" or "Scan Packaging", the app opens a live camera viewfinder supporting GS1 barcodes, QR codes, EAN-13, and printed label OCR.',
    },
    {
      q: 'Can I print invoices on an 80mm thermal receipt printer?',
      a: 'Yes. KRUSHI OS natively supports 80mm thermal receipts, A5 compact vouchers, and standard A4 Tax Invoices. Simply select your preferred printer layout from the invoice screen.',
    },
    {
      q: 'How does transactional SMS delivery work for farmers?',
      a: 'When completing a bill or receiving payment, an SMS notification is automatically queued with bill details and an optional secure web link for the farmer to view their combined invoice and ledger statement.',
    },
    {
      q: 'What happens if my internet connection is temporarily interrupted?',
      a: 'KRUSHI OS includes client-side caching and state protection to ensure you do not lose active cart items. When the network reconnects, transactions synchronize reliably.',
    },
  ];

  return (
    <LegalPageLayout
      title="Help & Support Desk"
      subtitle="Frequently Asked Questions and Knowledge Base for Krushi Seva Kendras"
      lastUpdated="November 2026"
    >
      <div className="space-y-6 not-prose my-6">
        {faqs.map((faq, i) => (
          <div key={i} className="p-5 rounded-xl border border-border bg-card space-y-2">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary shrink-0" />
              <span>{faq.q}</span>
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed pl-6">{faq.a}</p>
          </div>
        ))}
      </div>

      <div className="p-6 rounded-2xl bg-muted/50 border border-border not-prose text-center space-y-3">
        <h3 className="font-bold text-base text-foreground">Need Immediate Technical Assistance?</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Our support desk is available Monday through Saturday to assist with store onboarding, thermal printer configuration, and staff training.
        </p>
        <div className="pt-2">
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors"
          >
            Contact Customer Support
          </Link>
        </div>
      </div>
    </LegalPageLayout>
  );
}
