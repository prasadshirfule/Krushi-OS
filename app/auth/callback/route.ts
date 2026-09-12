import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') || '/login?confirmed=true';
  const code = searchParams.get('code');

  const supabase = await createServerSupabaseClient();
  const errorRedirect = next.startsWith('/customer') 
    ? '/customer/login?error=confirmation_failed' 
    : '/login?error=confirmation_failed';

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      console.log('[auth/callback] verifyOtp succeeded, redirecting to:', next);
      await supabase.auth.signOut().catch(() => {});
      return NextResponse.redirect(new URL(next, request.url));
    }
    console.error('[auth/callback] verifyOtp error:', error.message);
    return NextResponse.redirect(new URL(errorRedirect, request.url));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      console.log('[auth/callback] exchangeCodeForSession succeeded, redirecting to:', next);
      await supabase.auth.signOut().catch(() => {});
      return NextResponse.redirect(new URL(next, request.url));
    }
    console.error('[auth/callback] exchangeCodeForSession error:', error.message);
    return NextResponse.redirect(new URL(errorRedirect, request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}

