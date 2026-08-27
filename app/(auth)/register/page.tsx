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
  const router = useRouter()
  const supabase = createClient()
  
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema)
  })

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true)
    
    // Create user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          phone: data.phone,
        }
      }
    })

    if (authError) {
      toast.error(authError.message || 'Failed to register')
      setIsLoading(false)
      return
    }

    if (authData.user) {
      // In a real application, you'd insert a shop record and map user to shop
      // We will assume a trigger handles it or do it here if tables are available.
      // For now, registration success:
      toast.success('Registration successful! Please check your email to verify.')
      router.push('/login')
    }
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
