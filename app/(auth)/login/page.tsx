'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Lock, 
  Mail, 
  Loader2, 
  ArrowRight, 
  Store, 
  User, 
  Phone, 
  KeyRound, 
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { normalizeIndianMobile, formatDisplayMobile } from '@/lib/phone-utils';
import { syncCustomerAccountAction } from '@/actions/customer-auth';

type LoginRole = 'select' | 'shopkeeper' | 'customer';
type CustomerAuthStep = 'phone' | 'otp';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = searchParams.get('type');

  const [role, setRole] = useState<LoginRole>('select');

  // Shopkeeper state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isShopkeeperLoading, setIsShopkeeperLoading] = useState(false);

  // Customer state
  const [mobileInput, setMobileInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [customerStep, setCustomerStep] = useState<CustomerAuthStep>('phone');
  const [isCustomerLoading, setIsCustomerLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [smsConfigError, setSmsConfigError] = useState<string | null>(null);

  useEffect(() => {
    if (initialType === 'shopkeeper') {
      setRole('shopkeeper');
    } else if (initialType === 'customer') {
      setRole('customer');
    }
  }, [initialType]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const interval = setInterval(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCountdown]);

  // --- SHOPKEEPER SUBMIT ---
  const handleShopkeeperSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.error('Please enter both email and password.');
      return;
    }

    setIsShopkeeperLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        toast.error(error.message || 'Invalid email or password');
        setIsShopkeeperLoading(false);
        return;
      }

      if (data?.session) {
        toast.success('Signed in successfully! Redirecting...');
        router.push('/dashboard');
        router.refresh();
      } else {
        toast.error('Could not start session. Please try again.');
        setIsShopkeeperLoading(false);
      }
    } catch (err: any) {
      console.error('Shopkeeper login error:', err);
      toast.error(err.message || 'An unexpected error occurred during login.');
      setIsShopkeeperLoading(false);
    }
  };

  // --- CUSTOMER SEND OTP ---
  const handleCustomerSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmsConfigError(null);

    const normalized = normalizeIndianMobile(mobileInput);
    if (!normalized) {
      toast.error('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    setIsCustomerLoading(true);

    try {
      const supabase = createClient();
      const fullPhoneNumber = `+91${normalized}`;

      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhoneNumber,
        options: {
          data: {
            role: 'customer',
            phone: normalized,
          }
        }
      });

      if (error) {
        console.error('Supabase Phone Auth Error:', error);
        const errMsg = error.message || 'Failed to send OTP';
        const lower = errMsg.toLowerCase();

        // Check if phone auth is explicitly disabled in Supabase dashboard
        if (
          lower.includes('phone provider is disabled') ||
          lower.includes('sms provider is not configured') ||
          (error as any).code === 'phone_provider_disabled'
        ) {
          const configMsg = 'Phone authentication is disabled in Supabase. Please enable Phone Provider in Supabase Dashboard (Authentication > Providers > Phone).';
          setSmsConfigError(configMsg);
          toast.error(configMsg);
        } else {
          setSmsConfigError(null);
          toast.error(errMsg);
        }
        setIsCustomerLoading(false);
        return;
      }

      toast.success(`OTP sent to ${formatDisplayMobile(normalized)}`);
      setCustomerStep('otp');
      setResendCountdown(30);
      setIsCustomerLoading(false);
    } catch (err: any) {
      console.error('Customer Send OTP error:', err);
      toast.error(err.message || 'An unexpected error occurred while sending OTP.');
      setIsCustomerLoading(false);
    }
  };

  // --- CUSTOMER VERIFY OTP ---
  const handleCustomerVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalized = normalizeIndianMobile(mobileInput);
    if (!normalized) {
      toast.error('Invalid mobile number. Please restart verification.');
      setCustomerStep('phone');
      return;
    }

    const trimmedOtp = otpInput.trim();
    if (!trimmedOtp || trimmedOtp.length < 6) {
      toast.error('Please enter the complete 6-digit OTP.');
      return;
    }

    setIsCustomerLoading(true);

    try {
      const supabase = createClient();
      const fullPhoneNumber = `+91${normalized}`;

      const { data, error } = await supabase.auth.verifyOtp({
        phone: fullPhoneNumber,
        token: trimmedOtp,
        type: 'sms',
      });

      if (error) {
        toast.error(error.message || 'Invalid or expired OTP. Please try again.');
        setIsCustomerLoading(false);
        return;
      }

      if (data?.session) {
        // Sync/create customer_accounts record and auto-link shop records via migration 012 trigger
        const syncRes = await syncCustomerAccountAction(normalized);
        if (!syncRes.success) {
          console.warn('Customer account sync notice:', syncRes.error);
        }

        toast.success('Mobile verified successfully! Redirecting...');
        router.push('/customer/dashboard');
        router.refresh();
      } else {
        toast.error('Could not establish customer session. Please try again.');
        setIsCustomerLoading(false);
      }
    } catch (err: any) {
      console.error('Customer Verify OTP error:', err);
      toast.error(err.message || 'An unexpected error occurred during OTP verification.');
      setIsCustomerLoading(false);
    }
  };

  // ========================================================
  // 1. ROLE SELECTION SCREEN
  // ========================================================
  if (role === 'select') {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-1.5">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome to Krushi OS</h2>
          <p className="text-sm text-muted-foreground">
            Choose what type of account you want to access
          </p>
        </div>

        <div className="grid gap-4">
          {/* Shopkeeper Option */}
          <div 
            onClick={() => setRole('shopkeeper')}
            className="group relative flex flex-col p-5 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-primary/50 transition-all cursor-pointer shadow-xs hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Store className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                    🏪 Shopkeeper
                  </h3>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Manage your shop, billing, inventory & customers
                </p>
              </div>
            </div>
            <Button
              type="button"
              className="w-full mt-4 bg-primary hover:bg-primary/90 font-semibold"
              onClick={(e) => {
                e.stopPropagation();
                setRole('shopkeeper');
              }}
            >
              Continue as Shopkeeper
            </Button>
          </div>

          {/* Customer Option */}
          <div 
            onClick={() => setRole('customer')}
            className="group relative flex flex-col p-5 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-emerald-500/50 transition-all cursor-pointer shadow-xs hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <User className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    👨‍🌾 Customer
                  </h3>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  View your bills, payments & purchase history
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full mt-4 border-emerald-600/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-semibold"
              onClick={(e) => {
                e.stopPropagation();
                setRole('customer');
              }}
            >
              Continue as Customer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ========================================================
  // 2. SHOPKEEPER LOGIN FLOW (PRESERVED)
  // ========================================================
  if (role === 'shopkeeper') {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setRole('select')}
          className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground gap-1 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to account selection
        </button>

        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-1">
            <Store className="h-3.5 w-3.5" /> Shopkeeper Portal
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Sign in to your account</h2>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access your KRUSHI OS store
          </p>
        </div>

        <form onSubmit={handleShopkeeperSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="pl-9"
                disabled={isShopkeeperLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline font-medium">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="pl-9"
                disabled={isShopkeeperLoading}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 font-semibold py-5"
            disabled={isShopkeeperLoading}
          >
            {isShopkeeperLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign in as Shopkeeper <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <div className="space-y-3 text-center text-sm pt-2 border-t border-border">
          <div>
            <span className="text-muted-foreground">Don&apos;t have a shop account? </span>
            <Link href="/register" className="text-primary hover:underline font-semibold">
              Create an account
            </Link>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setRole('customer')}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Are you a farmer/customer? <span className="font-semibold text-primary underline">Customer Login</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========================================================
  // 3. CUSTOMER LOGIN FLOW (MOBILE + REAL OTP)
  // ========================================================
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => {
          if (customerStep === 'otp') {
            setCustomerStep('phone');
          } else {
            setRole('select');
          }
        }}
        className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground gap-1 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {customerStep === 'otp' ? 'Change Mobile Number' : 'Back to account selection'}
      </button>

      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-1">
          <ShieldCheck className="h-3.5 w-3.5" /> Farmer & Customer Login
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Customer Login</h2>
        <p className="text-sm text-muted-foreground">
          {customerStep === 'phone'
            ? 'Enter your 10-digit mobile number to access your bills'
            : `Enter the 6-digit OTP sent to ${formatDisplayMobile(mobileInput)}`}
        </p>
      </div>

      {smsConfigError && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs leading-relaxed">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">SMS Provider Notice</p>
            <p>{smsConfigError}</p>
          </div>
        </div>
      )}

      {customerStep === 'phone' ? (
        <form onSubmit={handleCustomerSendOtp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mobile" className="text-sm font-medium">Mobile Number</Label>
            <div className="relative flex items-center">
              <div className="absolute left-3 flex items-center gap-1.5 text-muted-foreground pointer-events-none text-sm font-semibold border-r border-border pr-2.5">
                <span>🇮🇳 +91</span>
              </div>
              <Input
                id="mobile"
                type="tel"
                placeholder="98765 43210"
                value={mobileInput}
                onChange={(e) => setMobileInput(e.target.value)}
                required
                autoComplete="tel"
                className="pl-24 text-base font-mono tracking-wide"
                disabled={isCustomerLoading}
                autoFocus
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              We will send a 6-digit verification code to this mobile number.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-5 shadow-xs"
            disabled={isCustomerLoading}
          >
            {isCustomerLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending OTP...
              </>
            ) : (
              <>
                Send OTP <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleCustomerVerifyOtp} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="otp" className="text-sm font-medium">6-Digit Verification Code</Label>
              <button
                type="button"
                onClick={() => setCustomerStep('phone')}
                className="text-xs text-primary hover:underline"
              >
                Change Number
              </button>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="otp"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                required
                autoComplete="one-time-code"
                className="pl-9 text-center font-mono tracking-widest text-lg font-bold"
                disabled={isCustomerLoading}
                autoFocus
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-5 shadow-xs"
            disabled={isCustomerLoading}
          >
            {isCustomerLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying OTP...
              </>
            ) : (
              <>
                Verify OTP <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>

          <div className="flex items-center justify-center pt-2">
            {resendCountdown > 0 ? (
              <span className="text-xs text-muted-foreground">
                Resend code in <strong className="text-foreground">{resendCountdown}s</strong>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleCustomerSendOtp}
                disabled={isCustomerLoading}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
              >
                <RefreshCw className="h-3 w-3" /> Resend OTP
              </button>
            )}
          </div>
        </form>
      )}

      <div className="text-center text-sm pt-2 border-t border-border">
        <button
          type="button"
          onClick={() => setRole('shopkeeper')}
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          Are you an agricultural store owner? <span className="font-semibold text-primary underline">Shopkeeper Login</span>
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <LoginFormContent />
    </Suspense>
  );
}
