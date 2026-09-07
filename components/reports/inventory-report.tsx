"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { History } from "lucide-react";
import { ReportFilterMeta } from "@/lib/report-export";
import { ShopDetails, DEFAULT_SHOP_DETAILS } from "@/lib/shop-details";
import { formatProductNameWithSize } from "@/lib/validations";
import { ProductSalesModal } from "@/components/reports/product-sales-modal";

interface InventoryReportProps {
  data?: {
    products: any[];
    totalValue: number;
    lowStockCount: number;
  };
  shopProfile?: ShopDetails;
  onFilterChange?: (filteredData: any, meta: Partial<ReportFilterMeta>) => void;
}

export function InventoryReport({
  data,
  shopProfile = DEFAULT_SHOP_DETAILS,
  onFilterChange,
}: InventoryReportProps) {
  const [subTab, setSubTab] = useState<string>("current");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedProductForSales, setSelectedProductForSales] = useState<any | null>(null);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);

  const rawProducts = useMemo(() => data?.products || [], [data?.products]);

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return rawProducts;
    const q = searchQuery.toLowerCase().trim();
    return rawProducts.filter((p: any) => {
      const formattedName = formatProductNameWithSize(p.name, p.pack_size, p.unit).toLowerCase();
      const rawName = (p.name || "").toLowerCase();
      const skuMatch = (p.sku || "").toLowerCase().includes(q);
      const catMatch = (p.category?.name || "").toLowerCase().includes(q);
      return formattedName.includes(q) || rawName.includes(q) || skuMatch || catMatch;
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

  const handleOpenProductSales = (prod: any) => {
    setSelectedProductForSales(prod);
    setIsSalesModalOpen(true);
  };

  const columns = [
    {
      accessorKey: "name",
      header: "Product Name",
      cell: ({ row }: any) => {
        const displayName = formatProductNameWithSize(
          row.original.name,
          row.original.pack_size,
          row.original.unit
        );
        return <span className="font-semibold text-foreground">{displayName || row.original.name}</span>;
      },
    },
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
    {
      id: "actions",
      header: "Action",
      cell: ({ row }: any) => {
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenProductSales(row.original)}
            className="h-7 px-2 text-xs font-medium text-primary hover:bg-primary/10 border-primary/30"
            title="View Product Sales History"
          >
            <History className="h-3.5 w-3.5 mr-1" />
            Sales
          </Button>
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

      {/* Product Sales History Modal */}
      {selectedProductForSales && (
        <ProductSalesModal
          product={selectedProductForSales}
          isOpen={isSalesModalOpen}
          onClose={() => {
            setIsSalesModalOpen(false);
            setSelectedProductForSales(null);
          }}
          shopProfile={shopProfile}
        />
      )}
    </div>
  );
}
