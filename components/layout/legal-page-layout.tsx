import Link from 'next/link';
import { ArrowLeft, Shield, FileText, Scale, Lock, HelpCircle } from 'lucide-react';

interface LegalPageLayoutProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function LegalPageLayout({
  title,
  subtitle,
  lastUpdated,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/login"
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Login</span>
          </Link>

          <Link href="/" className="flex items-center gap-2 font-black tracking-tight text-lg text-primary">
            <span className="text-xl">🌾</span>
            <span>KRUSHI OS</span>
          </Link>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Compliance & Trust</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12 flex-1 w-full">
        {/* Title Banner */}
        <div className="mb-8 sm:mb-10 pb-6 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-3">
            <FileText className="h-3.5 w-3.5" />
            <span>Official Policy Document</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-2">
            {title}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {subtitle}
          </p>
          <div className="mt-4 text-xs text-muted-foreground/80 flex items-center gap-4">
            <span>Last Updated: {lastUpdated}</span>
            <span>•</span>
            <span>Applies to: All Indian Operations</span>
          </div>
        </div>

        {/* Legal Text Content */}
        <div className="prose prose-zinc dark:prose-invert max-w-none text-sm sm:text-base leading-relaxed space-y-6">
          {children}
        </div>
      </main>

      {/* Legal Footer Navigation */}
      <footer className="border-t border-border bg-card/40 mt-16 py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-muted-foreground mb-6">
            <div className="space-y-2">
              <span className="font-bold text-foreground block">Legal & Privacy</span>
              <Link href="/privacy" className="block hover:text-primary transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="block hover:text-primary transition-colors">Terms of Service</Link>
              <Link href="/data-processing" className="block hover:text-primary transition-colors">Data Processing</Link>
            </div>
            <div className="space-y-2">
              <span className="font-bold text-foreground block">Billing & Refunds</span>
              <Link href="/refund-policy" className="block hover:text-primary transition-colors">Refund & Cancellation</Link>
              <Link href="/billing-policy" className="block hover:text-primary transition-colors">Subscription Policy</Link>
              <Link href="/pricing" className="block hover:text-primary transition-colors">Pricing Plans</Link>
            </div>
            <div className="space-y-2">
              <span className="font-bold text-foreground block">Compliance & Trust</span>
              <Link href="/acceptable-use" className="block hover:text-primary transition-colors">Acceptable Use</Link>
              <Link href="/cookie-policy" className="block hover:text-primary transition-colors">Cookie Policy</Link>
              <Link href="/grievance" className="block hover:text-primary transition-colors">Grievance Redressal</Link>
            </div>
            <div className="space-y-2">
              <span className="font-bold text-foreground block">User Rights</span>
              <Link href="/data-request" className="block hover:text-primary transition-colors">Data Requests & Deletion</Link>
              <Link href="/contact" className="block hover:text-primary transition-colors">Contact Support</Link>
              <Link href="/about" className="block hover:text-primary transition-colors">About KRUSHI OS</Link>
            </div>
          </div>
          <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground text-center sm:text-left">
            <span>© {new Date().getFullYear()} KRUSHI OS. Built for Indian Agricultural Retailers.</span>
            <span>Governed under the laws of the Republic of India.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
