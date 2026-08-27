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

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' })
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema)
  })

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      toast.error(error.message || 'Failed to login')
      setIsLoading(false)
    } else {
      toast.success('Login successful')
      router.push('/dashboard')
    }
  }

  return (
    <div className='space-y-6'>
      <div className='text-center'>
        <h2 className='text-2xl font-semibold'>Welcome back</h2>
        <p className='text-sm text-muted-foreground'>Enter your credentials to access your account</p>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='email'>Email</Label>
          <Input id='email' type='email' placeholder='name@example.com' {...register('email')} />
          {errors.email && <p className='text-sm text-destructive'>{errors.email.message}</p>}
        </div>
        
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <Label htmlFor='password'>Password</Label>
            <Link href='/forgot-password' className='text-sm text-primary hover:underline'>Forgot password?</Link>
          </div>
          <Input id='password' type='password' {...register('password')} />
          {errors.password && <p className='text-sm text-destructive'>{errors.password.message}</p>}
        </div>

        <Button type='submit' className='w-full' disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign in'}
        </Button>

        <div className='relative flex py-2 items-center'>
          <div className='flex-grow border-t border-muted'></div>
          <span className='flex-shrink mx-4 text-xs text-muted-foreground uppercase'>Or</span>
          <div className='flex-grow border-t border-muted'></div>
        </div>

        <Button 
          type='button' 
          variant='outline' 
          className='w-full border-green-600 text-green-700 hover:bg-green-50 font-semibold'
          onClick={() => {
            document.cookie = 'krushi_demo_session=true; path=/; max-age=86400';
            toast.success('Entering Demo Mode as Admin');
            router.push('/dashboard');
          }}
        >
          ⚡ Quick Demo Login (No Setup Needed)
        </Button>
      </form>

      <div className='text-center text-sm'>
        <span className='text-muted-foreground'>Don&apos;t have an account? </span>
        <Link href='/register' className='text-primary hover:underline font-medium'>Create account</Link>
      </div>
    </div>
  )
}
