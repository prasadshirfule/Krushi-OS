'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/admin';
import { normalizeIndianMobile } from '@/lib/phone-utils';

export interface SyncCustomerAccountResult {
  success: boolean;
  account?: any;
  error?: string;
}

export interface SyncCustomerAccountInput {
  phone?: string;
  email?: string;
  name?: string;
}

/**
 * Ensures a customer_accounts record exists for the authenticated user.
 * Supports both email-based and phone-based customer accounts.
 * Migration 012's database trigger automatically links matching shop customer records upon account creation.
 * 
 * Lookup priority:
 * 1. auth_user_id (always checked first)
 * 2. email (for email-based accounts)
 * 3. mobile (for phone-based accounts, if phone is supplied)
 */
export async function syncCustomerAccountAction(input: SyncCustomerAccountInput): Promise<SyncCustomerAccountResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'User session not found. Please log in again.' };
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

    // 2. Check if a customer account with this email already exists
    const email = input.email?.trim() || user.email;
    if (email) {
      const { data: accountByEmail } = await adminClient
        .from('customer_accounts')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (accountByEmail) {
        // Re-bind to current authenticated user
        const { data: updated, error: updateErr } = await adminClient
          .from('customer_accounts')
          .update({
            auth_user_id: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', accountByEmail.id)
          .select()
          .single();

        if (updateErr) {
          console.error('Error re-binding customer account by email:', updateErr);
        }
        return { success: true, account: updated || accountByEmail };
      }
    }

    // 3. Check if a customer account with this mobile already exists (phone-based lookup)
    if (input.phone) {
      const normalized = normalizeIndianMobile(input.phone);
      if (normalized) {
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
            console.error('Error re-binding customer account by mobile:', updateErr);
          }
          return { success: true, account: updated || accountByMobile };
        }
      }
    }

    // 4. Create brand-new customer account
    const fullName = (input.name?.trim()) || user.user_metadata?.name || user.user_metadata?.full_name || 'Farmer';
    const normalized = input.phone ? normalizeIndianMobile(input.phone) : null;

    const { data: newAccount, error: createErr } = await adminClient
      .from('customer_accounts')
      .insert({
        auth_user_id: user.id,
        mobile: normalized, // null for email-only accounts
        name: fullName,
        email: email || null,
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
