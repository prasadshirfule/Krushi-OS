"use client";

import { DataTable } from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";

export function SupplierReportTab({ suppliers = [] }: { suppliers?: any[] }) {
  const supplierColumns = [
    { accessorKey: "name", header: "Supplier Name" },
    { accessorKey: "company", header: "Company" },
    { accessorKey: "mobile", header: "Mobile" },
    { 
      accessorKey: "total_purchases", 
      header: "Total Purchases", 
      cell: ({ row }: any) => formatCurrency(Number(row.original.total_purchases || 0)) 
    },
    { 
      accessorKey: "outstanding", 
      header: "Outstanding Payable", 
      cell: ({ row }: any) => (
        <span className={Number(row.original.outstanding || 0) > 0 ? "text-red-600 font-bold" : ""}>
          {formatCurrency(Number(row.original.outstanding || 0))}
        </span>
      ) 
    }
  ];

  if (suppliers.length === 0) {
    return (
      <div className="p-8 border border-dashed rounded-md text-center text-muted-foreground">
        No supplier records for reporting.
      </div>
    );
  }

  return <DataTable columns={supplierColumns} data={suppliers} searchKey="name" />;
}
