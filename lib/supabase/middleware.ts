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

  // Helper to construct redirect responses that carry any refreshed Supabase cookies
  const redirectWithCookies = (targetPath: string) => {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = targetPath
    redirectUrl.search = ''
    const res = NextResponse.redirect(redirectUrl)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      res.cookies.set(cookie.name, cookie.value, cookie)
    })
    return res
  }

  // 1. Redirect /shop-details to /settings
  if (pathname === '/shop-details' || pathname.startsWith('/shop-details/')) {
    console.log(`[AUTH DEBUG] pathname=${pathname} authenticated=${!!user} portal=${isCustomerUser ? 'customer' : 'shopkeeper'} authorized=true redirect=/settings`)
    return redirectWithCookies('/settings')
  }

  // 2. Public auth pages MUST render directly without redirects (prevents circular loops)
  // /login, /login?error=auth_failed, /customer/login, /customer/login?error=auth_failed,
  // /register, /register/customer, /forgot-password, /reset-password
  const isPublicAuthPage =
    pathname === '/login' ||
    pathname === '/customer/login' ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/auth')

  if (isPublicAuthPage) {
    console.log(`[AUTH DEBUG] pathname=${pathname} authenticated=${!!user} portal=${isCustomerUser ? 'customer' : 'shopkeeper'} authorized=true redirect=none`)
    return supabaseResponse
  }

  // 3. Root route redirection
  if (pathname === '/') {
    const target = !user ? '/login' : isCustomerUser ? '/customer/dashboard' : '/dashboard'
    console.log(`[AUTH DEBUG] pathname=${pathname} authenticated=${!!user} portal=${isCustomerUser ? 'customer' : 'shopkeeper'} authorized=true redirect=${target}`)
    return redirectWithCookies(target)
  }

  // 4. Customer protected routes
  // Exclude public customer login and public customer bill print view
  const isCustomerPath =
    pathname === '/customer' ||
    (pathname.startsWith('/customer/') && pathname !== '/customer/login' && !pathname.startsWith('/customer/bills/'))

  if (isCustomerPath) {
    if (!user) {
      console.log(`[AUTH DEBUG] pathname=${pathname} authenticated=false portal=customer authorized=false redirect=/customer/login`)
      return redirectWithCookies('/customer/login')
    }
    if (!isCustomerUser) {
      // Authenticated shopkeeper attempting customer routes:
      // Redirect safely to shopkeeper portal without role leakage
      console.log(`[AUTH DEBUG] pathname=${pathname} authenticated=true portal=shopkeeper authorized=false redirect=/dashboard`)
      return redirectWithCookies('/dashboard')
    }
    console.log(`[AUTH DEBUG] pathname=${pathname} authenticated=true portal=customer authorized=true redirect=none`)
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
      console.log(`[AUTH DEBUG] pathname=${pathname} authenticated=false portal=shopkeeper authorized=false redirect=/login`)
      return redirectWithCookies('/login')
    }
    if (isCustomerUser) {
      // Authenticated customer attempting shopkeeper routes:
      // Redirect safely to customer portal without role leakage
      console.log(`[AUTH DEBUG] pathname=${pathname} authenticated=true portal=customer authorized=false redirect=/customer/dashboard`)
      return redirectWithCookies('/customer/dashboard')
    }
    console.log(`[AUTH DEBUG] pathname=${pathname} authenticated=true portal=shopkeeper authorized=true redirect=none`)
    return supabaseResponse
  }

  return supabaseResponse
}
