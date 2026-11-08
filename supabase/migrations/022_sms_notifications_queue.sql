-- Migration 022: SMS Notifications Queue, DLT Compliance, and Secure Document Access Tokens
-- Enables durable, provider-independent SMS notification pipeline, customer preferences, and cryptographically secure document tokens.

-- 1. SMS Notification Queue Table
CREATE TABLE IF NOT EXISTS public.sms_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  recipient_phone VARCHAR(15) NOT NULL,
  message_type VARCHAR(32) NOT NULL DEFAULT 'INVOICE' CHECK (message_type IN ('INVOICE', 'PAYMENT', 'REMINDER', 'STATEMENT', 'ALERT')),
  dlt_template_id VARCHAR(64),
  variables JSONB DEFAULT '{}'::jsonb,
  message_body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'submitted', 'delivered', 'failed', 'cancelled')),
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ DEFAULT NOW(),
  provider VARCHAR(32) DEFAULT 'msg91',
  provider_message_id VARCHAR(128),
  provider_response JSONB,
  error_code VARCHAR(64),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_queue_status_retry ON public.sms_notification_queue(status, next_retry_at) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_sms_queue_shop_created ON public.sms_notification_queue(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_queue_sale_id ON public.sms_notification_queue(sale_id);
CREATE INDEX IF NOT EXISTS idx_sms_queue_idempotency ON public.sms_notification_queue(idempotency_key);

-- 2. Customer SMS Preferences Table
CREATE TABLE IF NOT EXISTS public.customer_sms_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  invoice_sms_enabled BOOLEAN NOT NULL DEFAULT true,
  payment_sms_enabled BOOLEAN NOT NULL DEFAULT true,
  reminder_sms_enabled BOOLEAN NOT NULL DEFAULT true,
  consent_timestamp TIMESTAMPTZ DEFAULT NOW(),
  opt_out_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_sms_prefs_cust ON public.customer_sms_preferences(customer_id);

-- 3. Document Access Tokens (Cryptographically random tokens for secure combined PDF statement access)
CREATE TABLE IF NOT EXISTS public.document_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  document_type VARCHAR(32) NOT NULL DEFAULT 'INVOICE_STATEMENT' CHECK (document_type IN ('INVOICE_STATEMENT', 'INVOICE_ONLY', 'STATEMENT_ONLY')),
  metadata JSONB DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  access_count INT NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_tokens_hash ON public.document_access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_doc_tokens_sale_id ON public.document_access_tokens(sale_id);
CREATE INDEX IF NOT EXISTS idx_doc_tokens_shop_id ON public.document_access_tokens(shop_id);

-- 4. Document Access Audit Logs
CREATE TABLE IF NOT EXISTS public.document_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES public.document_access_tokens(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_access_logs_token ON public.document_access_logs(token_id, accessed_at DESC);

-- 5. Row Level Security Policies
ALTER TABLE public.sms_notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sms_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access_logs ENABLE ROW LEVEL SECURITY;

-- Shopkeeper policies for sms_notification_queue
CREATE POLICY "Users can view sms_notification_queue in their shop"
ON public.sms_notification_queue FOR SELECT
USING (shop_id = get_user_shop_id());

CREATE POLICY "Users can insert sms_notification_queue in their shop"
ON public.sms_notification_queue FOR INSERT
WITH CHECK (shop_id = get_user_shop_id());

CREATE POLICY "Users can update sms_notification_queue in their shop"
ON public.sms_notification_queue FOR UPDATE
USING (shop_id = get_user_shop_id());

-- Shopkeeper policies for customer_sms_preferences
CREATE POLICY "Users can view customer_sms_preferences in their shop"
ON public.customer_sms_preferences FOR SELECT
USING (shop_id = get_user_shop_id());

CREATE POLICY "Users can insert customer_sms_preferences in their shop"
ON public.customer_sms_preferences FOR INSERT
WITH CHECK (shop_id = get_user_shop_id());

CREATE POLICY "Users can update customer_sms_preferences in their shop"
ON public.customer_sms_preferences FOR UPDATE
USING (shop_id = get_user_shop_id());

-- Shopkeeper policies for document_access_tokens
CREATE POLICY "Users can view document_access_tokens in their shop"
ON public.document_access_tokens FOR SELECT
USING (shop_id = get_user_shop_id());

CREATE POLICY "Users can insert document_access_tokens in their shop"
ON public.document_access_tokens FOR INSERT
WITH CHECK (shop_id = get_user_shop_id());

CREATE POLICY "Users can update document_access_tokens in their shop"
ON public.document_access_tokens FOR UPDATE
USING (shop_id = get_user_shop_id());

-- Shopkeeper policies for document_access_logs
CREATE POLICY "Users can view document_access_logs in their shop"
ON public.document_access_logs FOR SELECT
USING (
  token_id IN (
    SELECT id FROM public.document_access_tokens WHERE shop_id = get_user_shop_id()
  )
);
