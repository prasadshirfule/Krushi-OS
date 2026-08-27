"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface FinancialReportProps {
  data?: {
    revenue: number;
    totalExpenses: number;
    grossProfit: number;
    netProfit: number;
    salesCount: number;
  };
}

export function FinancialReport({ data }: FinancialReportProps) {
  const fin = data || {
    revenue: 0,
    totalExpenses: 0,
    grossProfit: 0,
    netProfit: 0,
    salesCount: 0
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(fin.revenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{formatCurrency(fin.grossProfit)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operating Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(fin.totalExpenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Operating Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(fin.netProfit)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border p-6 bg-card space-y-4">
        <h3 className="text-lg font-semibold">Financial Breakdown</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Total Completed Sales Invoices:</span>
            <span className="font-semibold">{fin.salesCount}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Gross Sales Revenue:</span>
            <span className="font-semibold">{formatCurrency(fin.revenue)}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Gross Profit Margin:</span>
            <span className="font-semibold">{formatCurrency(fin.grossProfit)}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Net Earnings After Expenses:</span>
            <span className="font-semibold text-blue-600">{formatCurrency(fin.netProfit)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
