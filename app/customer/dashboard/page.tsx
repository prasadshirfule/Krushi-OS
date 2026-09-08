'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LogOut, User, Sprout, Loader2, ShieldCheck } from 'lucide-react';
import { formatDisplayMobile } from '@/lib/phone-utils';

export default function CustomerDashboardPlaceholder() {
  const router = useRouter();
  const [customer, setCustomer] = useState<{ name?: string; mobile?: string; email?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function loadCustomer() {
      try {
        const supabase = createClient();
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
          router.push('/login?type=customer');
          return;
        }

        const phone = user.phone || user.user_metadata?.phone || '';
        const name = user.user_metadata?.name || user.user_metadata?.full_name || 'Farmer';
        const email = user.email || '';

        setCustomer({
          name,
          mobile: phone,
          email,
        });
      } catch (err) {
        console.error('Failed to load customer profile:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadCustomer();
  }, [router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success('Logged out successfully.');
      router.push('/login?type=customer');
      router.refresh();
    } catch (err: any) {
      console.error('Logout error:', err);
      toast.error(err.message || 'Failed to log out.');
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      {/* Top Bar */}
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card px-4 md:px-8 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            🌾
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground leading-none">KRUSHI OS</h1>
            <p className="text-[11px] text-muted-foreground font-medium">Customer Portal</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30"
        >
          {isLoggingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
          Sign Out
        </Button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md bg-card border rounded-2xl p-6 sm:p-8 shadow-sm text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sprout className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified Customer Account
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome, {customer?.name || 'Farmer'}
            </h2>
            {customer?.email && (
              <p className="text-sm text-muted-foreground">
                {customer.email}
              </p>
            )}
            {customer?.mobile && (
              <p className="text-sm font-mono text-muted-foreground">
                {formatDisplayMobile(customer.mobile)}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-muted/40 border border-border/60 p-5 text-sm text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground text-base">Customer Portal Coming Soon</p>
            <p className="text-xs leading-relaxed">
              Your verified identity is securely connected. In the upcoming steps, you will be able to view and download tax invoices from all Krushi OS stores, track payments, and manage outstanding balances.
            </p>
          </div>

          <Button
            variant="destructive"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full py-5 font-semibold"
          >
            {isLoggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
            Sign Out
          </Button>
        </div>
      </main>
    </div>
  );
}

