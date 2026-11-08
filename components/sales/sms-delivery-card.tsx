'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { resendInvoiceSmsAction } from '@/actions/sales';
import { toast } from 'sonner';

interface SmsDeliveryCardProps {
  sale: any;
}

export function SmsDeliveryCard({ sale }: SmsDeliveryCardProps) {
  const [isResending, setIsResending] = useState(false);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  const rawPhone =
    sale?.customer_phone ||
    sale?.customer?.phone ||
    sale?.customer?.mobile ||
    sale?.customerPhone;

  const hasPhone = Boolean(rawPhone && String(rawPhone).trim().length >= 10);
  const maskedPhone = hasPhone
    ? `${String(rawPhone).trim().slice(0, 2)}******${String(rawPhone).trim().slice(-2)}`
    : 'No mobile number';

  const handleResend = async () => {
    if (!sale?.id || isResending) return;

    setIsResending(true);
    try {
      const res = await resendInvoiceSmsAction(sale.id);
      if (res.success) {
        if (res.data?.success) {
          toast.success(res.data.message || 'Invoice SMS queued for delivery');
          setLastStatus('QUEUED');
        } else {
          toast.info(res.data?.message || 'SMS delivery skipped');
          setLastStatus(res.data?.reason || 'SKIPPED');
        }
      } else {
        toast.error(res.error || 'Failed to resend SMS notification');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error sending SMS');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className="border-border shadow-sm bg-card mb-4 no-print">
      <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-foreground">
                Transactional SMS Notification
              </h4>
              {hasPhone ? (
                <Badge variant="outline" className="text-[11px] bg-emerald-50/50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                  <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                  {maskedPhone}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                  <AlertCircle className="h-3 w-3 mr-1 text-amber-500" />
                  No Customer Phone
                </Badge>
              )}
              {lastStatus && (
                <Badge variant="secondary" className="text-[11px] uppercase tracking-wider font-mono">
                  {lastStatus}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Includes statutory bill details and 30-day verified statement download link.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={!hasPhone || isResending}
          onClick={handleResend}
          className="ml-auto font-medium shadow-sm hover:bg-muted"
        >
          {isResending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5 mr-1.5 text-primary" />
              Resend Bill SMS
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
