'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { provisionShopkeeperAccountAction } from '@/actions/customer-auth'

import { CheckCircle2, ArrowLeft, Mail } from 'lucide-react'

const registerSchema = z.object({
  fullName: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  shopName: z.string().min(2, 'Shop name is required'),
  phone: z.string().min(10, 'Valid phone number is required')
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type RegisterFormValues = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const router = useRouter()
  const supabase = createClient()
  
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema)
  })

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true)
    
    const origin = typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://krushios.vercel.app';

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email.trim(),
      password: data.password,
      options: {
        emailRedirectTo: `${origin}/auth/confirm?next=/login?confirmed=true`,
        data: {
          full_name: data.fullName.trim(),
          phone: data.phone.trim(),
          shop_name: data.shopName.trim(),
          role: 'shopkeeper',
        }
      }
    })

    if (authError) {
      const msg = authError.message || 'Failed to register';
      const lower = msg.toLowerCase();
      if (lower.includes('already registered') || lower.includes('already exists') || lower.includes('duplicate')) {
        toast.error('This email is already registered. Please use a different email address.');
      } else {
        toast.error(msg);
      }
      setIsLoading(false);
      return;
    }

    if (authData?.user && (!authData.user.identities || authData.user.identities.length === 0)) {
      toast.error('This email is already registered. Please use a different email address.');
      setIsLoading(false);
      return;
    }

    if (authData?.session) {
      // Direct session granted (email confirmation disabled) — immediately provision shopkeeper
      const provRes = await provisionShopkeeperAccountAction({
        shopName: data.shopName.trim(),
        fullName: data.fullName.trim(),
        phone: data.phone.trim(),
      });

      if (!provRes.success) {
        console.error('Shopkeeper registration provisioning failed:', provRes.error);
        toast.error('Failed to set up shop profile. Please try signing in or contact support.');
        setIsLoading(false);
        return;
      }

      toast.success('Account created successfully! Welcome to KRUSHI OS.');
      window.location.href = '/dashboard';
    } else if (authData?.user) {
      // Email confirmation required — do NOT attempt shop provisioning yet
      setRegisteredEmail(data.email.trim());
      setEmailConfirmationSent(true);
      toast.success('Account created. Please check your email to verify your account.');
      setIsLoading(false);
    } else {
      toast.error('Unable to create account. Please try again.');
      setIsLoading(false);
    }
  }

  if (emailConfirmationSent) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Check your email
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Account created. Please check your email to verify your account. We sent a verification link to{' '}
            <strong className="text-foreground">{registeredEmail}</strong>.
          </p>
        </div>

        <div className="pt-2">
          <Link href="/login">
            <Button variant="outline" className="w-full font-semibold py-5">
              <ArrowLeft className="mr-2 h-4 w-4" /> Go to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='text-center'>
        <h2 className='text-2xl font-semibold'>Create an account</h2>
        <p className='text-sm text-muted-foreground'>Start managing your shop with KRUSHI OS</p>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='fullName'>Full Name</Label>
          <Input id='fullName' placeholder='John Doe' {...register('fullName')} />
          {errors.fullName && <p className='text-sm text-destructive'>{errors.fullName.message}</p>}
        </div>

        <div className='space-y-2'>
          <Label htmlFor='shopName'>Shop Name</Label>
          <Input id='shopName' placeholder='Kisan Agro Center' {...register('shopName')} />
          {errors.shopName && <p className='text-sm text-destructive'>{errors.shopName.message}</p>}
        </div>

        <div className='space-y-2'>
          <Label htmlFor='phone'>Phone Number</Label>
          <Input id='phone' type='tel' placeholder='9876543210' {...register('phone')} />
          {errors.phone && <p className='text-sm text-destructive'>{errors.phone.message}</p>}
        </div>

        <div className='space-y-2'>
          <Label htmlFor='email'>Email</Label>
          <Input id='email' type='email' placeholder='name@example.com' {...register('email')} />
          {errors.email && <p className='text-sm text-destructive'>{errors.email.message}</p>}
        </div>
        
        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='password'>Password</Label>
            <Input id='password' type='password' {...register('password')} />
            {errors.password && <p className='text-sm text-destructive'>{errors.password.message}</p>}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='confirmPassword'>Confirm Password</Label>
            <Input id='confirmPassword' type='password' {...register('confirmPassword')} />
            {errors.confirmPassword && <p className='text-sm text-destructive'>{errors.confirmPassword.message}</p>}
          </div>
        </div>

        <Button type='submit' className='w-full' disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      <div className='text-center text-sm'>
        <span className='text-muted-foreground'>Already have an account? </span>
        <Link href='/login' className='text-primary hover:underline font-medium'>Sign in</Link>
      </div>
    </div>
  )
}
