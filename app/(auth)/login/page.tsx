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
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { syncCustomerAccountAction } from '@/actions/customer-auth';

type LoginRole = 'select' | 'shopkeeper' | 'customer';

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
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPassword, setCustomerPassword] = useState('');
  const [isCustomerLoading, setIsCustomerLoading] = useState(false);

  useEffect(() => {
    if (initialType === 'shopkeeper') {
      setRole('shopkeeper');
    } else if (initialType === 'customer') {
      setRole('customer');
    }
  }, [initialType]);

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

  // --- CUSTOMER LOGIN (EMAIL + PASSWORD) ---
  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerEmail.trim()) {
      toast.error('Please enter your email address.');
      return;
    }

    if (!customerPassword.trim()) {
      toast.error('Please enter your password.');
      return;
    }

    setIsCustomerLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: customerEmail.trim(),
        password: customerPassword,
      });

      if (error) {
        const msg = error.message || 'Login failed';
        const lower = msg.toLowerCase();

        if (lower.includes('invalid login credentials') || lower.includes('invalid email or password')) {
          toast.error('Invalid email or password. Please try again.');
        } else if (lower.includes('email not confirmed') || lower.includes('not confirmed')) {
          toast.error('Email not verified. Please check your email and verify your account before logging in.');
        } else if (lower.includes('too many requests') || lower.includes('rate limit')) {
          toast.error('Too many login attempts. Please wait a moment and try again.');
        } else {
          toast.error(msg);
        }
        setIsCustomerLoading(false);
        return;
      }

      if (data?.session) {
        // Sync customer account after successful login
        const syncRes = await syncCustomerAccountAction({
          email: customerEmail.trim(),
        });
        if (!syncRes.success) {
          console.warn('Customer account sync notice:', syncRes.error);
        }

        toast.success('Signed in successfully! Redirecting...');
        router.push('/customer/dashboard');
        router.refresh();
      } else {
        toast.error('Could not establish session. Please try again.');
        setIsCustomerLoading(false);
      }
    } catch (err: any) {
      console.error('Customer login error:', err);
      toast.error(err.message || 'An unexpected error occurred during login.');
      setIsCustomerLoading(false);
    }
  };

  // --- CUSTOMER FORGOT PASSWORD ---
  const handleCustomerForgotPassword = async () => {
    if (!customerEmail.trim()) {
      toast.error('Please enter your email address first, then click Forgot Password.');
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(customerEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error(error.message || 'Failed to send password reset email.');
        return;
      }

      toast.success('Password reset email sent! Please check your inbox.');
    } catch (err: any) {
      console.error('Forgot password error:', err);
      toast.error(err.message || 'An unexpected error occurred.');
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
                    👨‍🌾 Farmer & Customer
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
              Continue as Farmer & Customer
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
  // 3. CUSTOMER LOGIN FLOW (EMAIL + PASSWORD)
  // ========================================================
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
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-1">
          <ShieldCheck className="h-3.5 w-3.5" /> Farmer & Customer Login
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Customer Login</h2>
        <p className="text-sm text-muted-foreground">
          Enter your email and password to access your bills
        </p>
      </div>

      <form onSubmit={handleCustomerLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="customerEmail" className="text-sm font-medium">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="customerEmail"
              type="email"
              placeholder="name@example.com"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              required
              autoComplete="email"
              className="pl-9"
              disabled={isCustomerLoading}
              autoFocus
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="customerPassword" className="text-sm font-medium">Password</Label>
            <button
              type="button"
              onClick={handleCustomerForgotPassword}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
            >
              Forgot Password?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="customerPassword"
              type="password"
              placeholder="••••••••"
              value={customerPassword}
              onChange={(e) => setCustomerPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="pl-9"
              disabled={isCustomerLoading}
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
              Signing in...
            </>
          ) : (
            <>
              Login <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <div className="space-y-3 text-center text-sm pt-2 border-t border-border">
        <div>
          <span className="text-muted-foreground">Don&apos;t have an account? </span>
          <Link
            href="/register/customer"
            className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
          >
            Create Customer Account
          </Link>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => setRole('shopkeeper')}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Are you an agricultural store owner? <span className="font-semibold text-primary underline">Shopkeeper Login</span>
          </button>
        </div>
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
