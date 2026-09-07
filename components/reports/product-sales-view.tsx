"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Printer,
  Loader2,
  ArrowLeft,
  Package,
  Calendar,
  Layers,
  TrendingUp,
  AlertCircle,
  Receipt,
  IndianRupee,
  RefreshCw
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ShopDetails } from "@/lib/shop-details";
import { formatProductNameWithSize } from "@/lib/validations";
import { exportReportToPDF, printReportDocument, formatDateValue, getSalePaymentMethodDisplay } from "@/lib/report-export";
import { getProductSalesReportAction } from "@/actions/reports";
import { toast } from "sonner";

interface ProductSalesReportViewProps {
  product: {
    id: string;
    name: string;
    sku?: string;
    pack_size?: string;
    unit?: string;
    current_stock?: number;
    purchase_price?: number;
    selling_price?: number;
    category?: { name?: string };
    [key: string]: any;
  };
  shopProfile: ShopDetails;
  onBack: () => void;
}

export function ProductSalesReportView({
  product,
  shopProfile,
  onBack,
}: ProductSalesReportViewProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [salesData, setSalesData] = useState<{
    items: any[];
    totalQuantity: number;
    totalSales: number;
    totalGST: number;
    totalInvoices: number;
  }>({
    items: [],
    totalQuantity: 0,
    totalSales: 0,
    totalGST: 0,
    totalInvoices: 0,
  });

  const [preset, setPreset] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const formattedProductName = useMemo(() => {
    if (!product) return "Product Sales Report";
    return formatProductNameWithSize(product.name, product.pack_size, product.unit);
  }, [product]);

  const fetchSales = () => {
    if (!product?.id) {
      setErrorMessage("No product identifier provided.");
      return;
    }
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const res = await getProductSalesReportAction(product.id, {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });
        if (res.success && res.data) {
          setSalesData({
            items: res.data.items || [],
            totalQuantity: res.data.totalQuantity || 0,
            totalSales: res.data.totalSales || 0,
            totalGST: res.data.totalGST || 0,
            totalInvoices: res.data.totalInvoices || 0,
          });
        } else {
          const errMsg = (res as any).error || "Unable to load product sales. Please try again.";
          setErrorMessage(errMsg);
          toast.error(errMsg);
        }
      } catch (err) {
        console.error("Failed to load product sales:", err);
        setErrorMessage("Unable to load product sales. Please try again.");
        toast.error("Unable to load product sales. Please try again.");
      }
    });
  };

  useEffect(() => {
    fetchSales();
  }, [product?.id, dateFrom, dateTo]);

  const applyPreset = (newPreset: string) => {
    setPreset(newPreset);
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    if (newPreset === "all") {
      setDateFrom("");
      setDateTo("");
    } else if (newPreset === "7d") {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      setDateFrom(d.toISOString().split("T")[0]);
      setDateTo(todayStr);
    } else if (newPreset === "30d") {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      setDateFrom(d.toISOString().split("T")[0]);
      setDateTo(todayStr);
    } else if (newPreset === "90d") {
      const d = new Date(now);
      d.setDate(d.getDate() - 89);
      setDateFrom(d.toISOString().split("T")[0]);
      setDateTo(todayStr);
    }
  };

  const getReportMeta = () => {
    let rangeLabel = "All Time";
    if (dateFrom && dateTo) {
      rangeLabel = `${dateFrom} to ${dateTo}`;
    } else if (dateFrom) {
      rangeLabel = `From ${dateFrom}`;
    } else if (dateTo) {
      rangeLabel = `Up to ${dateTo}`;
    }

    return {
      reportType: "product_sales" as const,
      title: "Product Sales Report",
      dateRange: rangeLabel,
      periodLabel: preset !== "all" ? preset.toUpperCase() : "All Records",
      productInfo: {
        id: product.id,
        name: product.name || "",
        sku: product.sku,
        pack_size: product.pack_size,
        unit: product.unit,
      },
    };
  };

  const handleExportPDF = async () => {
    if (isExportingPdf || isPrinting) return;
    setIsExportingPdf(true);
    try {
      await exportReportToPDF("product_sales", salesData, getReportMeta(), shopProfile);
      toast.success("Product Sales Report exported to PDF successfully.");
    } catch (err) {
      console.error("PDF Export error:", err);
      toast.error("Unable to generate product sales report. Please try again.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    if (isExportingPdf || isPrinting) return;
    setIsPrinting(true);
    try {
      printReportDocument("product_sales", salesData, getReportMeta(), shopProfile);
    } catch (err) {
      console.error("Print error:", err);
      toast.error("Unable to generate print preview.");
    } finally {
      setTimeout(() => {
        setIsPrinting(false);
      }, 800);
    }
  };

  const columns = [
    {
      accessorKey: "invoice_number",
      header: "Invoice #",
      cell: ({ row }: any) => (
        <span className="font-semibold text-foreground">{row.original.invoice_number}</span>
      ),
    },
    {
      accessorKey: "sale_date",
      header: "Date",
      cell: ({ row }: any) => formatDateValue(row.original.sale_date),
    },
    {
      accessorKey: "customer_name",
      header: "Customer",
      cell: ({ row }: any) => (
        <div>
          <div className="font-medium">{row.original.customer_name}</div>
          {row.original.customer_mobile && row.original.customer_mobile !== "-" && (
            <div className="text-xs text-muted-foreground">{row.original.customer_mobile}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "quantity",
      header: "Qty",
      cell: ({ row }: any) => (
        <span className="font-bold">
          {row.original.quantity} {product?.unit || "Piece"}
        </span>
      ),
    },
    {
      accessorKey: "unit_price",
      header: "MRP / Price",
      cell: ({ row }: any) => formatCurrency(Number(row.original.unit_price || 0)),
    },
    {
      accessorKey: "gst_amount",
      header: "GST",
      cell: ({ row }: any) => (
        <div>
          <div>{formatCurrency(Number(row.original.gst_amount || 0))}</div>
          {Number(row.original.gst_rate || 0) > 0 && (
            <div className="text-xs text-muted-foreground">{row.original.gst_rate}% GST</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "total_amount",
      header: "Total",
      cell: ({ row }: any) => (
        <span className="font-bold text-foreground">
          {formatCurrency(Number(row.original.total_amount || 0))}
        </span>
      ),
    },
    {
      accessorKey: "payment_mode",
      header: "Payment",
      cell: ({ row }: any) => {
        const mode = getSalePaymentMethodDisplay(row.original);
        let badgeStyle = "bg-muted text-muted-foreground border-muted";
        if (mode.includes("CASH")) {
          badgeStyle = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
        } else if (mode.includes("UPI")) {
          badgeStyle = "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
        } else if (mode.includes("BANK") || mode.includes("CARD")) {
          badgeStyle = "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20";
        } else if (mode.includes("CREDIT")) {
          badgeStyle = "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
        } else if (mode.includes("PARTIAL")) {
          badgeStyle = "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
        }
        return (
          <Badge variant="outline" className={`font-semibold tracking-wide text-[11px] ${badgeStyle}`}>
            {mode}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Top Header Card with Back Button & Export Controls */}
      <div className="p-5 border rounded-xl bg-card shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="h-9 px-3 gap-1.5 font-medium hover:bg-accent"
            title="Return to Inventory Report"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Inventory</span>
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                PRODUCT SALES REPORT
              </span>
              {product?.category?.name && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                  {product.category.name}
                </Badge>
              )}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
              {formattedProductName}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
              <span>
                SKU: <strong className="text-foreground">{product.sku || "N/A"}</strong>
              </span>
              <span>•</span>
              <span>
                Current Stock:{" "}
                <strong className="text-foreground">
                  {product.current_stock ?? 0} {product.unit || "Piece"}
                </strong>
              </span>
              {Number(product.purchase_price || 0) > 0 && (
                <>
                  <span>•</span>
                  <span>
                    Purchase Cost:{" "}
                    <strong className="text-foreground">
                      {formatCurrency(Number(product.purchase_price))}
                    </strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={isExportingPdf || isPrinting || isPending}
            className="h-9 px-3 text-xs sm:text-sm font-medium shadow-xs"
            title="Download Product Sales PDF"
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin text-rose-600" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <FileText className="mr-1.5 h-4 w-4 text-rose-600" />
                <span>Download PDF</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={isExportingPdf || isPrinting || isPending}
            className="h-9 px-3 text-xs sm:text-sm font-medium shadow-xs"
            title="Print Product Sales Report"
          >
            {isPrinting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin text-blue-600" />
                <span>Preparing Print...</span>
              </>
            ) : (
              <>
                <Printer className="mr-1.5 h-4 w-4 text-blue-600" />
                <span>Print</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Date Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 border rounded-lg bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant={preset === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset("all")}
            className="h-8 text-xs px-3"
          >
            All Time
          </Button>
          <Button
            variant={preset === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset("7d")}
            className="h-8 text-xs px-3"
          >
            7 Days
          </Button>
          <Button
            variant={preset === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset("30d")}
            className="h-8 text-xs px-3"
          >
            30 Days
          </Button>
          <Button
            variant={preset === "90d" ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset("90d")}
            className="h-8 text-xs px-3"
          >
            90 Days
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPreset("custom");
            }}
            className="w-[135px] text-xs h-8"
            title="From Date"
          />
          <span className="text-xs text-muted-foreground font-medium">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPreset("custom");
            }}
            className="w-[135px] text-xs h-8"
            title="To Date"
          />
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Quantity Sold</span>
            <Package className="h-4 w-4 text-muted-foreground/70" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {salesData.totalQuantity}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {product?.unit || "Piece"}
            </span>
          </div>
        </Card>

        <Card className="p-4 bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Sales</span>
            <IndianRupee className="h-4 w-4 text-green-600/70" />
          </div>
          <div className="text-2xl font-bold text-green-600 mt-2">
            {formatCurrency(salesData.totalSales)}
          </div>
        </Card>

        <Card className="p-4 bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total GST</span>
            <Receipt className="h-4 w-4 text-muted-foreground/70" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {formatCurrency(salesData.totalGST)}
          </div>
        </Card>

        <Card className="p-4 bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Invoices</span>
            <TrendingUp className="h-4 w-4 text-blue-600/70" />
          </div>
          <div className="text-2xl font-bold text-blue-600 mt-2">
            {salesData.totalInvoices}
          </div>
        </Card>
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="p-4 border border-destructive/40 bg-destructive/10 rounded-lg flex items-center justify-between gap-3 text-destructive text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSales}
            className="h-7 text-xs border-destructive/30 hover:bg-destructive/20"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Retry
          </Button>
        </div>
      )}

      {/* Sales Transactions Table */}
      <div className="space-y-2">
        {isPending ? (
          <div className="h-56 flex flex-col items-center justify-center text-muted-foreground text-sm border rounded-lg bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
            <span>Loading product sales records...</span>
          </div>
        ) : salesData.items.length === 0 ? (
          <div className="p-12 border border-dashed rounded-lg text-center bg-card">
            <Package className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <div className="text-base font-medium text-foreground">
              No sales found for this product.
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              This product does not have any completed sales transactions recorded in the selected period.
            </p>
          </div>
        ) : (
          <div className="border rounded-lg bg-card shadow-xs overflow-hidden">
            <DataTable columns={columns} data={salesData.items} />
          </div>
        )}
      </div>
    </div>
  );
}
