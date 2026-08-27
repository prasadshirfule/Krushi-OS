import React from 'react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 p-4'>
      <div className='mb-8 flex flex-col items-center'>
        <div className='bg-primary text-primary-foreground p-3 rounded-full mb-4'>
          <span className='text-3xl'>🌾</span>
        </div>
        <h1 className='text-3xl font-bold tracking-tight text-foreground'>KRUSHI OS</h1>
        <p className='text-muted-foreground mt-2 text-center max-w-sm'>Smart Billing & Management System for Agricultural Shops</p>
      </div>
      <div className='w-full max-w-md bg-card border shadow-lg rounded-xl p-8'>
        {children}
      </div>
    </div>
  )
}
