import { SmsProvider, SendSmsOptions, SmsSendResult } from '../types';
import { maskPhoneNumber } from '../../phone-utils';

export class Msg91SmsProvider implements SmsProvider {
  readonly name = 'msg91';

  isConfigured(): boolean {
    const authKey = process.env.MSG91_AUTH_KEY?.trim();
    const senderId = process.env.MSG91_SENDER_ID?.trim();
    return Boolean(authKey && senderId);
  }

  async send(options: SendSmsOptions): Promise<SmsSendResult> {
    const authKey = process.env.MSG91_AUTH_KEY?.trim();
    const senderId = process.env.MSG91_SENDER_ID?.trim();

    if (!authKey || !senderId) {
      return {
        success: false,
        status: 'failed',
        provider: this.name,
        errorCode: 'PROVIDER_UNCONFIGURED',
        errorMessage: 'MSG91 credentials (MSG91_AUTH_KEY, MSG91_SENDER_ID) not configured',
      };
    }

    const recipient = options.recipientPhone.startsWith('91')
      ? options.recipientPhone
      : `91${options.recipientPhone}`;

    try {
      // MSG91 Flow / SMS API (POST https://control.msg91.com/api/v5/flow/)
      // If a template ID is configured, use flow; otherwise use basic transactional SMS
      const templateId = options.dltTemplateId || process.env.MSG91_DLT_TE_ID_INVOICE;

      const payload = {
        template_id: templateId,
        sender: senderId,
        short_url: '0',
        mobiles: recipient,
        ...options.variables,
      };

      const response = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: authKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok || responseData?.type === 'error') {
        const errMsg = responseData?.message || `HTTP ${response.status} ${response.statusText}`;
        console.warn(`[SMS/MSG91] Delivery rejected for ${maskPhoneNumber(recipient)}: ${errMsg}`);
        return {
          success: false,
          status: 'failed',
          provider: this.name,
          errorCode: `MSG91_${response.status}`,
          errorMessage: errMsg,
          rawResponse: responseData,
        };
      }

      const msgId = responseData?.message || responseData?.request_id || options.idempotencyKey;
      return {
        success: true,
        status: 'submitted',
        provider: this.name,
        providerMessageId: String(msgId),
        rawResponse: responseData,
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'TimeoutError' || err?.code === 'ETIMEDOUT';
      const errMsg = isTimeout ? 'Request timed out after 10s' : err?.message || 'Network error';
      console.error(`[SMS/MSG91] Error sending to ${maskPhoneNumber(recipient)}:`, errMsg);

      return {
        success: false,
        status: 'failed',
        provider: this.name,
        errorCode: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
        errorMessage: errMsg,
      };
    }
  }
}
