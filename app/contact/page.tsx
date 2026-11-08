import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';
import { Mail, Phone, MapPin, MessageSquare } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact Us — KRUSHI OS',
  description: 'Get in touch with the KRUSHI OS support and business team.',
};

export default function ContactPage() {
  return (
    <LegalPageLayout
      title="Contact Us"
      subtitle="We're Here to Help Your Krushi Seva Kendra Succeed"
      lastUpdated="November 2026"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 not-prose my-6">
        <div className="p-6 rounded-2xl border border-border bg-card space-y-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-base text-foreground">Email Support</h3>
          <p className="text-xs text-muted-foreground">For technical support, billing inquiries, or onboarding assistance:</p>
          <p className="text-sm font-semibold text-primary">[SUPPORT_EMAIL]</p>
        </div>

        <div className="p-6 rounded-2xl border border-border bg-card space-y-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Phone className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-base text-foreground">Helpline Desk</h3>
          <p className="text-xs text-muted-foreground">Monday to Saturday: 9:00 AM – 6:00 PM IST:</p>
          <p className="text-sm font-semibold text-primary">[SUPPORT_PHONE]</p>
        </div>

        <div className="p-6 rounded-2xl border border-border bg-card space-y-3 sm:col-span-2">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <MapPin className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-base text-foreground">Registered Office</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            [LEGAL_ENTITY_NAME], [REGISTERED_OFFICE_ADDRESS]
          </p>
        </div>
      </div>
    </LegalPageLayout>
  );
}
