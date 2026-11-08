import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';
import Link from 'next/link';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Pricing Plans — KRUSHI OS',
  description: 'Affordable, transparent SaaS subscription plans for Indian Krushi Seva Kendras starting at ₹499/month with 14-day free trial.',
};

export default function PricingPage() {
  const plans = [
    {
      name: 'Krushi Starter',
      price: '₹499',
      period: '/ month',
      desc: 'Ideal for single-counter fertilizer, seed, or pesticide retail shops.',
      features: [
        'Up to 500 Invoices / month',
        '250 DLT-compliant Transactional SMS',
        'Up to 1,000 Products Catalog',
        '2 Staff / Counter Logins',
        'Smart Camera Barcode / QR Scanner',
        'A4 & 80mm Thermal Receipt Printing',
        'Farmer Khata Ledger & Payment Receipts',
        'Email & WhatsApp Community Support',
      ],
      popular: false,
    },
    {
      name: 'Krushi Pro Business',
      price: '₹999',
      period: '/ month',
      desc: 'Full-featured power package for high-volume Krushi Kendras.',
      features: [
        'Unlimited Invoices & Bills',
        '1,000 DLT-compliant Transactional SMS',
        'Unlimited Products & Batches',
        '5 Staff / Multi-Counter Logins',
        'FEFO Automatic Batch Allocation',
        'Combined Invoice + Statement PDFs',
        'Complete GST GSTR-1 Ready Reports',
        'Priority Phone & Remote Support',
      ],
      popular: true,
    },
    {
      name: 'Enterprise / Multi-Branch',
      price: '₹2,499',
      period: '/ month',
      desc: 'For large distributors and multi-location retail chains.',
      features: [
        'Unlimited Invoices across Multiple Branches',
        '3,000 DLT-compliant Transactional SMS',
        'Unlimited Everything & Staff Logins',
        'Custom DLT Sender Header Support',
        'Centralized Multi-Store Inventory',
        'Dedicated Account Manager',
        'Custom Data Migration Assistance',
        'SLA 99.9% Uptime Guarantee',
      ],
      popular: false,
    },
  ];

  return (
    <LegalPageLayout
      title="Transparent, Dealer-Friendly Pricing"
      subtitle="Simple Monthly Subscriptions with 14-Day Free Trial. No Hidden Charges."
      lastUpdated="November 2026"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 not-prose my-8">
        {plans.map((p, i) => (
          <div
            key={i}
            className={`p-6 rounded-2xl border flex flex-col justify-between transition-all bg-card ${
              p.popular
                ? 'border-primary ring-2 ring-primary/20 shadow-lg'
                : 'border-border shadow-xs'
            }`}
          >
            <div>
              {p.popular && (
                <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-4">
                  MOST POPULAR
                </span>
              )}
              <h3 className="font-bold text-xl text-foreground mb-1">{p.name}</h3>
              <p className="text-xs text-muted-foreground mb-4 min-h-[2.5rem]">{p.desc}</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl sm:text-4xl font-extrabold text-foreground">{p.price}</span>
                <span className="text-xs text-muted-foreground">{p.period}</span>
              </div>
              <ul className="space-y-2.5 text-xs text-muted-foreground mb-6">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Button asChild className="w-full font-bold" variant={p.popular ? 'default' : 'outline'}>
              <Link href="/register">
                Start 14-Day Free Trial
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Link>
            </Button>
          </div>
        ))}
      </div>
      <p className="text-xs text-center text-muted-foreground not-prose">
        * All prices exclusive of 18% GST. GST invoice provided for Input Tax Credit (ITC). Cancel anytime with zero data loss.
      </p>
    </LegalPageLayout>
  );
}
