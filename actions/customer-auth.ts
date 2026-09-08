'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/admin';
import { normalizeIndianMobile } from '@/lib/phone-utils';

export interface SyncCustomerAccountResult {
  success: boolean;
  account?: any;
  error?: string;
}

/**
 * Ensures a customer_accounts record exists for the authenticated user and their verified phone.
 * Migration 012's database trigger automatically links matching shop customer records upon account creation.
 */
export async function syncCustomerAccountAction(phone: string, name?: string): Promise<SyncCustomerAccountResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'User session not found. Please verify OTP again.' };
    }

    const normalized = normalizeIndianMobile(phone);
    if (!normalized) {
      return { success: false, error: 'Invalid 10-digit Indian mobile number format.' };
    }

    const adminClient = createServerAdminClient() || supabase;

    // 1. Check if customer account already exists for this auth user
    const { data: existingAccount } = await adminClient
      .from('customer_accounts')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (existingAccount) {
      return { success: true, account: existingAccount };
    }

    // 2. Check if a customer account with this mobile already exists
    const { data: accountByMobile } = await adminClient
      .from('customer_accounts')
      .select('*')
      .eq('mobile', normalized)
      .maybeSingle();

    if (accountByMobile) {
      // Re-bind to current authenticated user
      const { data: updated, error: updateErr } = await adminClient
        .from('customer_accounts')
        .update({
          auth_user_id: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', accountByMobile.id)
        .select()
        .single();

      if (updateErr) {
        console.error('Error re-binding customer account:', updateErr);
      }
      return { success: true, account: updated || accountByMobile };
    }

    // 3. Create brand-new customer account
    const fullName = (name?.trim()) || user.user_metadata?.name || user.user_metadata?.full_name || 'Farmer';
    const { data: newAccount, error: createErr } = await adminClient
      .from('customer_accounts')
      .insert({
        auth_user_id: user.id,
        mobile: normalized,
        name: fullName,
        email: user.email || null,
      })
      .select()
      .single();

    if (createErr) {
      console.error('Error creating customer_account:', createErr);
      return { success: false, error: createErr.message || 'Database error creating customer account.' };
    }

    return { success: true, account: newAccount };
  } catch (error: any) {
    console.error('Unexpected error syncing customer account:', error);
    return { success: false, error: error.message || 'An unexpected error occurred.' };
  }
}
