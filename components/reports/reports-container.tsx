"use client";

import React, { useState, useTransition } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ShopDetails } from "@/lib/shop-details";
import { exportReportToExcel, exportReportToPDF, printReportDocument, ReportFilterMeta } from "@/lib/report-export";
import { SalesReport } from "@/components/reports/sales-report";
import { InventoryReport } from "@/components/reports/inventory-report";
import { FinancialReport } from "@/components/reports/financial-report";
import { CustomerReportTab } from "@/components/reports/customer-report-tab";
import { SupplierReportTab } from "@/components/reports/supplier-report-tab";

interface ReportsContainerProps {
  initialSales: any;
  initialInventory: any;
  initialFinancial: any;
  initialCustomer: any;
  initialSupplier: any;
  shopProfile: ShopDetails;
}

export function ReportsContainer({
  initialSales,
  initialInventory,
  initialFinancial,
  initialCustomer,
  initialSupplier,
  shopProfile,
}: ReportsContainerProps) {
  const [activeTab, setActiveTab] = useState<string>("sales");
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Dynamic state holders for active report filters & filtered data from child components
  const [salesData, setSalesData] = useState<any>(initialSales);
  const [salesMeta, setSalesMeta] = useState<Partial<ReportFilterMeta>>({ periodLabel: "All Time" });

  const [inventoryData, setInventoryData] = useState<any>(initialInventory);
  const [inventoryMeta, setInventoryMeta] = useState<Partial<ReportFilterMeta>>({ statusFilter: "All Products" });

  const [financialData, setFinancialData] = useState<any>(initialFinancial);
  const [financialMeta, setFinancialMeta] = useState<Partial<ReportFilterMeta>>({ periodLabel: "All Time" });

  const [customerData, setCustomerData] = useState<any>(initialCustomer);
  const [customerMeta, setCustomerMeta] = useState<Partial<ReportFilterMeta>>({ statusFilter: "All Customers" });

  const [supplierData, setSupplierData] = useState<any>(initialSupplier);
  const [supplierMeta, setSupplierMeta] = useState<Partial<ReportFilterMeta>>({ statusFilter: "All Suppliers" });

  // Determine current active payload and metadata based on selected tab
  const getCurrentReportContext = () => {
    switch (activeTab) {
      case "sales":
        return {
          type: "sales" as const,
          data: salesData,
          meta: {
            reportType: "sales" as const,
            title: "Sales Report",
            ...salesMeta,
          },
        };
      case "inventory":
        return {
          type: "inventory" as const,
          data: inventoryData,
          meta: {
            reportType: "inventory" as const,
            title: "Inventory Report",
            ...inventoryMeta,
          },
        };
      case "financial":
        return {
          type: "financial" as const,
          data: financialData,
          meta: {
            reportType: "financial" as const,
            title: "Financial Report",
            ...financialMeta,
          },
        };
      case "customer":
        return {
          type: "customer" as const,
          data: customerData,
          meta: {
            reportType: "customer" as const,
            title: "Customer Report",
            ...customerMeta,
          },
        };
      case "supplier":
        return {
          type: "supplier" as const,
          data: supplierData,
          meta: {
            reportType: "supplier" as const,
            title: "Supplier Report",
            ...supplierMeta,
          },
        };
      default:
        return {
          type: "sales" as const,
          data: salesData,
          meta: {
            reportType: "sales" as const,
            title: "Sales Report",
            ...salesMeta,
          },
        };
    }
  };

  const handleExportExcel = async () => {
    if (isExportingExcel || isExportingPdf || isPrinting) return;
    setIsExportingExcel(true);
    try {
      const { type, data, meta } = getCurrentReportContext();
      exportReportToExcel(type, data, meta, shopProfile);
      toast.success(`${meta.title} exported to Excel successfully.`);
    } catch (err) {
      console.error("Excel Export error:", err);
      toast.error("Unable to generate report. Please try again.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    if (isExportingExcel || isExportingPdf || isPrinting) return;
    setIsExportingPdf(true);
    try {
      const { type, data, meta } = getCurrentReportContext();
      exportReportToPDF(type, data, meta, shopProfile);
      toast.success(`${meta.title} exported to PDF successfully.`);
    } catch (err) {
      console.error("PDF Export error:", err);
      toast.error("Unable to generate report. Please try again.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = async () => {
    if (isExportingExcel || isExportingPdf || isPrinting) return;
    setIsPrinting(true);
    try {
      const { type, data, meta } = getCurrentReportContext();
      printReportDocument(type, data, meta, shopProfile);
    } catch (err) {
      console.error("Print error:", err);
      toast.error("Unable to generate report. Please try again.");
    } finally {
      setTimeout(() => {
        setIsPrinting(false);
      }, 800);
    }
  };

  const isBusy = isExportingExcel || isExportingPdf || isPrinting;

  return (
    <div className="space-y-6">
      {/* Header & Export Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics & Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate and export comprehensive agribusiness performance, inventory valuation, and ledgers.
          </p>
        </div>

        {/* Global Clean Export Toolbar */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-muted/60 dark:bg-muted/30 border rounded-lg shadow-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={isBusy}
            className="h-9 px-3.5 bg-background hover:bg-accent hover:text-accent-foreground font-medium text-xs sm:text-sm transition-all shadow-xs"
            title="Download Excel (.xlsx)"
          >
            {isExportingExcel ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-600" />
                <span>Generating Excel...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
                <span>Download Excel</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={isBusy}
            className="h-9 px-3.5 bg-background hover:bg-accent hover:text-accent-foreground font-medium text-xs sm:text-sm transition-all shadow-xs"
            title="Download PDF document"
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-rose-600" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4 text-rose-600" />
                <span>Download PDF</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={isBusy}
            className="h-9 px-3.5 bg-background hover:bg-accent hover:text-accent-foreground font-medium text-xs sm:text-sm transition-all shadow-xs"
            title="Print A4 Report"
          >
            {isPrinting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" />
                <span>Preparing Print...</span>
              </>
            ) : (
              <>
                <Printer className="mr-2 h-4 w-4 text-blue-600" />
                <span>Print</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Report Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full sm:w-auto h-auto p-1 bg-muted/80">
          <TabsTrigger value="sales" className="py-2 text-xs sm:text-sm">
            Sales Report
          </TabsTrigger>
          <TabsTrigger value="inventory" className="py-2 text-xs sm:text-sm">
            Inventory Report
          </TabsTrigger>
          <TabsTrigger value="financial" className="py-2 text-xs sm:text-sm">
            Financial Report
          </TabsTrigger>
          <TabsTrigger value="customer" className="py-2 text-xs sm:text-sm">
            Customer Report
          </TabsTrigger>
          <TabsTrigger value="supplier" className="py-2 text-xs sm:text-sm">
            Supplier Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4 focus-visible:outline-none">
          <SalesReport
            data={initialSales}
            onFilterChange={(filteredData, meta) => {
              setSalesData(filteredData);
              setSalesMeta(meta);
            }}
          />
        </TabsContent>

        <TabsContent value="inventory" className="mt-4 focus-visible:outline-none">
          <InventoryReport
            data={initialInventory}
            onFilterChange={(filteredData, meta) => {
              setInventoryData(filteredData);
              setInventoryMeta(meta);
            }}
          />
        </TabsContent>

        <TabsContent value="financial" className="mt-4 focus-visible:outline-none">
          <FinancialReport
            data={initialFinancial}
            onFilterChange={(filteredData, meta) => {
              setFinancialData(filteredData);
              setFinancialMeta(meta);
            }}
          />
        </TabsContent>

        <TabsContent value="customer" className="mt-4 focus-visible:outline-none">
          <CustomerReportTab
            customers={initialCustomer?.customers || []}
            onFilterChange={(filteredData, meta) => {
              setCustomerData(filteredData);
              setCustomerMeta(meta);
            }}
          />
        </TabsContent>

        <TabsContent value="supplier" className="mt-4 focus-visible:outline-none">
          <SupplierReportTab
            suppliers={initialSupplier?.suppliers || []}
            onFilterChange={(filteredData, meta) => {
              setSupplierData(filteredData);
              setSupplierMeta(meta);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
