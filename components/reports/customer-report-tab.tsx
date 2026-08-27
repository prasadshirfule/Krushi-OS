"use client";

import { DataTable } from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";

export function CustomerReportTab({ customers = [] }: { customers?: any[] }) {
  const customerColumns = [
    { accessorKey: "name", header: "Customer Name" },
    { accessorKey: "mobile", header: "Mobile" },
    { accessorKey: "village", header: "Village" },
    { 
      accessorKey: "total_purchases", 
      header: "Total Purchases", 
      cell: ({ row }: any) => formatCurrency(Number(row.original.total_purchases || 0)) 
    },
    { 
      accessorKey: "outstanding", 
      header: "Outstanding", 
      cell: ({ row }: any) => (
        <span className={Number(row.original.outstanding || 0) > 0 ? "text-red-600 font-bold" : ""}>
          {formatCurrency(Number(row.original.outstanding || 0))}
        </span>
      ) 
    }
  ];

  if (customers.length === 0) {
    return (
      <div className="p-8 border border-dashed rounded-md text-center text-muted-foreground">
        No customer records for reporting.
      </div>
    );
  }

  return <DataTable columns={customerColumns} data={customers} searchKey="name" />;
}
