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
  // Relies solely on user_metadata.role set during registration/signup
  const isCustomerUser = user && (
    user.user_metadata?.role === 'customer'
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
  // Public auth pages: /login, /customer/login, /register, /forgot-password
  // Exception: /reset-password must remain accessible during password recovery sessions
  // Do NOT redirect Server Action requests or non-GET requests (e.g. verifyPortalAuthorizationAction)
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/customer/login' ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password')
  const isResetPasswordPage = pathname.startsWith('/reset-password')
  const isServerAction = request.headers.has('next-action') || request.headers.get('accept')?.includes('text/x-component') || request.method !== 'GET'
  if (isAuthPage && !isResetPasswordPage && user && !isServerAction) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = isCustomerUser ? '/customer/dashboard' : '/dashboard'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  // 4. Customer protected routes
  // Exclude public customer login and public customer bill print view
  const isCustomerPath =
    pathname === '/customer' ||
    (pathname.startsWith('/customer/') && pathname !== '/customer/login' && !pathname.startsWith('/customer/bills/'))

  if (isCustomerPath) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/customer/login'
      redirectUrl.search = ''
      return NextResponse.redirect(redirectUrl)
    }
    if (!isCustomerUser) {
      // Authenticated shopkeeper attempting customer routes:
      // Redirect safely to shopkeeper portal without role leakage
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/dashboard'
      redirectUrl.search = ''
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
      redirectUrl.search = ''
      return NextResponse.redirect(redirectUrl)
    }
    if (isCustomerUser) {
      // Authenticated customer attempting shopkeeper routes:
      // Redirect safely to customer portal without role leakage
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/customer/dashboard'
      redirectUrl.search = ''
      return NextResponse.redirect(redirectUrl)
    }
  }

  return supabaseResponse
}
