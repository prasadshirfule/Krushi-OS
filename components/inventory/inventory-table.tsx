"use client";

import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

interface InventoryTableProps {
  initialItems?: any[];
}

export function InventoryTable({ initialItems = [] }: InventoryTableProps) {
  const columns = [
    { 
      accessorKey: "name", 
      header: "Product Name",
      cell: ({ row }: any) => (
        <div>
          <Link href={`/products/${row.original.id}`} className="font-semibold text-primary hover:underline">
            {row.original.name}
          </Link>
          <div className="text-xs text-muted-foreground">{row.original.category?.name || 'Uncategorized'}</div>
        </div>
      )
    },
    { 
      accessorKey: "sku", 
      header: "SKU / Code",
      cell: ({ row }: any) => <span className="font-mono text-xs">{row.original.sku || '-'}</span>
    },
    { 
      accessorKey: "total_stock", 
      header: "Current Stock",
      cell: ({ row }: any) => (
        <span className="font-bold text-base">
          {row.original.total_stock} {row.original.unit || ''}
        </span>
      )
    },
    { 
      accessorKey: "min_stock", 
      header: "Min Stock",
      cell: ({ row }: any) => <span>{row.original.min_stock} {row.original.unit || ''}</span>
    },
    { 
      accessorKey: "status", 
      header: "Stock Status",
      cell: ({ row }: any) => {
        const status = row.original.status;
        const variant = status === 'In Stock' ? 'default' : status === 'Low Stock' ? 'secondary' : 'destructive';
        return (
          <Badge variant={variant} className={status === 'In Stock' ? 'bg-green-600' : ''}>
            {status}
          </Badge>
        );
      }
    },
    { 
      accessorKey: "inventory_value", 
      header: "Inventory Value",
      cell: ({ row }: any) => (
        <span className="font-semibold text-green-700">
          {formatCurrency(row.original.inventory_value)}
        </span>
      )
    },
    {
      accessorKey: "batches",
      header: "Active Batches",
      cell: ({ row }: any) => {
        const batchCount = (row.original.batches || []).filter((b: any) => b.quantity_available > 0).length;
        return <span className="text-xs text-muted-foreground">{batchCount} active batch(es)</span>;
      }
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: any) => (
        <Link href={`/products/${row.original.id}`}>
          <Button variant="ghost" size="sm">
            <Eye className="h-4 w-4 mr-1" /> View
          </Button>
        </Link>
      )
    }
  ];

  if (initialItems.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground bg-card">
        <h3 className="text-lg font-semibold mb-1">No Inventory Items Found</h3>
        <p className="text-sm max-w-sm mx-auto mb-4">
          Add products and record purchases with opening stock to track inventory.
        </p>
        <Link href="/products/new">
          <Button className="bg-primary">Add Product</Button>
        </Link>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={initialItems}
      searchKey="name"
      searchPlaceholder="Filter inventory products..."
    />
  );
}
