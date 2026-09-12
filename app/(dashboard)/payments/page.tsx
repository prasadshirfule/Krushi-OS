import { getPayments, getTodayPaymentTotals } from '@/services/payments.service';
import { PaymentTable } from '@/components/payments/payment-table';
import { formatCurrency } from '@/lib/utils';
import { getAuthAndPermissions } from '@/lib/auth-helper';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payments | KRUSHI OS',
};

export default async function PaymentsPage() {
  const user = await getAuthAndPermissions();
  const shopId = user.shop_id;

  const [{ payments }, todayTotals] = await Promise.all([
    getPayments(shopId, { limit: 50 }),
    getTodayPaymentTotals(shopId)
  ]);

  return (
    <div className="space-y-6 p-3 sm:p-6 min-w-0 max-w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments Log</h1>
          <p className="text-sm text-muted-foreground">Detailed history of customer collections and supplier disbursements</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Total Collected Today</h3>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {formatCurrency(todayTotals.collected)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Customer collections & cash/UPI sales</p>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Total Paid Today</h3>
          <div className="text-3xl font-bold text-red-600 mt-2">
            {formatCurrency(todayTotals.paid)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Supplier disbursements & payments</p>
        </div>
      </div>

      <PaymentTable initialPayments={payments} />
    </div>
  );
}
