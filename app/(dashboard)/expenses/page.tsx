import { getExpenses } from '@/services/expenses.service';
import { ExpenseFormDialog } from '@/components/expenses/expense-form-dialog';
import { ExpenseTable } from '@/components/expenses/expense-table';
import { formatCurrency } from '@/lib/utils';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Expenses | KRUSHI OS',
};

export default async function ExpensesPage() {
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

  const { expenses } = await getExpenses(shopId, { limit: 50 }).catch(() => ({ expenses: [], total: 0 }));

  const totalThisMonth = expenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
  const avgDaily = expenses.length > 0 ? totalThisMonth / 30 : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shop Expenses</h1>
          <p className="text-sm text-muted-foreground">Track operating expenses, shop rent, utility bills, and transport costs</p>
        </div>
        <ExpenseFormDialog />
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="text-sm font-medium text-muted-foreground">Total Expenses</div>
          <div className="text-3xl font-bold text-red-600 mt-2">{formatCurrency(totalThisMonth)}</div>
          <p className="text-xs text-muted-foreground mt-1">{expenses.length} expense entries recorded</p>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="text-sm font-medium text-muted-foreground">Average Daily</div>
          <div className="text-3xl font-bold mt-2">{formatCurrency(avgDaily)}</div>
          <p className="text-xs text-muted-foreground mt-1">Estimated daily operating run rate</p>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="text-sm font-medium text-muted-foreground">Recent Expense Count</div>
          <div className="text-3xl font-bold mt-2">{expenses.length}</div>
          <p className="text-xs text-muted-foreground mt-1">Total active receipts</p>
        </div>
      </div>

      <ExpenseTable initialExpenses={expenses} />
    </div>
  );
}
