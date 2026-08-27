'use client';

import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

export const columns: ColumnDef<any>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <Link href={`/products/${row.original.id}`} className="font-medium text-blue-600 hover:underline">
        {row.getValue("name")}
      </Link>
    ),
  },
  {
    accessorKey: "sku",
    header: "SKU",
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.sku || 'N/A'}</span>
  },
  {
    accessorKey: "category.name",
    header: "Category",
    cell: ({ row }) => row.original.category?.name || 'Uncategorized',
  },
  {
    accessorKey: "selling_price",
    header: "Selling Price",
    cell: ({ row }) => formatCurrency(Number(row.getValue("selling_price") || 0)),
  },
  {
    accessorKey: "current_stock",
    header: "Stock",
    cell: ({ row }) => {
      const stock = Number(row.original.current_stock || 0);
      const minStock = Number(row.original.min_stock || 0);
      const isLow = stock <= minStock;
      return (
        <span className={isLow ? "text-red-600 font-semibold" : "text-green-600 font-medium"}>
          {stock} {row.original.unit || 'Piece'}
        </span>
      );
    },
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => {
      const isActive = row.original.is_active !== false;
      return (
        <Badge variant={isActive ? "default" : "secondary"}>
          {isActive ? "Active" : "Inactive"}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const product = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/products/${product.id}`}>View Details</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/products/${product.id}/edit`}>Edit Product</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export function ProductTable({ initialData = [], categories = [] }: { initialData?: any[], categories?: any[] }) {
  if (initialData.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
        No products found in catalog. Click &quot;Add Product&quot; to create a new product.
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={initialData}
      searchKey="name"
      searchPlaceholder="Search products by name..."
    />
  );
}
