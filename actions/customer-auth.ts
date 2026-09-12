'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/admin';
import { normalizeIndianMobile, isValidIndianMobile } from '@/lib/phone-utils';
import { ensureUserAndShop } from '@/lib/auth-helper';

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

export interface CustomerProfileData {
  name: string;
  email: string;
  mobile: string | null;
}

export interface CustomerProfileResult {
  success: boolean;
  data?: CustomerProfileData;
  error?: string;
}

export interface UpdateCustomerMobileResult {
  success: boolean;
  mobile?: string;
  error?: string;
}

/**
 * Ensures a customer_accounts record exists for the authenticated user during registration/onboarding.
 * Supports both email-based and mobile-linked customer accounts.
 * Migration 012's database trigger automatically links matching shop customer records upon account creation or mobile update.
 */
export async function syncCustomerAccountAction(input: SyncCustomerAccountInput): Promise<SyncCustomerAccountResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'User session not found. Please log in again.' };
    }

    const adminClient = createServerAdminClient() || supabase;
    const normalizedInputMobile = input.phone ? normalizeIndianMobile(input.phone) : null;

    // 1. Check if customer account already exists for this auth user
    const { data: existingAccount } = await adminClient
      .from('customer_accounts')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (existingAccount) {
      // If existing account has no mobile, and a valid normalized mobile was submitted, safely attach it
      if (normalizedInputMobile && !existingAccount.mobile) {
        // Check for conflicts with another account
        const { data: conflict } = await adminClient
          .from('customer_accounts')
          .select('id')
          .eq('mobile', normalizedInputMobile)
          .neq('id', existingAccount.id)
          .maybeSingle();

        if (!conflict) {
          const { data: updated } = await adminClient
            .from('customer_accounts')
            .update({
              mobile: normalizedInputMobile,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingAccount.id)
            .select()
            .single();

          return { success: true, account: updated || existingAccount };
        }
      }
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
        const updatePayload: any = {
          auth_user_id: user.id,
          updated_at: new Date().toISOString()
        };
        if (normalizedInputMobile && !accountByEmail.mobile) {
          updatePayload.mobile = normalizedInputMobile;
        }

        const { data: updated, error: updateErr } = await adminClient
          .from('customer_accounts')
          .update(updatePayload)
          .eq('id', accountByEmail.id)
          .select()
          .single();

        if (updateErr) {
          console.error('Error re-binding customer account by email:', updateErr);
        }
        return { success: true, account: updated || accountByEmail };
      }
    }

    // 3. Check if a customer account with this mobile already exists
    if (normalizedInputMobile) {
      const { data: accountByMobile } = await adminClient
        .from('customer_accounts')
        .select('*')
        .eq('mobile', normalizedInputMobile)
        .maybeSingle();

      if (accountByMobile) {
        // Only bind if the existing mobile account is not already bound to a different auth user
        if (!accountByMobile.auth_user_id || accountByMobile.auth_user_id === user.id) {
          const { data: updated, error: updateErr } = await adminClient
            .from('customer_accounts')
            .update({
              auth_user_id: user.id,
              email: email || accountByMobile.email,
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

    const { data: newAccount, error: createErr } = await adminClient
      .from('customer_accounts')
      .insert({
        auth_user_id: user.id,
        mobile: normalizedInputMobile, // null if not supplied
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

/**
 * Retrieves the profile information for the authenticated customer.
 */
export async function getCustomerAccountAction(): Promise<CustomerProfileResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'User session not found.' };
    }

    const adminClient = createServerAdminClient() || supabase;

    const { data: customerAccount } = await adminClient
      .from('customer_accounts')
      .select('name, email, mobile')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    const name = customerAccount?.name || user.user_metadata?.full_name || user.user_metadata?.name || 'Farmer';
    const email = customerAccount?.email || user.email || '';
    const mobile = customerAccount?.mobile || null;

    return {
      success: true,
      data: {
        name,
        email,
        mobile,
      }
    };
  } catch (error: any) {
    console.error('Error fetching customer account profile:', error);
    return { success: false, error: error.message || 'Failed to fetch customer profile.' };
  }
}

/**
 * Updates or adds the mobile number for an authenticated customer account.
 * Rejects duplicates if the mobile is already registered to another account.
 * Automatically links matching shop customer records where customer_account_id is null.
 */
export async function updateCustomerMobileAction(rawMobile: string): Promise<UpdateCustomerMobileResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Please log in to continue.' };
    }

    // 1. Validate & Normalize Mobile
    const normalized = normalizeIndianMobile(rawMobile);
    if (!normalized || !isValidIndianMobile(rawMobile)) {
      return { success: false, error: 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).' };
    }

    const adminClient = createServerAdminClient() || supabase;

    // 2. Check for conflict with another customer account
    const { data: conflict } = await adminClient
      .from('customer_accounts')
      .select('id, auth_user_id')
      .eq('mobile', normalized)
      .neq('auth_user_id', user.id)
      .maybeSingle();

    if (conflict) {
      return {
        success: false,
        error: 'This mobile number is already registered to another customer account.'
      };
    }

    // 3. Find or create customer account for current user
    const { data: existingAccount } = await adminClient
      .from('customer_accounts')
      .select('id, mobile')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    let accountId = existingAccount?.id;

    if (existingAccount) {
      const { error: updateErr } = await adminClient
        .from('customer_accounts')
        .update({
          mobile: normalized,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAccount.id);

      if (updateErr) {
        console.error('Error updating customer mobile:', updateErr);
        return { success: false, error: updateErr.message || 'Failed to update mobile number.' };
      }
    } else {
      // Provision customer account if one didn't exist yet
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || 'Farmer';
      const { data: newAcc, error: insertErr } = await adminClient
        .from('customer_accounts')
        .insert({
          auth_user_id: user.id,
          mobile: normalized,
          name: fullName,
          email: user.email || null,
        })
        .select('id')
        .single();

      if (insertErr || !newAcc) {
        console.error('Error creating customer account with mobile:', insertErr);
        return { success: false, error: insertErr?.message || 'Failed to link mobile number.' };
      }
      accountId = newAcc.id;
    }

    // 4. Safe shop customer linking for records where customer_account_id IS NULL
    // (Handled both via DB trigger and this explicit safe query)
    if (accountId) {
      await adminClient
        .from('customers')
        .update({ customer_account_id: accountId })
        .is('customer_account_id', null)
        .eq('mobile', normalized);
    }

    return { success: true, mobile: normalized };
  } catch (error: any) {
    console.error('Unexpected error updating customer mobile:', error);
    return { success: false, error: error.message || 'An unexpected error occurred.' };
  }
}

export interface PortalAuthVerificationResult {
  success: boolean;
  authorized: boolean;
  portal: 'customer' | 'shopkeeper';
  error?: string;
}

/**
 * Validates that an authenticated session matches the intended portal (Customer vs Shopkeeper).
 * Prevents staff users from accessing customer portals and customer users from accessing shopkeeper portals.
 * Never leaks role or account identity in client error messages.
 */
export async function verifyPortalAuthorizationAction(
  targetPortal: 'customer' | 'shopkeeper'
): Promise<PortalAuthVerificationResult> {
  const GENERIC_LOGIN_ERROR = 'Invalid email or password.';

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        authorized: false,
        portal: targetPortal,
        error: GENERIC_LOGIN_ERROR,
      };
    }

    const adminClient = createServerAdminClient() || supabase;

    if (targetPortal === 'customer') {
      // Customer Portal: Must be a customer account and NOT a shopkeeper
      const isCustomerRole = user.user_metadata?.role === 'customer';
      let { data: customerAccount } = await adminClient
        .from('customer_accounts')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      const { data: staffUser } = await adminClient
        .from('users')
        .select('id, shop_id')
        .eq('id', user.id)
        .maybeSingle();

      // If user registered as customer or has customer role, but customer_accounts does not exist yet (email verification deferred it):
      if (!customerAccount && isCustomerRole && !staffUser?.shop_id) {
        console.log('[AUTH DEBUG] portal=customer syncing customer account for verified user:', user.id);
        try {
          const syncRes = await syncCustomerAccountAction({
            email: user.email,
            name: user.user_metadata?.full_name || user.user_metadata?.name,
            phone: user.user_metadata?.phone,
          });
          if (syncRes.success) {
            const { data: createdAcct } = await adminClient
              .from('customer_accounts')
              .select('id')
              .eq('auth_user_id', user.id)
              .maybeSingle();
            customerAccount = createdAcct;
          }
        } catch (syncErr) {
          console.warn('[AUTH DEBUG] Customer account sync during login warning:', syncErr);
        }
      }

      const isAuthorizedCustomer = (customerAccount || isCustomerRole) && !staffUser?.shop_id;

      if (!isAuthorizedCustomer) {
        console.warn('[verifyPortalAuthorizationAction] Account rejected for customer portal:', {
          userId: user.id,
          hasCustomerAccount: !!customerAccount,
          isCustomerRole,
          hasStaffShop: !!staffUser?.shop_id,
        });
        await supabase.auth.signOut();
        return {
          success: false,
          authorized: false,
          portal: targetPortal,
          error: GENERIC_LOGIN_ERROR,
        };
      }

      // Sync user_metadata.role if not set so middleware can route correctly
      if (!isCustomerRole && createServerAdminClient()) {
        try {
          await createServerAdminClient()!.auth.admin.updateUserById(user.id, {
            user_metadata: { ...user.user_metadata, role: 'customer' },
          });
        } catch (syncErr) {
          console.warn('[verifyPortalAuthorizationAction] Could not sync customer role metadata:', syncErr);
        }
      }

      return { success: true, authorized: true, portal: 'customer' };
    } else {
      // Shopkeeper Portal: Must NOT be a customer account
      const isCustomerRole = user.user_metadata?.role === 'customer';
      const { data: customerAccount } = await adminClient
        .from('customer_accounts')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (isCustomerRole || customerAccount) {
        console.warn('[verifyPortalAuthorizationAction] Customer account rejected for shopkeeper portal:', {
          userId: user.id,
          isCustomerRole,
          hasCustomerAccount: !!customerAccount,
        });
        await supabase.auth.signOut();
        return {
          success: false,
          authorized: false,
          portal: targetPortal,
          error: GENERIC_LOGIN_ERROR,
        };
      }

      // Check if public.users record exists
      let { data: staffUser } = await adminClient
        .from('users')
        .select('id, shop_id, is_active')
        .eq('id', user.id)
        .maybeSingle();

      // If staff record does not exist, safely provision it for this valid shopkeeper!
      if (!staffUser) {
        console.log('[AUTH DEBUG] portal=shopkeeper auth_user_exists=true public_user_exists=false customer_account_exists=false attempting_provisioning');
        try {
          const provisioned = await ensureUserAndShop(user);
          if (provisioned?.shop_id) {
            staffUser = {
              id: provisioned.id,
              shop_id: provisioned.shop_id,
              is_active: provisioned.is_active ?? true,
            };
            console.log('[AUTH DEBUG] portal=shopkeeper provisioning_succeeded shop_id=' + provisioned.shop_id);
          }
        } catch (provErr: any) {
          console.error('[AUTH DEBUG] portal=shopkeeper provisioning_failed:', provErr?.message || provErr);
        }
      }

      if (!staffUser || !staffUser.shop_id || staffUser.is_active === false) {
        console.warn('[AUTH DEBUG] portal=shopkeeper auth_user_exists=true public_user_exists=' + !!staffUser + ' authorized=false reason=missing_or_inactive_staff_record');
        await supabase.auth.signOut();
        return {
          success: false,
          authorized: false,
          portal: targetPortal,
          error: GENERIC_LOGIN_ERROR,
        };
      }

      // Sync shopkeeper role in metadata if needed
      if (user.user_metadata?.role !== 'shopkeeper' && createServerAdminClient()) {
        try {
          await createServerAdminClient()!.auth.admin.updateUserById(user.id, {
            user_metadata: { ...user.user_metadata, role: 'shopkeeper' },
          });
        } catch (syncErr) {
          console.warn('[verifyPortalAuthorizationAction] Could not sync shopkeeper role metadata:', syncErr);
        }
      }

      console.log('[AUTH DEBUG] portal=shopkeeper auth_user_exists=true public_user_exists=true authorized=true');
      return { success: true, authorized: true, portal: 'shopkeeper' };
    }
  } catch (err: any) {
    console.error('Error verifying portal authorization:', err);
    return {
      success: false,
      authorized: false,
      portal: targetPortal,
      error: GENERIC_LOGIN_ERROR,
    };
  }
}

/**
 * Server Action to immediately provision a newly registered shopkeeper account.
 */
export async function provisionShopkeeperAccountAction(input?: {
  shopName?: string;
  fullName?: string;
  phone?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Authentication required for provisioning.' };
    }

    // Ensure not a customer account
    if (user.user_metadata?.role === 'customer') {
      return { success: false, error: 'Customer accounts cannot be provisioned as shopkeepers.' };
    }

    const adminClient = createServerAdminClient() || supabase;
    const { data: customerAccount } = await adminClient
      .from('customer_accounts')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (customerAccount) {
      return { success: false, error: 'Customer accounts cannot be provisioned as shopkeepers.' };
    }

    const authUserWithInput = {
      ...user,
      user_metadata: {
        ...user.user_metadata,
        shop_name: input?.shopName || user.user_metadata?.shop_name || user.user_metadata?.shopName,
        full_name: input?.fullName || user.user_metadata?.full_name || user.user_metadata?.name,
        phone: input?.phone || user.user_metadata?.phone,
        role: 'shopkeeper',
      },
    };

    const provisionedUser = await ensureUserAndShop(authUserWithInput);

    if (!provisionedUser?.shop_id) {
      return { success: false, error: 'Failed to configure shop profile.' };
    }

    console.log('[AUTH DEBUG] portal=shopkeeper registration_provisioning_succeeded userId=' + user.id + ' shop_id=' + provisionedUser.shop_id);
    return { success: true };
  } catch (err: any) {
    console.error('[provisionShopkeeperAccountAction] Error:', err);
    return { success: false, error: err.message || 'Internal provisioning error.' };
  }
}
