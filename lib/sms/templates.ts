import { SmsMessageType } from './types';

export interface TemplateVariables {
  farmer_name?: string;
  invoice_number?: string;
  amount?: string | number;
  shop_name?: string;
  outstanding?: string | number;
  document_url?: string;
  [key: string]: any;
}

/**
 * Standard Indian DLT-compliant SMS templates for Agricultural Input Retailers (Krushi Seva Kendras).
 * Format is designed to convey complete financial essentials on standard 2G/keypad phones,
 * with an optional secure web link for smartphones to open the combined PDF statement.
 */
export const SMS_TEMPLATES: Record<
  SmsMessageType,
  {
    templateName: string;
    dltEnvKey: string;
    defaultText: (vars: TemplateVariables) => string;
  }
> = {
  INVOICE: {
    templateName: 'KRUSHI_INVOICE_V1',
    dltEnvKey: 'MSG91_DLT_TE_ID_INVOICE',
    defaultText: (vars) => {
      const name = vars.farmer_name || 'Farmer';
      const inv = vars.invoice_number || 'Bill';
      const amt = vars.amount ?? '0';
      const shop = vars.shop_name || 'Krushi Kendra';
      const out = vars.outstanding !== undefined ? ` Total outstanding: Rs ${vars.outstanding}.` : '';
      const doc = vars.document_url ? ` View bill & statement: ${vars.document_url}` : '';
      return `Namaskar ${name}, your bill ${inv} for Rs ${amt} from ${shop} is confirmed.${out}${doc} - KRUSHI OS`;
    },
  },
  PAYMENT: {
    templateName: 'KRUSHI_PAYMENT_V1',
    dltEnvKey: 'MSG91_DLT_TE_ID_PAYMENT',
    defaultText: (vars) => {
      const name = vars.farmer_name || 'Farmer';
      const amt = vars.amount ?? '0';
      const shop = vars.shop_name || 'Krushi Kendra';
      const out = vars.outstanding !== undefined ? ` Balance outstanding: Rs ${vars.outstanding}.` : '';
      return `Namaskar ${name}, payment of Rs ${amt} received at ${shop}.${out} Thank you. - KRUSHI OS`;
    },
  },
  REMINDER: {
    templateName: 'KRUSHI_REMINDER_V1',
    dltEnvKey: 'MSG91_DLT_TE_ID_REMINDER',
    defaultText: (vars) => {
      const name = vars.farmer_name || 'Farmer';
      const shop = vars.shop_name || 'Krushi Kendra';
      const out = vars.outstanding ?? '0';
      const doc = vars.document_url ? ` View account: ${vars.document_url}` : '';
      return `Namaskar ${name}, reminder from ${shop}: pending balance is Rs ${out}. Kindly arrange payment.${doc} - KRUSHI OS`;
    },
  },
  STATEMENT: {
    templateName: 'KRUSHI_STATEMENT_V1',
    dltEnvKey: 'MSG91_DLT_TE_ID_STATEMENT',
    defaultText: (vars) => {
      const name = vars.farmer_name || 'Farmer';
      const shop = vars.shop_name || 'Krushi Kendra';
      const out = vars.outstanding ?? '0';
      const doc = vars.document_url ? ` View statement: ${vars.document_url}` : '';
      return `Namaskar ${name}, your ledger statement at ${shop} shows balance Rs ${out}.${doc} - KRUSHI OS`;
    },
  },
  ALERT: {
    templateName: 'KRUSHI_ALERT_V1',
    dltEnvKey: 'MSG91_DLT_TE_ID_ALERT',
    defaultText: (vars) => {
      const name = vars.farmer_name || 'Farmer';
      const shop = vars.shop_name || 'Krushi Kendra';
      const msg = vars.message || 'Notification';
      return `Namaskar ${name}, update from ${shop}: ${msg} - KRUSHI OS`;
    },
  },
};

export function renderSmsTemplate(type: SmsMessageType, variables: TemplateVariables): string {
  const tpl = SMS_TEMPLATES[type] || SMS_TEMPLATES.INVOICE;
  return tpl.defaultText(variables);
}
