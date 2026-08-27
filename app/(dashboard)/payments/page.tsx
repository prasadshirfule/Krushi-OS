import { getPayments, getTodayPaymentTotals } from '@/services/payments.service';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Payments | KRUSHI OS',
};

export default async function PaymentsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const isDemo = cookieStore.get('krushi_demo_session')?.value === 'true';
  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  const effectiveUser = user || ((isDemo || isPlaceholder) ? { id: 'demo-admin-id', email: 'admin@krushios.com' } : null);
  if (!effectiveUser) {
    redirect('/login');
  }

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

  const [{ payments, total }, todayTotals] = await Promise.all([
    getPayments(shopId, { limit: 50 }),
    getTodayPaymentTotals(shopId)
  ]);

  const columns = [
    { 
      accessorKey: 'payment_date', 
      header: 'Date',
      cell: ({ row }: any) => formatDate(row.original.payment_date || row.original.created_at)
    },
    { 
      accessorKey: 'payment_type', 
      header: 'Type', 
      cell: ({ row }: any) => {
        const type = row.original.payment_type;
        const isIncoming = type === 'SALE' || type === 'CUSTOMER_PAYMENT';
        return (
          <Badge variant={isIncoming ? 'default' : 'secondary'}>
            {isIncoming ? 'Incoming' : 'Outgoing'} ({type})
          </Badge>
        );
      } 
    },
    { 
      accessorKey: 'party', 
      header: 'Party / Reference',
      cell: ({ row }: any) => {
        const partyName = row.original.customer?.name || row.original.supplier?.name || row.original.reference_type || 'General';
        return <span className="font-medium">{partyName}</span>;
      }
    },
    { accessorKey: 'payment_method', header: 'Method' },
    { 
      accessorKey: 'amount', 
      header: 'Amount',
      cell: ({ row }: any) => (
        <span className="font-bold">
          {formatCurrency(Number(row.original.amount || 0))}
        </span>
      )
    },
    { accessorKey: 'notes', header: 'Notes', cell: ({ row }: any) => row.original.notes || '-' }
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Payments Log</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Total Collected Today</h3>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {formatCurrency(todayTotals.collected)}
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Total Paid Today</h3>
          <div className="text-3xl font-bold text-red-600 mt-2">
            {formatCurrency(todayTotals.paid)}
          </div>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          No payment transactions found. Payments from completed sales, purchases, and ledger entries will appear here.
        </div>
      ) : (
        <DataTable columns={columns} data={payments} searchKey="payment_method" />
      )}
    </div>
  );
}
