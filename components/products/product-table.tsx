'use client';

import React, { useMemo } from 'react';
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Trash2, Eye, Edit } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { formatToDDMMYYYY, formatProductPackDisplay } from "@/lib/validations";
import { EmptyState } from "@/components/ui/empty-state";
import { Package } from "lucide-react";

export function getProductColumns(onDelete?: (product: any) => void): ColumnDef<any>[] {
  return [
    {
      accessorKey: "name",
      header: "Product",
      cell: ({ row }) => {
        const prod = row.original;
        const packDisplay = formatProductPackDisplay(prod);
        const firstBatch = prod.batches?.[0];
        const batchNo = prod.batch_number || firstBatch?.batch_number;
        const rawExp = prod.expiry_date || firstBatch?.expiry_date || firstBatch?.exp_date;
        const expStr = rawExp ? formatToDDMMYYYY(rawExp) : null;

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/products/${prod.id}`} className="font-semibold text-foreground hover:text-primary hover:underline block leading-snug">
                {prod.name}
              </Link>
              {packDisplay && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  {packDisplay}
                </span>
              )}
            </div>
            {(batchNo || expStr) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {batchNo && <span>Batch: <span className="font-mono font-medium text-foreground/90">{batchNo}</span></span>}
                {batchNo && expStr && <span>•</span>}
                {expStr && <span>Expiry: <span className="font-medium text-foreground/90">{expStr}</span></span>}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "category.name",
      header: "Category",
      cell: ({ row }) => row.original.category?.name || 'Uncategorized',
    },
    {
      accessorKey: "selling_price",
      header: "Selling Price",
      cell: ({ row }) => (
        <span className="font-bold text-foreground">
          {formatCurrency(Number(row.getValue("selling_price") || 0))}
        </span>
      ),
    },
    {
      accessorKey: "current_stock",
      header: "Stock",
      cell: ({ row }) => {
        const stock = Number(row.original.current_stock || 0);
        const minStock = Number(row.original.min_stock || 0);
        const isLow = stock <= minStock;
        return (
          <span className={isLow ? "text-destructive font-bold" : "text-primary font-bold"}>
            {stock} Pieces
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
                <Link href={`/products/${product.id}`} className="cursor-pointer">
                  <Eye className="h-3.5 w-3.5 mr-2" /> View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/products/${product.id}/edit`} className="cursor-pointer">
                  <Edit className="h-3.5 w-3.5 mr-2" /> Edit Product
                </Link>
              </DropdownMenuItem>
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive cursor-pointer"
                    onClick={() => onDelete(product)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Product
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

export const columns = getProductColumns();

interface ProductTableProps {
  initialData?: any[];
  categories?: any[];
  onDelete?: (product: any) => void;
}

export function ProductTable({ initialData = [], categories = [], onDelete }: ProductTableProps) {
  const tableColumns = useMemo(() => getProductColumns(onDelete), [onDelete]);

  if (initialData.length === 0) {
    return (
      <EmptyState
        icon={<Package className="h-10 w-10 text-muted-foreground/50" />}
        title="No products in your catalog yet"
        description="Add your first agricultural product — seeds, fertilizers, pesticides, or equipment."
        actionLabel="+ Add Product"
        actionHref="/products/new"
        guidanceSteps={[
          { label: 'Categories', href: '/categories' },
          { label: 'Products', href: '/products/new' },
          { label: 'Suppliers', href: '/suppliers' },
          { label: 'Purchases (Stock In)', href: '/purchases/new' },
          { label: 'Billing / POS', href: '/billing' },
        ]}
      />
    );
  }

  return (
    <DataTable
      columns={tableColumns}
      data={initialData}
      searchKey="name"
      searchPlaceholder="Search products by name..."
    />
  );
}
