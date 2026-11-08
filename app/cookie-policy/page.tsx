import { Metadata } from 'next';
import { LegalPageLayout } from '@/components/layout/legal-page-layout';

export const metadata: Metadata = {
  title: 'Cookie & Storage Policy — KRUSHI OS',
  description: 'Details on cookies, session authentication, and local storage usage in the KRUSHI OS web application.',
};

export default function CookiePolicyPage() {
  return (
    <LegalPageLayout
      title="Cookie & Storage Policy"
      subtitle="Strictly Necessary Cookies and Local Storage Usage"
      lastUpdated="November 2026"
    >
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">1. What Are Cookies & Local Storage?</h2>
        <p>
          Cookies and local storage are small text files or key-value pairs stored on your web browser or device when you use KRUSHI OS. They allow the application to remember your session, selected theme, and language preferences.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">2. Strictly Necessary Cookies</h2>
        <p>
          KRUSHI OS uses cookies exclusively for <strong>strictly necessary</strong> functional and security purposes:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left border border-border rounded-lg text-xs sm:text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-3 border-b border-border">Cookie / Storage Key</th>
                <th className="p-3 border-b border-border">Type</th>
                <th className="p-3 border-b border-border">Purpose & Lifespan</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 font-semibold">sb-*-auth-token</td>
                <td className="p-3">HTTP-Only / Secure Cookie</td>
                <td className="p-3">Maintains authenticated user session with Supabase Auth (Rotates on refresh)</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 font-semibold">theme</td>
                <td className="p-3">Local Storage</td>
                <td className="p-3">Preserves your preferred visual mode (Dark / Light / System)</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3 font-semibold">i18nextLng</td>
                <td className="p-3">Local Storage</td>
                <td className="p-3">Remembers chosen UI language (English / Marathi)</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold">krushi_recent_scans</td>
                <td className="p-3">Session Storage</td>
                <td className="p-3">Temporary camera barcode scan lock to prevent double-scanning</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">3. No Advertising or Tracking Cookies</h2>
        <p className="font-semibold text-emerald-600 dark:text-emerald-400">
          KRUSHI OS does NOT use third-party advertising cookies, behavioral tracking pixels (such as Facebook Pixel or Google Ads conversion trackers), or cross-site tracking scripts.
        </p>
        <p>
          Your retail browsing activities and customer data are never tracked or shared across independent websites.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">4. Managing Cookies in Your Browser</h2>
        <p>
          You may configure your browser to block or alert you about cookies. However, because our cookies are strictly essential for authentication and tenant isolation, disabling cookies will prevent you from logging into the KRUSHI OS application.
        </p>
      </section>
    </LegalPageLayout>
  );
}
