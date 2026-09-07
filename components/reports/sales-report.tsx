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
        const pStatus = (sale.payment_status || "paid").toLowerCase();
        if (pStatus !== paymentFilter.toLowerCase()) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const invMatch = (sale.invoice_number || "").toLowerCase().includes(q);
        const custMatch = (sale.customer?.name || "").toLowerCase().includes(q);
        const mobileMatch = (sale.customer?.mobile || "").toLowerCase().includes(q);
        const villageMatch = (sale.customer?.village || "").toLowerCase().includes(q);
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
          <div className="font-medium">{row.original.customer?.name || "Walk-in Customer"}</div>
          {row.original.customer?.mobile && (
            <div className="text-xs text-muted-foreground">{row.original.customer.mobile}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "items",
      header: "Items",
      cell: ({ row }: any) => {
        const count = (row.original.sale_items || []).length;
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
      accessorKey: "payment_status",
      header: "Payment",
      cell: ({ row }: any) => {
        const status = (row.original.payment_status || "PAID").toUpperCase();
        return (
          <Badge variant={status === "PAID" ? "default" : status === "CREDIT" ? "destructive" : "secondary"}>
            {status}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
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

        <div className="w-[130px]">
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="credit">Credit / Due</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Input
            placeholder="Search invoice / customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[200px] sm:w-[240px] text-xs h-9"
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
              className="text-xs h-9"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Bill Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.avgBillValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-500">
              {formatCurrency(stats.totalProfit)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Sales & Profit Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.chartData.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-md">
              No sales records available for the selected period.
            </div>
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(Number(value)), ""]}
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue (₹)" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Profit (₹)" fill="#0d9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales Transactions Data Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Sales Transactions Details</CardTitle>
            <span className="text-xs text-muted-foreground">{filteredSales.length} records matching filters</span>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSales.length === 0 ? (
            <div className="p-8 border border-dashed rounded-md text-center text-muted-foreground">
              No sales records found for the selected filter.
            </div>
          ) : (
            <DataTable columns={columns} data={filteredSales} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
