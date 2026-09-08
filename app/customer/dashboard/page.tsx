'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  LogOut,
  User,
  Sprout,
  Loader2,
  Phone,
  Mail,
  Edit2,
  Plus,
  Link2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDisplayMobile, isValidIndianMobile } from '@/lib/phone-utils';
import { getCustomerAccountAction, updateCustomerMobileAction } from '@/actions/customer-auth';

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<{ name: string; mobile: string | null; email: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Mobile Dialog state
  const [isMobileDialogOpen, setIsMobileDialogOpen] = useState(false);
  const [mobileInput, setMobileInput] = useState('');
  const [isSavingMobile, setIsSavingMobile] = useState(false);

  useEffect(() => {
    async function loadCustomer() {
      try {
        const res = await getCustomerAccountAction();
        if (res.success && res.data) {
          setCustomer(res.data);
        } else {
          // Fallback to client auth session
          const supabase = createClient();
          const { data: { user }, error } = await supabase.auth.getUser();

          if (error || !user) {
            router.push('/login?type=customer');
            return;
          }

          const phone = user.phone || user.user_metadata?.phone || null;
          const name = user.user_metadata?.name || user.user_metadata?.full_name || 'Farmer';
          const email = user.email || '';

          setCustomer({
            name,
            mobile: phone,
            email,
          });
        }
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

  const handleOpenMobileDialog = () => {
    setMobileInput(customer?.mobile || '');
    setIsMobileDialogOpen(true);
  };

  const handleSaveMobile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!mobileInput.trim()) {
      toast.error('Please enter a mobile number.');
      return;
    }

    if (!isValidIndianMobile(mobileInput.trim())) {
      toast.error('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
      return;
    }

    setIsSavingMobile(true);
    try {
      const result = await updateCustomerMobileAction(mobileInput.trim());

      if (!result.success) {
        toast.error(result.error || 'Failed to update mobile number.');
        setIsSavingMobile(false);
        return;
      }

      const updatedMobile = result.mobile || mobileInput.trim();
      setCustomer((prev) => (prev ? { ...prev, mobile: updatedMobile } : null));
      toast.success('Mobile number saved! Bill linking updated.');
      setIsMobileDialogOpen(false);
    } catch (err: any) {
      console.error('Error saving mobile:', err);
      toast.error(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSavingMobile(false);
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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold">
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
        <div className="w-full max-w-lg space-y-6">
          {/* Welcome Card */}
          <div className="bg-card border rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Sprout className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold tracking-tight text-foreground truncate">
                  Welcome, {customer?.name || 'Farmer'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Krushi OS Customer Account
                </p>
              </div>
            </div>

            {/* Profile Information */}
            <div className="divide-y divide-border/60 rounded-xl border bg-muted/30 p-4 space-y-3">
              {/* Full Name */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <User className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                  <span>Full Name</span>
                </div>
                <span className="text-xs font-semibold text-foreground truncate max-w-[200px]">
                  {customer?.name || '—'}
                </span>
              </div>

              {/* Email */}
              <div className="flex items-center justify-between pt-3">
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                  <span>Email</span>
                </div>
                <span className="text-xs font-medium text-foreground truncate max-w-[200px]">
                  {customer?.email || '—'}
                </span>
              </div>

              {/* Mobile Number & Linking Status */}
              <div className="flex items-start justify-between pt-3">
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                  <div>
                    <span>Mobile Number</span>
                    {customer?.mobile && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                        <Link2 className="h-3 w-3" /> Used for bill linking
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {customer?.mobile ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-foreground">
                        {formatDisplayMobile(customer.mobile)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={handleOpenMobileDialog}
                        title="Edit Mobile Number"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground italic">
                        Not added
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleOpenMobileDialog}
                        className="h-7 px-2 text-xs font-medium border-emerald-600/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add Mobile
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Coming Soon Notice */}
            <div className="rounded-xl bg-muted/40 border border-border/60 p-4 text-xs text-muted-foreground space-y-1.5 text-center">
              <p className="font-semibold text-foreground text-sm">Customer Invoices & Portal</p>
              <p className="leading-relaxed">
                Your mobile number is securely linked to your customer account. Soon you will be able to view, download, and track your purchase invoices across all Krushi OS stores.
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
        </div>
      </main>

      {/* Add/Edit Mobile Dialog */}
      <Dialog open={isMobileDialogOpen} onOpenChange={setIsMobileDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveMobile}>
            <DialogHeader>
              <DialogTitle>
                {customer?.mobile ? 'Update Mobile Number' : 'Add Mobile Number'}
              </DialogTitle>
              <DialogDescription>
                Enter your 10-digit mobile number to automatically link your bills and purchase history from Krushi OS stores.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="dialogMobile">Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dialogMobile"
                    type="tel"
                    placeholder="9876543210"
                    value={mobileInput}
                    onChange={(e) => setMobileInput(e.target.value)}
                    className="pl-9 font-mono"
                    disabled={isSavingMobile}
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Used for bill linking. Not SMS-verified.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMobileDialogOpen(false)}
                disabled={isSavingMobile}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                disabled={isSavingMobile}
              >
                {isSavingMobile ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save & Link Bills'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


