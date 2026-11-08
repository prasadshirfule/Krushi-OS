-- Migration 024: SaaS Subscription Backfill & Document Access Log Policy Hardening
-- Description:
-- 1. Adds missing INSERT RLS policy on document_access_logs to allow anonymous/SSR client audit logging.
-- 2. Backfills existing shops into shop_subscriptions with default 14-day trial without breaking pre-existing tenants.

-- 1. Hardening document_access_logs RLS Policies
DROP POLICY IF EXISTS "Allow system and users to insert document_access_logs" ON public.document_access_logs;
CREATE POLICY "Allow system and users to insert document_access_logs"
ON public.document_access_logs FOR INSERT
WITH CHECK (true);

-- 2. Backfill pre-existing shops into shop_subscriptions
INSERT INTO public.shop_subscriptions (
    shop_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    trial_ends_at,
    invoices_used_in_period,
    sms_used_in_period
)
SELECT 
    s.id,
    'trial',
    'trialing',
    NOW(),
    NOW() + INTERVAL '14 days',
    NOW() + INTERVAL '14 days',
    0,
    0
FROM public.shops s
WHERE NOT EXISTS (
    SELECT 1 FROM public.shop_subscriptions sub WHERE sub.shop_id = s.id
)
ON CONFLICT (shop_id) DO NOTHING;

-- 3. Document Access Token query index for performance
CREATE INDEX IF NOT EXISTS idx_doc_tokens_sale ON public.document_access_tokens(shop_id, sale_id);
