'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  User,
  Mail,
  Lock,
  Loader2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { syncCustomerAccountAction } from '@/actions/customer-auth';

const customerRegisterSchema = z
  .object({
    fullName: z.string().min(1, 'Full name is required'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type CustomerRegisterValues = z.infer<typeof customerRegisterSchema>;

export default function CustomerRegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerRegisterValues>({
    resolver: zodResolver(customerRegisterSchema),
  });

  const onSubmit = async (data: CustomerRegisterValues) => {
    setIsLoading(true);

    try {
      const supabase = createClient();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.password,
        options: {
          data: {
            role: 'customer',
            full_name: data.fullName.trim(),
          },
        },
      });

      if (authError) {
        const msg = authError.message || 'Failed to create account';
        const lower = msg.toLowerCase();

        if (lower.includes('already registered') || lower.includes('already exists')) {
          toast.error('An account with this email already exists. Please log in instead.');
        } else if (lower.includes('password')) {
          toast.error(`Password error: ${msg}`);
        } else if (lower.includes('email')) {
          toast.error(`Email error: ${msg}`);
        } else {
          toast.error(msg);
        }
        setIsLoading(false);
        return;
      }

      if (authData?.session) {
        // Email confirmation is disabled — user gets a session immediately
        const syncRes = await syncCustomerAccountAction({
          email: data.email.trim(),
          name: data.fullName.trim(),
        });
        if (!syncRes.success) {
          console.warn('Customer account sync notice:', syncRes.error);
        }

        toast.success('Account created successfully! Redirecting...');
        router.push('/customer/dashboard');
        router.refresh();
      } else if (authData?.user) {
        // Email confirmation is enabled — show confirmation message
        setRegisteredEmail(data.email.trim());
        setEmailConfirmationSent(true);
        toast.success('Account created! Please check your email to verify.');
      } else {
        toast.error('Unable to create account. Please try again.');
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('Customer registration error:', err);
      toast.error(err.message || 'An unexpected error occurred.');
      setIsLoading(false);
    }
  };

  // Email confirmation sent screen
  if (emailConfirmationSent) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Check your email
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Account created successfully. Please check your email at{' '}
            <strong className="text-foreground">{registeredEmail}</strong> and
            verify your account before logging in.
          </p>
        </div>

        <Link href="/login?type=customer">
          <Button
            variant="outline"
            className="w-full mt-4 font-semibold py-5"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/login?type=customer"
        className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground gap-1 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Customer Login
      </Link>

      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-1">
          <ShieldCheck className="h-3.5 w-3.5" /> Farmer & Customer
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          Create Customer Account
        </h2>
        <p className="text-sm text-muted-foreground">
          Sign up to view your bills, payments & purchase history
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-sm font-medium">
            Full Name
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="fullName"
              type="text"
              placeholder="Enter your full name"
              {...register('fullName')}
              className="pl-9"
              disabled={isLoading}
              autoFocus
            />
          </div>
          {errors.fullName && (
            <p className="text-sm text-destructive">
              {errors.fullName.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              {...register('email')}
              className="pl-9"
              disabled={isLoading}
              autoComplete="email"
            />
          </div>
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
              className="pl-9"
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>
          {errors.password && (
            <p className="text-sm text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              {...register('confirmPassword')}
              className="pl-9"
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-5 shadow-xs"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Account...
            </>
          ) : (
            <>
              Create Account <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <div className="space-y-3 text-center text-sm pt-2 border-t border-border">
        <div>
          <span className="text-muted-foreground">
            Already have an account?{' '}
          </span>
          <Link
            href="/login?type=customer"
            className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
          >
            Sign in
          </Link>
        </div>

        <div className="pt-1">
          <Link
            href="/login?type=shopkeeper"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Are you an agricultural store owner?{' '}
            <span className="font-semibold text-primary underline">
              Shopkeeper Login
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
