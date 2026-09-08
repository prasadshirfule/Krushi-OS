'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Lock,
  Loader2,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Listen for the PASSWORD_RECOVERY auth event from the Supabase recovery link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoverySession(true);
        setIsCheckingSession(false);
      }
    });

    // Also check if we already have a session (recovery link may have already been processed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsRecoverySession(true);
      }
      setIsCheckingSession(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword.trim()) {
      toast.error('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(error.message || 'Failed to update password.');
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      toast.success('Password updated successfully!');

      // Sign out after password reset and redirect to login
      await supabase.auth.signOut();

      setTimeout(() => {
        router.push('/login');
        router.refresh();
      }, 2000);
    } catch (err: any) {
      console.error('Password reset error:', err);
      toast.error(err.message || 'An unexpected error occurred.');
      setIsLoading(false);
    }
  };

  // Loading state while checking for recovery session
  if (isCheckingSession) {
    return (
      <div className="space-y-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">
          Verifying reset link...
        </p>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          Password Updated
        </h2>
        <p className="text-sm text-muted-foreground">
          Your password has been updated successfully. Redirecting to login...
        </p>
        <Link href="/login">
          <Button variant="outline" className="w-full mt-4 font-semibold py-5">
            <ArrowLeft className="mr-2 h-4 w-4" /> Go to Login
          </Button>
        </Link>
      </div>
    );
  }

  // No recovery session found
  if (!isRecoverySession) {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Invalid Reset Link
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This password reset link is invalid or has expired. Please request a
          new password reset.
        </p>
        <Link href="/forgot-password">
          <Button variant="outline" className="w-full mt-4 font-semibold py-5">
            Request New Reset Link
          </Button>
        </Link>
        <Link
          href="/login"
          className="block text-sm text-primary hover:underline font-medium"
        >
          Back to Login
        </Link>
      </div>
    );
  }

  // Reset password form
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">
          Reset Your Password
        </h2>
        <p className="text-sm text-muted-foreground">
          Enter your new password below
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword" className="text-sm font-medium">
            New Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="newPassword"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="pl-9"
              disabled={isLoading}
              autoFocus
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Must be at least 6 characters
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmNewPassword" className="text-sm font-medium">
            Confirm New Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="confirmNewPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="pl-9"
              disabled={isLoading}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary/90 font-semibold py-5"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating Password...
            </>
          ) : (
            'Update Password'
          )}
        </Button>
      </form>

      <div className="text-center text-sm">
        <Link
          href="/login"
          className="text-primary hover:underline font-medium"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
