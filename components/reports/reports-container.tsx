"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, Printer, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ShopDetails } from "@/lib/shop-details";
import { exportReportToPDF, printReportDocument, ReportFilterMeta } from "@/lib/report-export";
import { SalesReport } from "@/components/reports/sales-report";
import { InventoryReport } from "@/components/reports/inventory-report";
import { FinancialReport } from "@/components/reports/financial-report";
import { CustomerReportTab } from "@/components/reports/customer-report-tab";
import { SupplierReportTab } from "@/components/reports/supplier-report-tab";
import {
  getInventoryReportAction,
  getFinancialReportAction,
  getCustomerReportAction,
  getSupplierReportAction,
} from "@/actions/reports";

interface ReportsContainerProps {
  initialSales: any;
  initialInventory?: any;
  initialFinancial?: any;
  initialCustomer?: any;
  initialSupplier?: any;
  shopProfile: ShopDetails;
}

export function ReportsContainer({
  initialSales,
  initialInventory = null,
  initialFinancial = null,
  initialCustomer = null,
  initialSupplier = null,
  shopProfile,
}: ReportsContainerProps) {
  const [activeTab, setActiveTab] = useState<string>("sales");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Tab Data Cache & Loading States
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

  const [loadingTab, setLoadingTab] = useState<string | null>(null);
  const [tabError, setTabError] = useState<{ tab: string; message: string } | null>(null);

  // Track request IDs and mounted state to safely cancel/ignore stale responses
  const activeRequestIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch data on-demand for un-cached tabs
  const loadTabData = useCallback(
    async (tab: string) => {
      if (!isMountedRef.current) return;

      if (tab === "inventory" && !inventoryData) {
        setLoadingTab("inventory");
        setTabError(null);
        const reqId = ++activeRequestIdRef.current;
        try {
          const res = await getInventoryReportAction({ type: "current" });
          if (!isMountedRef.current || reqId !== activeRequestIdRef.current) return;
          if (res.success && res.data) {
            setInventoryData(res.data);
          } else {
            setTabError({ tab: "inventory", message: (res as any).error || "Failed to load inventory report" });
          }
        } catch (err: any) {
          if (!isMountedRef.current || reqId !== activeRequestIdRef.current) return;
          setTabError({ tab: "inventory", message: err?.message || "Failed to load inventory report" });
        } finally {
          if (isMountedRef.current && reqId === activeRequestIdRef.current) {
            setLoadingTab(null);
          }
        }
      } else if (tab === "financial" && !financialData) {
        setLoadingTab("financial");
        setTabError(null);
        const reqId = ++activeRequestIdRef.current;
        try {
          const res = await getFinancialReportAction({});
          if (!isMountedRef.current || reqId !== activeRequestIdRef.current) return;
          if (res.success && res.data) {
            setFinancialData(res.data);
          } else {
            setTabError({ tab: "financial", message: (res as any).error || "Failed to load financial report" });
          }
        } catch (err: any) {
          if (!isMountedRef.current || reqId !== activeRequestIdRef.current) return;
          setTabError({ tab: "financial", message: err?.message || "Failed to load financial report" });
        } finally {
          if (isMountedRef.current && reqId === activeRequestIdRef.current) {
            setLoadingTab(null);
          }
        }
      } else if (tab === "customer" && !customerData) {
        setLoadingTab("customer");
        setTabError(null);
        const reqId = ++activeRequestIdRef.current;
        try {
          const res = await getCustomerReportAction({});
          if (!isMountedRef.current || reqId !== activeRequestIdRef.current) return;
          if (res.success && res.data) {
            setCustomerData(res.data);
          } else {
            setTabError({ tab: "customer", message: (res as any).error || "Failed to load customer report" });
          }
        } catch (err: any) {
          if (!isMountedRef.current || reqId !== activeRequestIdRef.current) return;
          setTabError({ tab: "customer", message: err?.message || "Failed to load customer report" });
        } finally {
          if (isMountedRef.current && reqId === activeRequestIdRef.current) {
            setLoadingTab(null);
          }
        }
      } else if (tab === "supplier" && !supplierData) {
        setLoadingTab("supplier");
        setTabError(null);
        const reqId = ++activeRequestIdRef.current;
        try {
          const res = await getSupplierReportAction({});
          if (!isMountedRef.current || reqId !== activeRequestIdRef.current) return;
          if (res.success && res.data) {
            setSupplierData(res.data);
          } else {
            setTabError({ tab: "supplier", message: (res as any).error || "Failed to load supplier report" });
          }
        } catch (err: any) {
          if (!isMountedRef.current || reqId !== activeRequestIdRef.current) return;
          setTabError({ tab: "supplier", message: err?.message || "Failed to load supplier report" });
        } finally {
          if (isMountedRef.current && reqId === activeRequestIdRef.current) {
            setLoadingTab(null);
          }
        }
      }
    },
    [inventoryData, financialData, customerData, supplierData]
  );

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    loadTabData(val);
  };

  // Stable callbacks for child tabs to prevent cascading re-renders
  const handleSalesFilterChange = useCallback((filteredData: any, meta: Partial<ReportFilterMeta>) => {
    setSalesData(filteredData);
    setSalesMeta(meta);
  }, []);

  const handleInventoryFilterChange = useCallback((filteredData: any, meta: Partial<ReportFilterMeta>) => {
    setInventoryData(filteredData);
    setInventoryMeta(meta);
  }, []);

  const handleFinancialFilterChange = useCallback((filteredData: any, meta: Partial<ReportFilterMeta>) => {
    setFinancialData(filteredData);
    setFinancialMeta(meta);
  }, []);

  const handleCustomerFilterChange = useCallback((filteredData: any, meta: Partial<ReportFilterMeta>) => {
    setCustomerData(filteredData);
    setCustomerMeta(meta);
  }, []);

  const handleSupplierFilterChange = useCallback((filteredData: any, meta: Partial<ReportFilterMeta>) => {
    setSupplierData(filteredData);
    setSupplierMeta(meta);
  }, []);

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
      await exportReportToPDF(type, data, meta, shopProfile);
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

  const renderLoadingSkeleton = (tabTitle: string) => (
    <div className="h-64 flex flex-col items-center justify-center text-muted-foreground text-sm border rounded-lg bg-card p-6 shadow-xs">
      <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
      <span>Loading {tabTitle}...</span>
    </div>
  );

  const renderErrorState = (tabTitle: string, tabKey: string) => (
    <div className="p-6 border border-destructive/40 bg-destructive/10 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4 text-destructive text-sm shadow-xs">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span>Failed to load {tabTitle}. {tabError?.message || "Please check your network and try again."}</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setTabError(null);
          loadTabData(tabKey);
        }}
        className="h-8 text-xs border-destructive/30 hover:bg-destructive/20 shrink-0"
      >
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        Retry
      </Button>
    </div>
  );

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
            disabled={isBusy || Boolean(loadingTab)}
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
            disabled={isBusy || Boolean(loadingTab)}
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
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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
            data={salesData}
            onFilterChange={handleSalesFilterChange}
          />
        </TabsContent>

        <TabsContent value="inventory" className="mt-4 focus-visible:outline-none">
          {loadingTab === "inventory" ? (
            renderLoadingSkeleton("Inventory Report")
          ) : tabError?.tab === "inventory" ? (
            renderErrorState("Inventory Report", "inventory")
          ) : inventoryData ? (
            <InventoryReport
              data={inventoryData}
              shopProfile={shopProfile}
              onFilterChange={handleInventoryFilterChange}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="financial" className="mt-4 focus-visible:outline-none">
          {loadingTab === "financial" ? (
            renderLoadingSkeleton("Financial Report")
          ) : tabError?.tab === "financial" ? (
            renderErrorState("Financial Report", "financial")
          ) : financialData ? (
            <FinancialReport
              data={financialData}
              onFilterChange={handleFinancialFilterChange}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="customer" className="mt-4 focus-visible:outline-none">
          {loadingTab === "customer" ? (
            renderLoadingSkeleton("Customer Report")
          ) : tabError?.tab === "customer" ? (
            renderErrorState("Customer Report", "customer")
          ) : customerData ? (
            <CustomerReportTab
              customers={customerData?.customers || (Array.isArray(customerData) ? customerData : [])}
              onFilterChange={handleCustomerFilterChange}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="supplier" className="mt-4 focus-visible:outline-none">
          {loadingTab === "supplier" ? (
            renderLoadingSkeleton("Supplier Report")
          ) : tabError?.tab === "supplier" ? (
            renderErrorState("Supplier Report", "supplier")
          ) : supplierData ? (
            <SupplierReportTab
              suppliers={supplierData?.suppliers || (Array.isArray(supplierData) ? supplierData : [])}
              onFilterChange={handleSupplierFilterChange}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

