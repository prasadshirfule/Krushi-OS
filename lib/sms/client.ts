import { SmsProvider } from './types';
import { Msg91SmsProvider } from './providers/msg91';

let activeProvider: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (activeProvider) return activeProvider;

  // Default to MSG91 for Indian commercial DLT SMS
  activeProvider = new Msg91SmsProvider();
  return activeProvider;
}

export function isSmsConfigured(): boolean {
  return getSmsProvider().isConfigured();
}
