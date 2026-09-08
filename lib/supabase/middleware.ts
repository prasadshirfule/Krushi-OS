import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Determine user role (Customer vs Shopkeeper)
  const isCustomerUser = user && (
    user.user_metadata?.role === 'customer' ||
    (Boolean(user.phone) && !user.email)
  )

  // 1. Redirect /shop-details to /settings
  if (pathname === '/shop-details' || pathname.startsWith('/shop-details/')) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/settings'
    return NextResponse.redirect(redirectUrl)
  }

  // 2. Root route redirection
  if (pathname === '/') {
    const redirectUrl = request.nextUrl.clone()
    if (!user) {
      redirectUrl.pathname = '/login'
    } else if (isCustomerUser) {
      redirectUrl.pathname = '/customer/dashboard'
    } else {
      redirectUrl.pathname = '/dashboard'
    }
    return NextResponse.redirect(redirectUrl)
  }

  // 3. Auth pages: redirect authenticated users to their corresponding dashboard
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/forgot-password')
  if (isAuthPage && user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = isCustomerUser ? '/customer/dashboard' : '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  // 4. Customer protected routes
  const isCustomerPath = pathname === '/customer' || pathname.startsWith('/customer/')
  if (isCustomerPath) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('type', 'customer')
      return NextResponse.redirect(redirectUrl)
    }
    if (!isCustomerUser) {
      // Shopkeeper trying to access customer routes
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard'
      return NextResponse.redirect(redirectUrl)
    }
    return supabaseResponse
  }

  // 5. Shopkeeper protected routes
  const isShopkeeperPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/billing') ||
    pathname.startsWith('/sales') ||
    pathname.startsWith('/products') ||
    pathname.startsWith('/categories') ||
    pathname.startsWith('/inventory') ||
    pathname.startsWith('/purchases') ||
    pathname.startsWith('/customers') ||
    pathname.startsWith('/suppliers') ||
    pathname.startsWith('/credit') ||
    pathname.startsWith('/payments') ||
    pathname.startsWith('/expenses') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/employees') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/audit')

  if (isShopkeeperPath) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('type', 'shopkeeper')
      return NextResponse.redirect(redirectUrl)
    }
    if (isCustomerUser) {
      // Customer trying to access shopkeeper management
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/customer/dashboard'
      return NextResponse.redirect(redirectUrl)
    }
  }

  return supabaseResponse
}
