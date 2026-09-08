import { cache } from 'react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/admin';
import { hasPermission } from '@/lib/permissions';

export interface AuthenticatedUser {
  id: string;
  shop_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  role_id?: string;
  roles?: {
    id: string;
    name: string;
    permissions?: any;
  };
  is_active?: boolean;
}

/**
 * Ensures an authenticated Supabase user has a corresponding row in public.users and shops.
 * Automatically provisions a default shop and Admin role if this is a new user.
 */
export async function ensureUserAndShop(authUser: { id: string; email?: string; user_metadata?: any }): Promise<AuthenticatedUser> {
  const supabase = await createServerSupabaseClient();
  const adminClient = createServerAdminClient() || supabase;

  // 1. Try to fetch existing public.users record
  const { data: existingUser } = await adminClient
    .from('users')
    .select('*, roles(*)')
    .eq('id', authUser.id)
    .maybeSingle();

  if (existingUser?.shop_id) {
    return existingUser as AuthenticatedUser;
  }

  // 1b. If user is explicitly a customer or has a customer_account, do not provision a shop
  if (authUser.user_metadata?.role === 'customer') {
    throw new Error("Customer accounts cannot access shopkeeper features.");
  }

  const { data: existingCustomerAccount } = await adminClient
    .from('customer_accounts')
    .select('id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (existingCustomerAccount?.id) {
    throw new Error("Customer accounts cannot access shopkeeper features.");
  }

  // 2. User record not found - provision Shop, Role, and User row
  const shopName = authUser.user_metadata?.shop_name || authUser.user_metadata?.shopName || 'My Krushi Kendra';
  const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Shop Owner';
  const phone = authUser.user_metadata?.phone || '';

  // 2a. Find or create 'Admin' role
  let roleId: string | null = null;
  const { data: existingRole } = await adminClient
    .from('roles')
    .select('id')
    .eq('name', 'Admin')
    .maybeSingle();

  if (existingRole?.id) {
    roleId = existingRole.id;
  } else {
    const { data: newRole } = await adminClient
      .from('roles')
      .insert({
        name: 'Admin',
        description: 'Shop Owner / Full Administrator',
        permissions: { all: true }
      })
      .select('id')
      .single();
    roleId = newRole?.id || null;
  }

  // 2b. Create a new Shop record
  const { data: newShop, error: shopError } = await adminClient
    .from('shops')
    .insert({
      name: shopName,
      phone: phone,
      email: authUser.email || '',
      invoice_prefix: 'KOS',
      invoice_counter: 0,
      terms_and_conditions: '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if not paid within 30 days.'
    })
    .select('id, name')
    .single();

  if (shopError || !newShop?.id) {
    console.error("Failed to provision shop record:", shopError);
    throw new Error(`Failed to initialize shop profile: ${shopError?.message || 'Database error'}`);
  }

  // 2c. Insert public.users record linked to the new shop
  const { data: newUser, error: userError } = await adminClient
    .from('users')
    .insert({
      id: authUser.id,
      shop_id: newShop.id,
      role_id: roleId,
      full_name: fullName,
      email: authUser.email || '',
      phone: phone,
      is_active: true
    })
    .select('*, roles(*)')
    .single();

  if (userError || !newUser) {
    console.error("Failed to provision public.users record:", userError);
    throw new Error(`Failed to initialize user record: ${userError?.message || 'Database error'}`);
  }

  return newUser as AuthenticatedUser;
}

/**
 * Request-scoped cached resolver for the base authenticated user.
 */
const resolveAuthenticatedUser = cache(async (): Promise<AuthenticatedUser> => {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Please log in to continue.");
  }

  const userData = await ensureUserAndShop(user);

  if (!userData?.shop_id) {
    throw new Error("Your shop profile is not configured. Please complete setup.");
  }

  return userData;
});

/**
 * Resolves the currently authenticated user and verifies required permissions.
 * Throws an authentication error if no active session exists.
 */
export async function getAuthAndPermissions(requiredPermission?: string): Promise<AuthenticatedUser> {
  const userData = await resolveAuthenticatedUser();

  if (requiredPermission && userData.roles?.name && !hasPermission(userData.roles.name, requiredPermission)) {
    throw new Error(`Permission denied: requires '${requiredPermission}'`);
  }

  return userData;
}

/**
 * Convenience helper to retrieve the authenticated user's real UUID shop_id.
 */
export async function getAuthenticatedShopId(): Promise<string> {
  const user = await getAuthAndPermissions();
  return user.shop_id;
}

/**
 * Request-scoped cached resolver for the base authenticated customer.
 */
export const getAuthenticatedCustomer = cache(async (): Promise<any> => {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Please log in as a customer to continue.");
  }

  const adminClient = createServerAdminClient() || supabase;
  const { data: customerAccount } = await adminClient
    .from('customer_accounts')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!customerAccount) {
    throw new Error("Customer profile not found. Please complete mobile verification.");
  }

  return customerAccount;
});

/**
 * Convenience helper to retrieve the customer account if logged in, or null.
 */
export const getCustomerAuth = cache(async (): Promise<any | null> => {
  try {
    return await getAuthenticatedCustomer();
  } catch {
    return null;
  }
});

