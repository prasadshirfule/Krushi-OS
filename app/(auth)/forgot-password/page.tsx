'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const supabase = createClient()
  
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema)
  })

  const onSubmit = async (data: ForgotPasswordValues) => {
    setIsLoading(true)
    
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      toast.error(error.message || 'Failed to send reset email')
      setIsLoading(false)
    } else {
      setIsSent(true)
      toast.success('Password reset email sent!')
      setIsLoading(false)
    }
  }

  if (isSent) {
    return (
      <div className='space-y-6 text-center'>
        <h2 className='text-2xl font-semibold'>Check your email</h2>
        <p className='text-sm text-muted-foreground'>
          We have sent a password reset link to your email address.
        </p>
        <Link href='/login'>
          <Button className='w-full mt-4' variant='outline'>Back to login</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='text-center'>
        <h2 className='text-2xl font-semibold'>Forgot password?</h2>
        <p className='text-sm text-muted-foreground'>Enter your email to receive a password reset link</p>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='email'>Email</Label>
          <Input id='email' type='email' placeholder='name@example.com' {...register('email')} />
          {errors.email && <p className='text-sm text-destructive'>{errors.email.message}</p>}
        </div>

        <Button type='submit' className='w-full' disabled={isLoading}>
          {isLoading ? 'Sending link...' : 'Send reset link'}
        </Button>
      </form>

      <div className='text-center text-sm'>
        <Link href='/login' className='text-primary hover:underline font-medium'>Back to login</Link>
      </div>
    </div>
  )
}
