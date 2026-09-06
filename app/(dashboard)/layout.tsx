import { getAuthAndPermissions } from '@/lib/auth-helper'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { GlobalNavigationIndicator } from '@/components/layout/global-navigation-indicator'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let user;
  try {
    user = await getAuthAndPermissions();
  } catch (error) {
    redirect('/login');
  }

  if (!user) {
    redirect('/login');
  }

  return (
    <div className='flex min-h-screen w-full bg-muted/40'>
      <Sidebar />
      <div className='flex flex-col sm:gap-4 sm:py-4 sm:pl-64 w-full'>
        <Header user={user} />
        <main className='flex-1 items-start p-4 sm:px-6 sm:py-0'>
          {children}
        </main>
      </div>
      <Suspense fallback={null}>
        <GlobalNavigationIndicator />
      </Suspense>
    </div>
  )
}
