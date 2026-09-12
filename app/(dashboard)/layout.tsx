import { getAuthAndPermissions } from '@/lib/auth-helper'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { GlobalNavigationIndicator } from '@/components/layout/global-navigation-indicator'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let user;
  try {
    user = await getAuthAndPermissions();
  } catch (error: any) {
    if (
      error?.digest?.startsWith('NEXT_REDIRECT') ||
      error?.digest === 'DYNAMIC_SERVER_USAGE' ||
      error?.message?.includes('DYNAMIC_SERVER_USAGE') ||
      error?.message?.includes('Dynamic server usage')
    ) {
      throw error;
    }
    const errMsg = error instanceof Error ? error.message : String(error || 'auth_failed');
    const errCode = error?.code || error?.status || 'AUTH_ERR';
    console.error("DashboardLayout auth error [DIAGNOSTIC]:", {
      message: errMsg,
      code: errCode,
      name: error?.name,
      stack: error?.stack,
      env: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceKey: !!(
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.SUPABASE_SERVICE_KEY ||
          process.env.SUPABASE_SECRET_KEY ||
          process.env.SERVICE_ROLE_KEY
        ),
      }
    });
    redirect('/login?error=auth_failed');
  }

  if (!user) {
    console.warn("DashboardLayout: user returned from getAuthAndPermissions is null/undefined");
    redirect('/login?error=auth_failed');
  }

  return (
    <div className='flex min-h-screen w-full bg-muted/40 overflow-x-clip'>
      <Sidebar />
      <div className='flex flex-col sm:gap-4 sm:py-4 sm:pl-64 w-full min-w-0 max-w-full'>
        <Header user={user} />
        <main className='flex-1 items-start p-3 sm:px-6 sm:py-0 w-full min-w-0 max-w-full'>
          {children}
        </main>
      </div>
      <Suspense fallback={null}>
        <GlobalNavigationIndicator />
      </Suspense>
    </div>
  )
}
