'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RotateCw, 
  Loader2, 
  Send, 
  MessageSquareOff,
  MessageSquare
} from 'lucide-react';
import { retryWhatsAppInvoiceAction } from '@/actions/sales';
import { normalizeWhatsAppPhone, maskPhoneNumber } from '@/lib/phone-utils';
import { toast } from 'sonner';

export type WhatsAppDeliveryState = 'NOT_ATTEMPTED' | 'SENDING' | 'SENT' | 'PARTIAL' | 'FAILED' | 'SKIPPED';

interface WhatsAppDeliveryCardProps {
  saleId: string;
  customerPhone?: string | null;
  initialState?: WhatsAppDeliveryState;
  compact?: boolean;
  className?: string;
}

export function WhatsAppDeliveryCard({
  saleId,
  customerPhone,
  initialState,
  compact = false,
  className = '',
}: WhatsAppDeliveryCardProps) {
  const hasValidPhone = Boolean(normalizeWhatsAppPhone(customerPhone));
  const maskedPhone = maskPhoneNumber(customerPhone);

  const [state, setState] = useState<WhatsAppDeliveryState>(() => {
    if (initialState) return initialState;
    if (!hasValidPhone) return 'SKIPPED';
    return 'NOT_ATTEMPTED';
  });

  const [statusMessage, setStatusMessage] = useState<string>(() => {
    if (!hasValidPhone) return 'WhatsApp not sent — no valid customer mobile number';
    if (initialState === 'SENT') return 'Invoice sent to WhatsApp';
    return 'WhatsApp delivery available';
  });

  const [isRetrying, setIsRetrying] = useState(false);

  React.useEffect(() => {
    if (initialState) {
      setState(initialState);
      return;
    }
    if (!hasValidPhone) {
      setState('SKIPPED');
      setStatusMessage('WhatsApp not sent — no valid customer mobile number');
    }
  }, [customerPhone, hasValidPhone, initialState]);

  const handleRetry = async () => {
    if (isRetrying || !saleId) return;

    setIsRetrying(true);
    setState('SENDING');
    setStatusMessage('Sending invoice to WhatsApp...');

    try {
      const res = await retryWhatsAppInvoiceAction(saleId);

      if (res.success) {
        const data = res.data;
        setState(data.status);
        setStatusMessage(data.message);

        if (data.status === 'SENT') {
          toast.success('Bill sent on WhatsApp', {
            description: `Invoice ${saleId.startsWith('KOS-') ? saleId : `KOS-${saleId.substring(0, 8).toUpperCase()}`} sent`,
          });
        } else if (data.status === 'PARTIAL') {
          toast.warning('Invoice PDF sent, but follow-up text message failed.');
        } else if (data.status === 'FAILED') {
          toast.error(data.message || 'WhatsApp delivery failed. You can retry.');
        } else if (data.status === 'SKIPPED') {
          toast.info(data.message);
        }
      } else {
        setState('FAILED');
        const errMsg = res.error || 'WhatsApp delivery failed. You can retry.';
        setStatusMessage(errMsg);
        toast.error(errMsg);
      }
    } catch (err: any) {
      setState('FAILED');
      setStatusMessage(err?.message || 'WhatsApp delivery failed. You can retry.');
      toast.error('Unexpected error during WhatsApp retry.');
    } finally {
      setIsRetrying(false);
    }
  };

  // Compact variant (e.g. for sales history or tight cards)
  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-xs ${className}`}>
        {state === 'SENT' && (
          <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" /> WhatsApp Sent
          </span>
        )}
        {state === 'PARTIAL' && (
          <span className="flex items-center gap-1.5 text-amber-600 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" /> PDF Sent (Msg Failed)
          </span>
        )}
        {state === 'FAILED' && (
          <span className="flex items-center gap-1.5 text-rose-600 font-semibold">
            <XCircle className="h-3.5 w-3.5" /> Delivery Failed
          </span>
        )}
        {state === 'SKIPPED' && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <MessageSquareOff className="h-3.5 w-3.5" /> No Mobile
          </span>
        )}
        {state === 'SENDING' && (
          <span className="flex items-center gap-1.5 text-blue-600 font-medium">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...
          </span>
        )}
      </div>
    );
  }

  // Full Box variant (for BillSuccessDialog & SaleDetailView)
  return (
    <div
      className={`rounded-lg border p-3.5 transition-all text-left ${
        state === 'SENT'
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
          : state === 'PARTIAL'
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200'
          : state === 'FAILED'
          ? 'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200'
          : state === 'SENDING'
          ? 'bg-blue-500/10 border-blue-500/30 text-blue-950 dark:text-blue-200'
          : 'bg-muted/70 border-border text-foreground'
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {/* Status Icon */}
          <div className="mt-0.5 shrink-0">
            {state === 'SENT' && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
            {state === 'PARTIAL' && <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
            {state === 'FAILED' && <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
            {state === 'SKIPPED' && <MessageSquareOff className="h-4 w-4 text-muted-foreground" />}
            {state === 'SENDING' && <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />}
            {state === 'NOT_ATTEMPTED' && <MessageSquare className="h-4 w-4 text-muted-foreground" />}
          </div>

          <div>
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <span>WhatsApp</span>
              {hasValidPhone && (
                <span className="font-normal text-muted-foreground text-[11px]">
                  ({maskedPhone})
                </span>
              )}
            </div>

            <p className="text-xs mt-0.5 font-medium leading-snug">
              {state === 'SENT' && '🟢 Invoice sent to WhatsApp'}
              {state === 'PARTIAL' && (
                <span className="block">
                  <span className="text-amber-700 dark:text-amber-300 font-semibold">🟡 Invoice PDF sent</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">⚠️ Follow-up message failed</span>
                </span>
              )}
              {state === 'FAILED' && '🔴 WhatsApp invoice delivery failed'}
              {state === 'SKIPPED' && '⚪ WhatsApp not sent — no valid customer mobile number'}
              {state === 'SENDING' && '🔄 Dispatching invoice to WhatsApp...'}
              {state === 'NOT_ATTEMPTED' && '⚪ WhatsApp delivery not attempted yet'}
            </p>
          </div>
        </div>

        {/* Action Button: Retry WhatsApp / Send WhatsApp */}
        {hasValidPhone && (
          <Button
            size="sm"
            variant={state === 'FAILED' || state === 'PARTIAL' ? 'destructive' : 'outline'}
            onClick={handleRetry}
            disabled={isRetrying}
            className={`h-8 px-2.5 text-xs font-semibold shrink-0 gap-1.5 shadow-none ${
              state === 'FAILED' || state === 'PARTIAL'
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-background hover:bg-muted border-border text-foreground'
            }`}
          >
            {isRetrying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : state === 'SENT' ? (
              <RotateCw className="h-3.5 w-3.5" />
            ) : state === 'FAILED' || state === 'PARTIAL' ? (
              <RotateCw className="h-3.5 w-3.5" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {isRetrying
              ? 'Sending...'
              : state === 'SENT'
              ? 'Resend'
              : state === 'FAILED' || state === 'PARTIAL'
              ? 'Retry'
              : 'Send'}
          </Button>
        )}
      </div>
    </div>
  );
}
