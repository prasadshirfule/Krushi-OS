import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ExpenseFormDialog } from '@/components/expenses/expense-form-dialog';
import { DataTable } from '@/components/ui/data-table';

export default async function ExpensesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
        <ExpenseFormDialog />
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="text-sm font-medium text-muted-foreground">Total This Month</div>
          <div className="text-2xl font-bold">₹0.00</div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="text-sm font-medium text-muted-foreground">Average Daily</div>
          <div className="text-2xl font-bold">₹0.00</div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="text-sm font-medium text-muted-foreground">Top Category</div>
          <div className="text-2xl font-bold">None</div>
        </div>
      </div>

      <div className="rounded-md border">
        {/* DataTable would go here */}
      </div>
    </div>
  );
}
