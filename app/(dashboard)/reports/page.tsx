"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportFilters } from "@/components/reports/report-filters";
import { SalesReport } from "@/components/reports/sales-report";
import { InventoryReport } from "@/components/reports/inventory-report";
import { FinancialReport } from "@/components/reports/financial-report";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("sales");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="customer">Customer</TabsTrigger>
          <TabsTrigger value="supplier">Supplier</TabsTrigger>
        </TabsList>
        
        <ReportFilters />
        
        <TabsContent value="sales">
          <SalesReport />
        </TabsContent>
        <TabsContent value="inventory">
          <InventoryReport />
        </TabsContent>
        <TabsContent value="financial">
          <FinancialReport />
        </TabsContent>
        <TabsContent value="customer">
          <div className="p-4 border rounded-md">Customer Report Data</div>
        </TabsContent>
        <TabsContent value="supplier">
          <div className="p-4 border rounded-md">Supplier Report Data</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
