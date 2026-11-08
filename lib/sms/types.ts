export type SmsMessageType = 'INVOICE' | 'PAYMENT' | 'REMINDER' | 'STATEMENT' | 'ALERT';

export type SmsStatus = 'pending' | 'processing' | 'submitted' | 'delivered' | 'failed' | 'cancelled';

export interface SendSmsOptions {
  recipientPhone: string;
  messageType: SmsMessageType;
  messageBody: string;
  dltTemplateId?: string;
  variables?: Record<string, string | number>;
  idempotencyKey: string;
  shopId: string;
}

export interface SmsSendResult {
  success: boolean;
  status: SmsStatus;
  provider: string;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: any;
}

export interface SmsProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(options: SendSmsOptions): Promise<SmsSendResult>;
}

export interface SmsQueueItem {
  id: string;
  shop_id: string;
  customer_id?: string | null;
  sale_id?: string | null;
  recipient_phone: string;
  message_type: SmsMessageType;
  dlt_template_id?: string | null;
  variables?: Record<string, any>;
  message_body: string;
  status: SmsStatus;
  idempotency_key: string;
  attempts: number;
  max_attempts: number;
  last_attempt_at?: string | null;
  next_retry_at?: string | null;
  provider?: string | null;
  provider_message_id?: string | null;
  provider_response?: any;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}
