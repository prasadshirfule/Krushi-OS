'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, Mail, Loader2, ArrowRight, Sprout, Store, ArrowLeft } from 'lucide-react';
import { verifyPortalAuthorizationAction } from '@/actions/customer-auth';

const GENERIC_LOGIN_ERROR = 'Invalid email or password.';

function CustomerLoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const confirmed = searchParams.get('confirmed');
    if (confirmed === 'true') {
      toast.success('Email verified successfully! Please sign in to continue.', {
        id: 'customer-email-confirmed-toast',
      });
    }

    const err = searchParams.get('error');
    if (err) {
      try {
        const supabase = createClient();
        supabase.auth.signOut().catch(() => {});
      } catch {}
      if (err === 'confirmation_failed') {
        toast.error('Email confirmation link was invalid or has expired. Please try signing in or register again.', {
          id: 'auth-error-toast',
        });
      } else {
        toast.error(GENERIC_LOGIN_ERROR, {
          id: 'auth-error-toast',
        });
      }
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      toast.error(GENERIC_LOGIN_ERROR);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        console.warn('Customer login failed:', error.message);
        if (error.message?.toLowerCase().includes('email not confirmed')) {
          toast.error('Please check your email and verify your account before logging in.');
        } else {
          toast.error(GENERIC_LOGIN_ERROR);
        }
        setIsLoading(false);
        return;
      }

      if (data?.session) {
        // Enforce customer portal authorization
        const verifyRes = await verifyPortalAuthorizationAction('customer');
        if (!verifyRes.authorized) {
          await supabase.auth.signOut();
          toast.error(GENERIC_LOGIN_ERROR);
          setIsLoading(false);
          return;
        }

        toast.success('Signed in successfully! Redirecting...');
        window.location.href = '/customer/dashboard';
      } else {
        toast.error(GENERIC_LOGIN_ERROR);
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('Customer login error:', err);
      toast.error(GENERIC_LOGIN_ERROR);
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error('Please enter your email address first.');
      return;
    }

    setIsResetting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.warn('Password reset request error:', error.message);
      }
      toast.success('If this email is registered, password reset instructions have been sent.');
    } catch (err: any) {
      console.error('Password reset error:', err);
      toast.success('If this email is registered, password reset instructions have been sent.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 mb-2">
            <Sprout className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Farmer & Customer Portal
          </h1>
          <p className="text-sm text-muted-foreground">
            Access your purchase history, bills, khata, and receipts
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="customer-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="customer-email"
                  type="email"
                  placeholder="farmer@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                  autoComplete="email"
                  className="pl-9 h-11"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="customer-password">Password</Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isResetting || isLoading}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  {isResetting ? 'Sending link...' : 'Forgot password?'}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="customer-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  autoComplete="current-password"
                  className="pl-9 h-11"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in as Farmer
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t text-center space-y-3">
            <p className="text-xs text-muted-foreground">
              Don&apos;t have a farmer account yet?{' '}
              <Link
                href="/register/customer"
                className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
              >
                Register as Farmer
              </Link>
            </p>

            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Store className="h-3.5 w-3.5 mr-1 text-primary" />
                Are you a Shop Owner? Go to Shopkeeper Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerLoginPage() {
  return (
    <Suspense fallback={null}>
      <CustomerLoginForm />
    </Suspense>
  );
}
