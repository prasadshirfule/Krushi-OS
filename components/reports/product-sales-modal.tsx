"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { FileText, Printer, Loader2, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ShopDetails } from "@/lib/shop-details";
import { formatProductNameWithSize } from "@/lib/validations";
import { exportReportToPDF, printReportDocument, formatDateValue, getSalePaymentMethodDisplay } from "@/lib/report-export";
import { getProductSalesReportAction } from "@/actions/reports";
import { toast } from "sonner";

interface ProductSalesModalProps {
  product: any | null;
  isOpen: boolean;
  onClose: () => void;
  shopProfile: ShopDetails;
}

export function ProductSalesModal({
  product,
  isOpen,
  onClose,
  shopProfile,
}: ProductSalesModalProps) {
  const [isPending, startTransition] = useTransition();
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
    if (!product) return "";
    return formatProductNameWithSize(product.name, product.pack_size, product.unit);
  }, [product]);

  // Load sales history when modal opens or dates change
  const fetchProductSales = () => {
    if (!product?.id) return;
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
          toast.error((res as any).error || "Unable to load product sales history.");
        }
      } catch (err) {
        console.error("Failed to load product sales:", err);
        toast.error("Failed to load product sales history.");
      }
    });
  };

  useEffect(() => {
    if (isOpen && product?.id) {
      fetchProductSales();
    }
  }, [isOpen, product?.id, dateFrom, dateTo]);

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
        id: product?.id,
        name: product?.name || "",
        sku: product?.sku,
        pack_size: product?.pack_size,
        unit: product?.unit,
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
      header: "Invoice No",
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
      header: "Qty Sold",
      cell: ({ row }: any) => (
        <span className="font-bold">
          {row.original.quantity} {product?.unit || "Piece"}
        </span>
      ),
    },
    {
      accessorKey: "unit_price",
      header: "Selling Price",
      cell: ({ row }: any) => formatCurrency(Number(row.original.unit_price || 0)),
    },
    {
      accessorKey: "gst_amount",
      header: "GST (₹)",
      cell: ({ row }: any) => (
        <div>
          <div>{formatCurrency(Number(row.original.gst_amount || 0))}</div>
          {row.original.gst_rate > 0 && (
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                {formattedProductName || product?.name || "Product Sales Report"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                SKU: <span className="font-medium text-foreground">{product?.sku || "N/A"}</span> • Current Stock:{" "}
                <span className="font-medium text-foreground">
                  {product?.current_stock ?? 0} {product?.unit || "Piece"}
                </span>
              </DialogDescription>
            </div>

            {/* Export Toolbar for Product Sales */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={isExportingPdf || isPrinting || isPending}
                className="h-8 px-3 text-xs"
                title="Download Product Sales PDF"
              >
                {isExportingPdf ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-rose-600" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <FileText className="mr-1.5 h-3.5 w-3.5 text-rose-600" />
                    <span>Download PDF</span>
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={isExportingPdf || isPrinting || isPending}
                className="h-8 px-3 text-xs"
                title="Print Product Sales"
              >
                {isPrinting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-blue-600" />
                    <span>Preparing Print...</span>
                  </>
                ) : (
                  <>
                    <Printer className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                    <span>Print</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Date Preset Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 p-3 border rounded-lg bg-card mt-2 shadow-xs">
          <div className="flex items-center gap-1.5">
            <Button
              variant={preset === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => applyPreset("all")}
              className="h-8 text-xs px-2.5"
            >
              All Time
            </Button>
            <Button
              variant={preset === "7d" ? "default" : "outline"}
              size="sm"
              onClick={() => applyPreset("7d")}
              className="h-8 text-xs px-2.5"
            >
              7D
            </Button>
            <Button
              variant={preset === "30d" ? "default" : "outline"}
              size="sm"
              onClick={() => applyPreset("30d")}
              className="h-8 text-xs px-2.5"
            >
              30D
            </Button>
            <Button
              variant={preset === "90d" ? "default" : "outline"}
              size="sm"
              onClick={() => applyPreset("90d")}
              className="h-8 text-xs px-2.5"
            >
              90D
            </Button>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPreset("custom");
              }}
              className="w-[130px] text-xs h-8"
              placeholder="From Date"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPreset("custom");
              }}
              className="w-[130px] text-xs h-8"
              placeholder="To Date"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-2">
          <Card className="p-3">
            <div className="text-xs font-medium text-muted-foreground">Total Quantity Sold</div>
            <div className="text-xl font-bold mt-1">
              {salesData.totalQuantity} {product?.unit || "Piece"}
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-xs font-medium text-muted-foreground">Total Sales Revenue</div>
            <div className="text-xl font-bold text-green-600 mt-1">
              {formatCurrency(salesData.totalSales)}
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-xs font-medium text-muted-foreground">Total GST Collected</div>
            <div className="text-xl font-bold mt-1">
              {formatCurrency(salesData.totalGST)}
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-xs font-medium text-muted-foreground">Number of Invoices</div>
            <div className="text-xl font-bold text-blue-600 mt-1">
              {salesData.totalInvoices}
            </div>
          </Card>
        </div>

        {/* Sales Table */}
        <div className="mt-2">
          {isPending ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm border rounded-md">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading product sales records...
            </div>
          ) : salesData.items.length === 0 ? (
            <div className="p-8 border border-dashed rounded-md text-center text-muted-foreground text-sm">
              No sales found for this product.
            </div>
          ) : (
            <DataTable columns={columns} data={salesData.items} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
