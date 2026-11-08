-- Migration 023: SaaS Commercial Subscription Architecture, Plans, Usage Quotas, and Grace Period Enforcement
-- Provides multi-tenant SaaS commercial readiness for Krushi Seva Kendras in India.

-- 1. Subscription Plans Table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  description TEXT,
  price_inr INT NOT NULL DEFAULT 0,
  billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('trial', 'monthly', 'yearly')),
  max_monthly_invoices INT, -- NULL = unlimited
  max_products INT,        -- NULL = unlimited
  max_users INT DEFAULT 1,
  sms_quota_monthly INT DEFAULT 0,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Default Subscription Plans
INSERT INTO public.subscription_plans (id, name, description, price_inr, billing_interval, max_monthly_invoices, max_products, max_users, sms_quota_monthly, features, is_active)
VALUES
  ('trial', '14-Day Free Trial', 'Full access for 14 days to test all features of KRUSHI OS', 0, 'trial', 100, 200, 2, 50, '{"multi_device": true, "sms_delivery": true, "pdf_statements": true, "reports_export": true}'::jsonb, true),
  ('starter', 'Krushi Starter', 'Ideal for single-counter fertilizer, pesticide, or seed stores', 499, 'monthly', 500, 1000, 2, 250, '{"multi_device": true, "sms_delivery": true, "pdf_statements": true, "reports_export": true}'::jsonb, true),
  ('professional', 'Krushi Pro Business', 'Full-featured power package for high-volume Krushi Kendras', 999, 'monthly', NULL, NULL, 5, 1000, '{"multi_device": true, "sms_delivery": true, "pdf_statements": true, "reports_export": true, "priority_support": true, "unlimited_invoices": true}'::jsonb, true),
  ('enterprise', 'Enterprise & Multi-Branch', 'For large distributors and multi-location retail chains', 2499, 'monthly', NULL, NULL, 15, 3000, '{"multi_device": true, "sms_delivery": true, "pdf_statements": true, "reports_export": true, "priority_support": true, "unlimited_invoices": true, "custom_dlt": true, "multi_branch": true}'::jsonb, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_inr = EXCLUDED.price_inr,
  features = EXCLUDED.features;

-- 2. Shop Subscriptions Table
CREATE TABLE IF NOT EXISTS public.shop_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE UNIQUE,
  plan_id VARCHAR(32) NOT NULL REFERENCES public.subscription_plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'overdue', 'grace_period', 'suspended', 'cancelled')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_ends_at TIMESTAMPTZ,
  grace_period_ends_at TIMESTAMPTZ,
  invoices_used_in_period INT NOT NULL DEFAULT 0,
  sms_used_in_period INT NOT NULL DEFAULT 0,
  payment_provider VARCHAR(32) DEFAULT 'razorpay',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_subs_shop ON public.shop_subscriptions(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_subs_status ON public.shop_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_shop_subs_period_end ON public.shop_subscriptions(current_period_end);

-- 3. Subscription Audit Logs Table
CREATE TABLE IF NOT EXISTS public.subscription_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  action VARCHAR(64) NOT NULL,
  previous_status VARCHAR(32),
  new_status VARCHAR(32),
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_audit_shop ON public.subscription_audit_logs(shop_id, created_at DESC);

-- 4. Automatically create 14-day trial subscription when a new shop is created
CREATE OR REPLACE FUNCTION initialize_shop_trial_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_trial_end TIMESTAMPTZ := NOW() + INTERVAL '14 days';
BEGIN
  INSERT INTO public.shop_subscriptions (
    shop_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    trial_ends_at,
    grace_period_ends_at
  ) VALUES (
    NEW.id,
    'trial',
    'trialing',
    NOW(),
    v_trial_end,
    v_trial_end,
    v_trial_end + INTERVAL '15 days'
  )
  ON CONFLICT (shop_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_init_shop_subscription ON public.shops;
CREATE TRIGGER trg_init_shop_subscription
AFTER INSERT ON public.shops
FOR EACH ROW EXECUTE FUNCTION initialize_shop_trial_subscription();

-- 5. Row Level Security Policies
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_audit_logs ENABLE ROW LEVEL SECURITY;

-- Anyone can view available subscription plans
CREATE POLICY "Anyone can view active subscription plans"
ON public.subscription_plans FOR SELECT
USING (is_active = true);

-- Shopkeepers can view their own shop's subscription
CREATE POLICY "Users can view subscription for their shop"
ON public.shop_subscriptions FOR SELECT
USING (shop_id = get_user_shop_id());

-- Shopkeepers can view audit logs for their shop
CREATE POLICY "Users can view subscription audit logs for their shop"
ON public.subscription_audit_logs FOR SELECT
USING (shop_id = get_user_shop_id());
