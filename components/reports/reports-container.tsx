"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ShopDetails } from "@/lib/shop-details";
import { exportReportToPDF, printReportDocument, ReportFilterMeta } from "@/lib/report-export";
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

  const handleExportPDF = async () => {
    if (isExportingPdf || isPrinting) return;
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
    if (isExportingPdf || isPrinting) return;
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

  const isBusy = isExportingPdf || isPrinting;

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full">
      {/* Header & Export Toolbar */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Analytics & Reports</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            Generate and export comprehensive agribusiness performance, inventory valuation, and ledgers.
          </p>
        </div>

        {/* Global Clean Export Toolbar (PDF & Print only) */}
        <div className="grid grid-cols-2 sm:flex items-center gap-2 p-1.5 bg-muted/60 dark:bg-muted/30 border rounded-lg shadow-xs w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={isBusy}
            className="h-9 px-3 bg-background hover:bg-accent hover:text-accent-foreground font-medium text-xs sm:text-sm transition-all shadow-xs justify-center w-full sm:w-auto"
            title="Download PDF document"
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-rose-600" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <FileText className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-600" />
                <span>Download PDF</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={isBusy}
            className="h-9 px-3 bg-background hover:bg-accent hover:text-accent-foreground font-medium text-xs sm:text-sm transition-all shadow-xs justify-center w-full sm:w-auto"
            title="Print A4 Report"
          >
            {isPrinting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-blue-600" />
                <span>Printing...</span>
              </>
            ) : (
              <>
                <Printer className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                <span>Print</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Report Tabs with Smooth Horizontal Scroll on Mobile */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="w-full overflow-x-auto pb-1 no-scrollbar -mx-0.5 px-0.5">
          <TabsList className="inline-flex w-max min-w-full sm:w-full sm:grid sm:grid-cols-5 h-auto p-1 bg-muted/80 gap-1 sm:gap-0">
            <TabsTrigger value="sales" className="py-2 px-3 text-xs sm:text-sm whitespace-nowrap">
              Sales Report
            </TabsTrigger>
            <TabsTrigger value="inventory" className="py-2 px-3 text-xs sm:text-sm whitespace-nowrap">
              Inventory Report
            </TabsTrigger>
            <TabsTrigger value="financial" className="py-2 px-3 text-xs sm:text-sm whitespace-nowrap">
              Financial Report
            </TabsTrigger>
            <TabsTrigger value="customer" className="py-2 px-3 text-xs sm:text-sm whitespace-nowrap">
              Customer Report
            </TabsTrigger>
            <TabsTrigger value="supplier" className="py-2 px-3 text-xs sm:text-sm whitespace-nowrap">
              Supplier Report
            </TabsTrigger>
          </TabsList>
        </div>

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
            shopProfile={shopProfile}
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
