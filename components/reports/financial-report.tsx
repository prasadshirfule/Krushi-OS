"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportFilterMeta, formatDateValue } from "@/lib/report-export";

interface FinancialReportProps {
  data?: {
    revenue: number;
    totalExpenses: number;
    grossProfit: number;
    netProfit: number;
    salesCount: number;
    sales?: any[];
    expenses?: any[];
  };
  onFilterChange?: (filteredData: any, meta: Partial<ReportFilterMeta>) => void;
}

export function FinancialReport({ data, onFilterChange }: FinancialReportProps) {
  const [periodPreset, setPeriodPreset] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const rawSales = useMemo(() => data?.sales || [], [data?.sales]);
  const rawExpenses = useMemo(() => data?.expenses || [], [data?.expenses]);

  // Handle preset filters
  const applyPreset = (preset: string) => {
    setPeriodPreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    if (preset === "all") {
      setDateFrom("");
      setDateTo("");
    } else if (preset === "today") {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split("T")[0];
      setDateFrom(yStr);
      setDateTo(yStr);
    } else if (preset === "7days") {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      setDateFrom(d.toISOString().split("T")[0]);
      setDateTo(todayStr);
    } else if (preset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      setDateFrom(firstDay);
      setDateTo(todayStr);
    }
  };

  // Filter Sales
  const filteredSales = useMemo(() => {
    if (!dateFrom && !dateTo) return rawSales;
    return rawSales.filter((s: any) => {
      const d = s.sale_date ? s.sale_date.split("T")[0] : "";
      if (dateFrom && d && d < dateFrom) return false;
      if (dateTo && d && d > dateTo) return false;
      return true;
    });
  }, [rawSales, dateFrom, dateTo]);

  // Filter Expenses
  const filteredExpenses = useMemo(() => {
    if (!dateFrom && !dateTo) return rawExpenses;
    return rawExpenses.filter((e: any) => {
      const d = e.date ? e.date.split("T")[0] : "";
      if (dateFrom && d && d < dateFrom) return false;
      if (dateTo && d && d > dateTo) return false;
      return true;
    });
  }, [rawExpenses, dateFrom, dateTo]);

  // Recalculate using exact application business logic
  const fin = useMemo(() => {
    // If no filter active and initial metrics provided, use them; otherwise recompute
    const revenue = filteredSales.length > 0 || (rawSales.length > 0 && (dateFrom || dateTo))
      ? filteredSales.reduce((acc: number, s: any) => acc + Number(s.total_amount || 0), 0)
      : Number(data?.revenue || 0);

    const grossProfit = filteredSales.length > 0 || (rawSales.length > 0 && (dateFrom || dateTo))
      ? filteredSales.reduce((acc: number, s: any) => acc + Number(s.profit_amount || 0), 0)
      : Number(data?.grossProfit || 0);

    const totalExpenses = filteredExpenses.length > 0 || (rawExpenses.length > 0 && (dateFrom || dateTo))
      ? filteredExpenses.reduce((acc: number, e: any) => acc + Number(e.amount || 0), 0)
      : Number(data?.totalExpenses || 0);

    const netProfit = grossProfit - totalExpenses;
    const salesCount = filteredSales.length > 0 || (rawSales.length > 0 && (dateFrom || dateTo))
      ? filteredSales.length
      : Number(data?.salesCount || 0);

    return {
      revenue,
      totalExpenses,
      grossProfit,
      netProfit,
      salesCount,
      sales: filteredSales,
      expenses: filteredExpenses,
    };
  }, [filteredSales, filteredExpenses, rawSales, rawExpenses, dateFrom, dateTo, data]);

  // Sync with parent export engine
  useEffect(() => {
    if (onFilterChange) {
      let rangeLabel = "All Time";
      if (dateFrom && dateTo) {
        rangeLabel = `${dateFrom} to ${dateTo}`;
      } else if (dateFrom) {
        rangeLabel = `From ${dateFrom}`;
      } else if (dateTo) {
        rangeLabel = `Up to ${dateTo}`;
      }

      onFilterChange(fin, {
        dateRange: rangeLabel,
        periodLabel: periodPreset !== "all" ? periodPreset.toUpperCase() : "All Records",
      });
    }
  }, [fin, onFilterChange, dateFrom, dateTo, periodPreset]);

  // Expense Columns
  const expenseColumns = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }: any) => formatDateValue(row.original.date),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }: any) => row.original.category?.name || "General",
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }: any) => row.original.description || "-",
    },
    {
      accessorKey: "payment_method",
      header: "Payment Method",
      cell: ({ row }: any) => (row.original.payment_method || "CASH").toUpperCase(),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }: any) => (
        <span className="font-bold text-red-600">
          {formatCurrency(Number(row.original.amount || 0))}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 border rounded-lg bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={periodPreset === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset("all")}
          >
            All Time
          </Button>
          <Button
            variant={periodPreset === "today" ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset("today")}
          >
            Today
          </Button>
          <Button
            variant={periodPreset === "yesterday" ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset("yesterday")}
          >
            Yesterday
          </Button>
          <Button
            variant={periodPreset === "7days" ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset("7days")}
          >
            Last 7 Days
          </Button>
          <Button
            variant={periodPreset === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset("month")}
          >
            This Month
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPeriodPreset("custom");
            }}
            className="w-[140px] text-xs"
            placeholder="From Date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPeriodPreset("custom");
            }}
            className="w-[140px] text-xs"
            placeholder="To Date"
          />
        </div>

        {(dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => applyPreset("all")}
            className="text-xs h-9 ml-auto"
          >
            Reset
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-500">
              {formatCurrency(fin.grossProfit)}
            </div>
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
            <div
              className={`text-2xl font-bold ${
                fin.netProfit >= 0 ? "text-blue-600" : "text-red-600"
              }`}
            >
              {formatCurrency(fin.netProfit)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Financial Breakdown Statement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between py-2.5 border-b">
              <span className="text-muted-foreground">Total Completed Sales Invoices:</span>
              <span className="font-semibold">{fin.salesCount}</span>
            </div>
            <div className="flex justify-between py-2.5 border-b">
              <span className="text-muted-foreground">Gross Sales Revenue:</span>
              <span className="font-semibold text-green-600">{formatCurrency(fin.revenue)}</span>
            </div>
            <div className="flex justify-between py-2.5 border-b">
              <span className="text-muted-foreground">Cost of Goods / Deductions:</span>
              <span className="font-semibold">{formatCurrency(fin.revenue - fin.grossProfit)}</span>
            </div>
            <div className="flex justify-between py-2.5 border-b">
              <span className="text-muted-foreground">Gross Profit Margin:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-500">
                {fin.revenue > 0 ? ((fin.grossProfit / fin.revenue) * 100).toFixed(2) + "%" : "0.00%"}
              </span>
            </div>
            <div className="flex justify-between py-2.5 border-b">
              <span className="text-muted-foreground">Total Operating Expenses:</span>
              <span className="font-semibold text-red-600">{formatCurrency(fin.totalExpenses)}</span>
            </div>
            <div className="flex justify-between py-2.5 border-b">
              <span className="text-muted-foreground">Net Profit Margin:</span>
              <span className="font-semibold text-blue-600">
                {fin.revenue > 0 ? ((fin.netProfit / fin.revenue) * 100).toFixed(2) + "%" : "0.00%"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      {filteredExpenses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Itemized Operating Expenses</CardTitle>
              <span className="text-xs text-muted-foreground">{filteredExpenses.length} expense records</span>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable columns={expenseColumns} data={filteredExpenses} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
