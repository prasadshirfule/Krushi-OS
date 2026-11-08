import { createServerSupabaseClient } from '../lib/supabase/server';
import { createServerAdminClient } from '../lib/supabase/admin';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'overdue'
  | 'grace_period'
  | 'suspended'
  | 'cancelled';

export interface ShopSubscriptionDetails {
  id: string;
  shop_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  trial_ends_at?: string | null;
  grace_period_ends_at?: string | null;
  invoices_used_in_period: number;
  sms_used_in_period: number;
  plan: {
    id: string;
    name: string;
    price_inr: number;
    billing_interval: string;
    max_monthly_invoices?: number | null;
    max_products?: number | null;
    max_users?: number | null;
    sms_quota_monthly?: number | null;
    features: Record<string, any>;
  };
  isReadOnly: boolean;
  isGracePeriod: boolean;
  canCreateInvoice: boolean;
  canCreateProduct: boolean;
  daysRemainingInPeriod: number;
}

/**
 * Resolves the active subscription for a shop, including plan parameters,
 * computed grace-period status, and permission to perform mutations.
 */
export async function getShopSubscription(
  shopId: string
): Promise<ShopSubscriptionDetails> {
  const supabase = await createServerSupabaseClient();
  const adminClient = createServerAdminClient() || supabase;

  const { data: sub, error } = await adminClient
    .from('shop_subscriptions')
    .select('*, plan:subscription_plans(*)')
    .eq('shop_id', shopId)
    .maybeSingle();

  const now = new Date();

  // If no record exists yet (e.g. existing shop created before migration 023),
  // provide a safe fallback 14-day trial without breaking the shop
  if (error || !sub) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    return {
      id: `fallback-${shopId}`,
      shop_id: shopId,
      plan_id: 'trial',
      status: 'trialing',
      current_period_start: now.toISOString(),
      current_period_end: trialEnd.toISOString(),
      trial_ends_at: trialEnd.toISOString(),
      grace_period_ends_at: null,
      invoices_used_in_period: 0,
      sms_used_in_period: 0,
      plan: {
        id: 'trial',
        name: '14-Day Free Trial',
        price_inr: 0,
        billing_interval: 'trial',
        max_monthly_invoices: 100,
        max_products: 200,
        max_users: 2,
        sms_quota_monthly: 50,
        features: { multi_device: true, sms_delivery: true, pdf_statements: true },
      },
      isReadOnly: false,
      isGracePeriod: false,
      canCreateInvoice: true,
      canCreateProduct: true,
      daysRemainingInPeriod: 14,
    };
  }

  const periodEnd = new Date(sub.current_period_end);
  const graceEnd = sub.grace_period_ends_at ? new Date(sub.grace_period_ends_at) : null;
  const isPeriodExpired = periodEnd.getTime() < now.getTime();
  const isGraceActive = isPeriodExpired && graceEnd ? graceEnd.getTime() > now.getTime() : false;

  let effectiveStatus: SubscriptionStatus = sub.status;
  if (isPeriodExpired) {
    if (isGraceActive) {
      effectiveStatus = 'grace_period';
    } else if (sub.status !== 'cancelled') {
      effectiveStatus = 'suspended';
    }
  }

  const isReadOnly = effectiveStatus === 'suspended' || effectiveStatus === 'cancelled';
  const plan = sub.plan || {
    id: sub.plan_id,
    name: 'Standard Plan',
    price_inr: 499,
    billing_interval: 'monthly',
    features: {},
  };

  const invoiceLimit = plan.max_monthly_invoices;
  const isInvoiceQuotaExceeded = invoiceLimit ? (sub.invoices_used_in_period || 0) >= invoiceLimit : false;

  const canCreateInvoice = !isReadOnly && !isInvoiceQuotaExceeded;
  const canCreateProduct = !isReadOnly;

  const msRemaining = Math.max(0, periodEnd.getTime() - now.getTime());
  const daysRemainingInPeriod = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  return {
    id: sub.id,
    shop_id: sub.shop_id,
    plan_id: sub.plan_id,
    status: effectiveStatus,
    current_period_start: sub.current_period_start,
    current_period_end: sub.current_period_end,
    trial_ends_at: sub.trial_ends_at,
    grace_period_ends_at: sub.grace_period_ends_at,
    invoices_used_in_period: sub.invoices_used_in_period || 0,
    sms_used_in_period: sub.sms_used_in_period || 0,
    plan,
    isReadOnly,
    isGracePeriod: isGraceActive,
    canCreateInvoice,
    canCreateProduct,
    daysRemainingInPeriod,
  };
}

/**
 * Increments quota usage for a shop (e.g. after a completed sale or sent SMS).
 */
export async function incrementSubscriptionUsage(
  shopId: string,
  metric: 'invoice' | 'sms'
): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    const adminClient = createServerAdminClient() || supabase;

    const column = metric === 'invoice' ? 'invoices_used_in_period' : 'sms_used_in_period';

    const { data: sub } = await adminClient
      .from('shop_subscriptions')
      .select('id, invoices_used_in_period, sms_used_in_period')
      .eq('shop_id', shopId)
      .maybeSingle();

    if (sub) {
      const current = metric === 'invoice' ? sub.invoices_used_in_period || 0 : sub.sms_used_in_period || 0;
      await adminClient
        .from('shop_subscriptions')
        .update({ [column]: current + 1 })
        .eq('id', sub.id);
    }
  } catch (err) {
    console.warn(`[Subscription] Non-critical error incrementing ${metric} usage:`, err);
  }
}
