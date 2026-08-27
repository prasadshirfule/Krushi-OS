import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { GlobalNavigationIndicator } from '@/components/layout/global-navigation-indicator'
import { Suspense } from 'react'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const effectiveUser = user || {
    id: 'demo-admin-id',
    email: 'admin@krushios.com',
    user_metadata: { role: 'admin', full_name: 'Krushi Admin' }
  }

  return (
    <div className='flex min-h-screen w-full bg-muted/40'>
      <Sidebar />
      <div className='flex flex-col sm:gap-4 sm:py-4 sm:pl-64 w-full'>
        <Header user={effectiveUser} />
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
