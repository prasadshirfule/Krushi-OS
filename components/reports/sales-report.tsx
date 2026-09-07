"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { ReportFilterMeta, formatDateValue } from "@/lib/report-export";

interface SalesReportProps {
  data?: {
    sales: any[];
    totalRevenue: number;
    totalTax: number;
    totalProfit: number;
    avgBillValue: number;
    totalCount: number;
    chartData: any[];
  };
  onFilterChange?: (filteredData: any, meta: Partial<ReportFilterMeta>) => void;
}

export function SalesReport({ data, onFilterChange }: SalesReportProps) {
  const rawSales = useMemo(() => data?.sales || [], [data?.sales]);

  // Filters
  const [periodPreset, setPeriodPreset] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Handle Preset Changes
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
    } else if (preset === "30days") {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      setDateFrom(d.toISOString().split("T")[0]);
      setDateTo(todayStr);
    } else if (preset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      setDateFrom(firstDay);
      setDateTo(todayStr);
    }
  };

  // Filter Logic (preserves all calculations and isolation)
  const filteredSales = useMemo(() => {
    return rawSales.filter((sale: any) => {
      // Date filter
      const saleDate = sale.sale_date ? sale.sale_date.split("T")[0] : "";
      if (dateFrom && saleDate && saleDate < dateFrom) return false;
      if (dateTo && saleDate && saleDate > dateTo) return false;

      // Payment filter
      if (paymentFilter !== "all") {
        const pMode = (sale.payment_mode || sale.payment_method || sale.payment_status || "N/A").toString().toLowerCase().replace(/[-_]/g, ' ').trim();
        const target = paymentFilter.toLowerCase().replace(/[-_]/g, ' ').trim();
        if (target === 'cash' && pMode !== 'cash') return false;
        if (target === 'upi' && pMode !== 'upi') return false;
        if (target === 'bank transfer' && pMode !== 'bank transfer') return false;
        if (target === 'card' && pMode !== 'card') return false;
        if ((target === 'credit' || target === 'due') && pMode !== 'credit' && pMode !== 'unpaid') return false;
        if (target === 'partial' && pMode !== 'partial' && pMode !== 'partial payment') return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const invMatch = (sale.invoice_number || "").toLowerCase().includes(q);
        const custMatch = (sale.customer?.name || sale.customer_name || "").toLowerCase().includes(q);
        const mobileMatch = (sale.customer?.mobile || sale.customer_phone || "").toLowerCase().includes(q);
        const villageMatch = (sale.customer?.village || sale.customer_village || "").toLowerCase().includes(q);
        if (!invMatch && !custMatch && !mobileMatch && !villageMatch) return false;
      }

      return true;
    });
  }, [rawSales, dateFrom, dateTo, paymentFilter, searchQuery]);

  // Recalculate metrics strictly matching filtered sales
  const stats = useMemo(() => {
    const totalCount = filteredSales.length;
    const totalRevenue = filteredSales.reduce((acc: number, s: any) => acc + Number(s.total_amount || 0), 0);
    const totalTax = filteredSales.reduce((acc: number, s: any) => acc + Number(s.tax_amount || 0), 0);
    const totalProfit = filteredSales.reduce((acc: number, s: any) => acc + Number(s.profit_amount || 0), 0);
    const avgBillValue = totalCount > 0 ? totalRevenue / totalCount : 0;

    // Group for chart
    const dateMap = new Map<string, { date: string; revenue: number; profit: number }>();
    for (const sale of filteredSales) {
      const dateStr = sale.sale_date ? sale.sale_date.split("T")[0] : "N/A";
      const current = dateMap.get(dateStr) || { date: dateStr, revenue: 0, profit: 0 };
      current.revenue += Number(sale.total_amount || 0);
      current.profit += Number(sale.profit_amount || 0);
      dateMap.set(dateStr, current);
    }

    const chartData = Array.from(dateMap.values()).reverse();

    return {
      sales: filteredSales,
      totalRevenue,
      totalTax,
      totalProfit,
      avgBillValue,
      totalCount,
      chartData,
    };
  }, [filteredSales]);

  // Notify parent container of filtered state changes for export
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

      onFilterChange(stats, {
        dateRange: rangeLabel,
        periodLabel: periodPreset !== "all" ? periodPreset.toUpperCase() : "All Records",
        statusFilter: paymentFilter !== "all" ? paymentFilter.toUpperCase() : undefined,
        searchQuery: searchQuery.trim() || undefined,
      });
    }
  }, [stats, onFilterChange, dateFrom, dateTo, periodPreset, paymentFilter, searchQuery]);

  // Helper for Payment Badge Styling
  const formatPaymentBadge = (mode: string) => {
    const upper = (mode || "N/A").toUpperCase().replace(/[-_]/g, ' ').trim();
    if (upper === 'CASH') return { label: 'CASH', variant: 'default' as const, className: 'bg-emerald-600 hover:bg-emerald-700 text-white font-semibold' };
    if (upper === 'UPI') return { label: 'UPI', variant: 'default' as const, className: 'bg-blue-600 hover:bg-blue-700 text-white font-semibold' };
    if (upper === 'BANK TRANSFER' || upper === 'BANK') return { label: 'BANK TRANSFER', variant: 'secondary' as const, className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-semibold' };
    if (upper === 'CARD') return { label: 'CARD', variant: 'secondary' as const, className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800 font-semibold' };
    if (upper === 'CREDIT' || upper === 'UDHAAR' || upper === 'DUE') return { label: 'CREDIT', variant: 'destructive' as const, className: 'bg-rose-600 hover:bg-rose-700 text-white font-semibold' };
    if (upper === 'PARTIAL' || upper === 'PARTIAL PAYMENT') return { label: 'PARTIAL', variant: 'secondary' as const, className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-semibold' };
    return { label: upper || 'N/A', variant: 'secondary' as const, className: 'font-semibold' };
  };

  // Table Columns
  const columns = [
    {
      accessorKey: "invoice_number",
      header: "Invoice No",
      cell: ({ row }: any) => (
        <span className="font-semibold text-foreground">{row.original.invoice_number || row.original.id}</span>
      ),
    },
    {
      accessorKey: "sale_date",
      header: "Date",
      cell: ({ row }: any) => formatDateValue(row.original.sale_date),
    },
    {
      accessorKey: "customer",
      header: "Customer",
      cell: ({ row }: any) => (
        <div>
          <div className="font-medium">{row.original.customer?.name || row.original.customer_name || "Walk-in Customer"}</div>
          {(row.original.customer?.mobile || row.original.customer_phone) && (
            <div className="text-xs text-muted-foreground">{row.original.customer?.mobile || row.original.customer_phone}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "items",
      header: "Items",
      cell: ({ row }: any) => {
        const count = (row.original.sale_items || row.original.items || []).length;
        return <Badge variant="secondary">{count} item{count !== 1 ? "s" : ""}</Badge>;
      },
    },
    {
      accessorKey: "tax_amount",
      header: "GST (₹)",
      cell: ({ row }: any) => formatCurrency(Number(row.original.tax_amount || 0)),
    },
    {
      accessorKey: "profit_amount",
      header: "Profit (₹)",
      cell: ({ row }: any) => (
        <span className="text-emerald-700 dark:text-emerald-500 font-medium">
          {formatCurrency(Number(row.original.profit_amount || 0))}
        </span>
      ),
    },
    {
      accessorKey: "total_amount",
      header: "Total Amount",
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
        const pMode = row.original.payment_mode || row.original.payment_method || (row.original.payment_status === 'credit' ? 'CREDIT' : row.original.payment_status === 'partial' ? 'PARTIAL' : 'N/A');
        const badge = formatPaymentBadge(pMode);
        return (
          <Badge variant={badge.variant} className={badge.className}>
            {badge.label}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full">
      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 p-3 sm:p-4 border rounded-lg bg-card shadow-xs">
        {/* Preset Period Pills (Horizontally scrollable on small screens) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-0.5 px-0.5">
          <Button
            variant={periodPreset === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset("all")}
            className="h-8 text-xs shrink-0"
          >
            All Time
          </Button>
          <Button
            variant={periodPreset === "today" ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset("today")}
            className="h-8 text-xs shrink-0"
          >
            Today
          </Button>
          <Button
            variant={periodPreset === "yesterday" ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset("yesterday")}
            className="h-8 text-xs shrink-0"
          >
            Yesterday
          </Button>
          <Button
            variant={periodPreset === "7days" ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset("7days")}
            className="h-8 text-xs shrink-0"
          >
            Last 7 Days
          </Button>
          <Button
            variant={periodPreset === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset("month")}
            className="h-8 text-xs shrink-0"
          >
            This Month
          </Button>
        </div>

        {/* Date Filters, Payment Method Dropdown, Search Input */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPeriodPreset("custom");
              }}
              className="w-full sm:w-[135px] text-xs h-9"
              placeholder="From Date"
            />
            <span className="text-xs text-muted-foreground shrink-0">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPeriodPreset("custom");
              }}
              className="w-full sm:w-[135px] text-xs h-9"
              placeholder="To Date"
            />
          </div>

          <div className="w-full sm:w-[160px]">
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="text-xs h-9 w-full">
                <SelectValue placeholder="All Payments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="credit">Credit / Due</SelectItem>
                <SelectItem value="partial">Partial Payment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Input
              placeholder="Search invoice / customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs h-9"
            />
            {(dateFrom || dateTo || paymentFilter !== "all" || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  applyPreset("all");
                  setPaymentFilter("all");
                  setSearchQuery("");
                }}
                className="text-xs h-9 px-2.5 shrink-0"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid (Responsive 2 columns on mobile, 4 on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-lg sm:text-2xl font-bold text-foreground">{stats.totalCount}</div>
          </CardContent>
        </Card>
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-500">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Average Bill</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-lg sm:text-2xl font-bold text-foreground">{formatCurrency(stats.avgBillValue)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Profit</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-lg sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatCurrency(stats.totalProfit)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="shadow-xs">
        <CardHeader className="p-3 sm:p-4 pb-2">
          <CardTitle className="text-sm sm:text-base font-semibold">Sales & Profit Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-4">
          {stats.chartData.length === 0 ? (
            <div className="h-[200px] sm:h-[260px] flex items-center justify-center text-muted-foreground text-xs sm:text-sm border border-dashed rounded-md">
              No sales records available for the selected period.
            </div>
          ) : (
            <div className="h-[200px] sm:h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} margin={{ top: 15, right: 15, left: 0, bottom: 5 }}>
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(Number(value)), ""]}
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "12px"
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="revenue" name="Revenue (₹)" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Profit (₹)" fill="#0d9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales Transactions Data Table */}
      <Card className="shadow-xs overflow-hidden">
        <CardHeader className="p-3 sm:p-4 pb-2 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <CardTitle className="text-sm sm:text-base font-semibold">Sales Transactions Details</CardTitle>
            <span className="text-xs text-muted-foreground">{filteredSales.length} records matching filters</span>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-4">
          {filteredSales.length === 0 ? (
            <div className="p-8 border-dashed text-center text-muted-foreground text-xs sm:text-sm">
              No sales records found for the selected filter.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <DataTable columns={columns} data={filteredSales} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
