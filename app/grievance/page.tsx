import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';
import { Mail, Phone, MapPin, Clock, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Grievance Redressal & Contact — KRUSHI OS',
  description: 'Official Grievance Officer and Customer Redressal details under the DPDP Act 2023 and IT Act 2000.',
};

export default function GrievancePage() {
  return (
    <LegalPageLayout
      title="Grievance Redressal & Contact"
      subtitle="Statutory Grievance Redressal Mechanism under DPDP Act, 2023 & IT Rules, 2021"
      lastUpdated="November 2026"
    >
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">1. Grievance Redressal Framework</h2>
        <p>
          KRUSHI OS has established a transparent and accessible grievance redressal mechanism in strict compliance with Section 12 of the <strong>Digital Personal Data Protection Act, 2023</strong> and Rule 3(2) of the <strong>Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021</strong>.
        </p>
        <p>
          If you have concerns, feedback, or complaints regarding data privacy, personal data processing, SMS notifications, or platform usage, you may lodge a formal grievance with our designated Grievance Officer.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">2. Designated Grievance Officer</h2>
        <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">[GRIEVANCE_OFFICER_NAME]</h3>
              <p className="text-xs text-muted-foreground">Data Protection & Grievance Redressal Officer</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="flex items-start gap-2.5">
              <Mail className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-foreground">Email Address</span>
                <span className="text-muted-foreground">[GRIEVANCE_OFFICER_EMAIL]</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Phone className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-foreground">Direct Contact</span>
                <span className="text-muted-foreground">[GRIEVANCE_OFFICER_PHONE]</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 sm:col-span-2">
              <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-foreground">Registered Office Address</span>
                <span className="text-muted-foreground">
                  [LEGAL_ENTITY_NAME], [REGISTERED_OFFICE_ADDRESS]
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 sm:col-span-2">
              <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-foreground">Working Hours</span>
                <span className="text-muted-foreground">Monday to Saturday: 10:00 AM to 5:00 PM IST (excluding public holidays)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">3. Resolution Timeline</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Acknowledgement:</strong> Every formal grievance is acknowledged with a unique tracking ticket within <strong>24 (twenty-four) hours</strong> of receipt.</li>
          <li><strong>Disposal & Resolution:</strong> We investigate and provide a reasoned written resolution within <strong>15 (fifteen) calendar days</strong> from the date of receipt.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">4. Data Protection Board Escalation</h2>
        <p>
          If you are not satisfied with the resolution provided by our Grievance Officer, you have the statutory right under the DPDP Act, 2023 to register a complaint with the <strong>Data Protection Board of India</strong> in the prescribed manner.
        </p>
      </section>
    </LegalPageLayout>
  );
}
