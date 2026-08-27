import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { cookies } from 'next/headers'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const cookieStore = await cookies()
  const isDemo = cookieStore.get('krushi_demo_session')?.value === 'true'
  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

  const effectiveUser = user || ((isDemo || isPlaceholder) ? {
    id: 'demo-admin-id',
    email: 'admin@krushios.com',
    user_metadata: { role: 'admin', full_name: 'Demo Admin' }
  } : null)

  if (!effectiveUser) {
    redirect('/login')
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
    </div>
  )
}
