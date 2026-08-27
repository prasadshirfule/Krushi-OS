import { getPayments, getTodayPaymentTotals } from '@/services/payments.service';
import { PaymentTable } from '@/components/payments/payment-table';
import { formatCurrency } from '@/lib/utils';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payments | KRUSHI OS',
};

export default async function PaymentsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  let shopId = 'demo-shop-1';
  if (user && !isPlaceholder) {
    const { data: userData } = await supabase
      .from('users')
      .select('shop_id')
      .eq('id', user.id)
      .single();
    if (userData?.shop_id) {
      shopId = userData.shop_id;
    }
  }

  const [{ payments }, todayTotals] = await Promise.all([
    getPayments(shopId, { limit: 50 }),
    getTodayPaymentTotals(shopId)
  ]);

  return (
    <div className="space-y-6 p-6">
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
