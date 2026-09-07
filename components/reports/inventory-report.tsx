"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ReportFilterMeta } from "@/lib/report-export";

interface InventoryReportProps {
  data?: {
    products: any[];
    totalValue: number;
    lowStockCount: number;
  };
  onFilterChange?: (filteredData: any, meta: Partial<ReportFilterMeta>) => void;
}

export function InventoryReport({ data, onFilterChange }: InventoryReportProps) {
  const [subTab, setSubTab] = useState<string>("current");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const rawProducts = useMemo(() => data?.products || [], [data?.products]);

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return rawProducts;
    const q = searchQuery.toLowerCase().trim();
    return rawProducts.filter((p: any) => {
      const nameMatch = (p.name || "").toLowerCase().includes(q);
      const skuMatch = (p.sku || "").toLowerCase().includes(q);
      const catMatch = (p.category?.name || "").toLowerCase().includes(q);
      return nameMatch || skuMatch || catMatch;
    });
  }, [rawProducts, searchQuery]);

  const lowStock = useMemo(() => {
    return filteredProducts.filter((p: any) => Number(p.current_stock || 0) <= Number(p.min_stock || 5));
  }, [filteredProducts]);

  // Active dataset according to selected sub-tab
  const activeProducts = subTab === "low" ? lowStock : filteredProducts;

  // Recalculate totals
  const totalVal = useMemo(() => {
    return activeProducts.reduce(
      (acc: number, p: any) => acc + Number(p.current_stock || 0) * Number(p.purchase_price || 0),
      0
    );
  }, [activeProducts]);

  // Sync with parent export toolbar
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(
        {
          products: activeProducts,
          totalValue: totalVal,
          lowStockCount: lowStock.length,
        },
        {
          statusFilter: subTab === "low" ? "Low Stock Items Only" : "All Current Stock",
          searchQuery: searchQuery.trim() || undefined,
        }
      );
    }
  }, [activeProducts, totalVal, lowStock.length, subTab, searchQuery, onFilterChange]);

  const columns = [
    { accessorKey: "name", header: "Product Name" },
    {
      accessorKey: "sku",
      header: "SKU",
      cell: ({ row }: any) => row.original.sku || "N/A",
    },
    {
      accessorKey: "current_stock",
      header: "Stock Level",
      cell: ({ row }: any) => (
        <span className="font-bold">
          {row.original.current_stock} {row.original.unit || "Piece"}
        </span>
      ),
    },
    {
      accessorKey: "purchase_price",
      header: "Purchase Cost",
      cell: ({ row }: any) => formatCurrency(Number(row.original.purchase_price || 0)),
    },
    {
      accessorKey: "value",
      header: "Inventory Value",
      cell: ({ row }: any) =>
        formatCurrency(Number(row.original.current_stock || 0) * Number(row.original.purchase_price || 0)),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: any) => {
        const isLow = Number(row.original.current_stock || 0) <= Number(row.original.min_stock || 5);
        return (
          <Badge variant={isLow ? "destructive" : "default"}>
            {isLow ? "Low Stock" : "In Stock"}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="flex flex-col sm:flex-row gap-4 mb-2">
        <div className="p-4 border rounded-lg bg-card flex-1 shadow-xs">
          <div className="text-sm font-medium text-muted-foreground">Total Inventory Value</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {formatCurrency(data?.totalValue || 0)}
          </div>
        </div>
        <div className="p-4 border rounded-lg bg-card flex-1 shadow-xs">
          <div className="text-sm font-medium text-muted-foreground">Low Stock Count</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{data?.lowStockCount || 0}</div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Tabs value={subTab} onValueChange={setSubTab} className="w-full sm:w-auto">
          <TabsList className="bg-muted">
            <TabsTrigger value="current">Current Stock ({filteredProducts.length})</TabsTrigger>
            <TabsTrigger value="low">Low Stock ({lowStock.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="w-full sm:w-72">
          <Input
            placeholder="Filter by product name / SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
      </div>

      <div>
        {subTab === "current" ? (
          filteredProducts.length === 0 ? (
            <div className="p-8 border border-dashed rounded-md text-center text-muted-foreground">
              No inventory records found.
            </div>
          ) : (
            <DataTable columns={columns} data={filteredProducts} />
          )
        ) : lowStock.length === 0 ? (
          <div className="p-8 border border-dashed rounded-md text-center text-muted-foreground">
            No low stock items found.
          </div>
        ) : (
          <DataTable columns={columns} data={lowStock} />
        )}
      </div>
    </div>
  );
}
