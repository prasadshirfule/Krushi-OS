"use client";

import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Receipt } from "lucide-react";

interface ExpenseTableProps {
  initialExpenses?: any[];
}

export function ExpenseTable({ initialExpenses = [] }: ExpenseTableProps) {
  const columns = [
    { 
      accessorKey: "expense_date", 
      header: "Date",
      cell: ({ row }: any) => formatDate(row.original.expense_date || row.original.created_at)
    },
    { 
      accessorKey: "description", 
      header: "Description",
      cell: ({ row }: any) => <span className="font-medium text-foreground">{row.original.description}</span>
    },
    { 
      accessorKey: "category", 
      header: "Category",
      cell: ({ row }: any) => {
        const catName = row.original.expense_categories?.name || row.original.category || 'General';
        return <Badge variant="outline">{catName}</Badge>;
      }
    },
    { 
      accessorKey: "payment_method", 
      header: "Payment Method",
      cell: ({ row }: any) => <Badge variant="secondary">{row.original.payment_method || 'CASH'}</Badge>
    },
    { 
      accessorKey: "amount", 
      header: "Amount (₹)",
      cell: ({ row }: any) => (
        <span className="font-bold text-red-600 text-base">
          {formatCurrency(Number(row.original.amount || 0))}
        </span>
      )
    },
  ];

  if (initialExpenses.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="h-10 w-10 text-muted-foreground/50" />}
        title="No expenses recorded yet"
        description="Track shop rent, electricity, salaries, transport charges, and other daily operational costs here."
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={initialExpenses}
      searchKey="description"
      searchPlaceholder="Search expenses..."
    />
  );
}
