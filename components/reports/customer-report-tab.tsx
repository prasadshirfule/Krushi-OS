"use client";

import React, { useState, useMemo, useEffect } from "react";
import { DataTable } from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ReportFilterMeta } from "@/lib/report-export";

interface CustomerReportTabProps {
  customers?: any[];
  onFilterChange?: (filteredData: any, meta: Partial<ReportFilterMeta>) => void;
}

export function CustomerReportTab({ customers = [], onFilterChange }: CustomerReportTabProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredCustomers = useMemo(() => {
    return customers.filter((c: any) => {
      // Status filter
      if (statusFilter === "due" && Number(c.outstanding || 0) <= 0) return false;
      if (statusFilter === "clear" && Number(c.outstanding || 0) > 0) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (c.name || "").toLowerCase().includes(q);
        const mobMatch = (c.mobile || "").toLowerCase().includes(q);
        const villMatch = (c.village || "").toLowerCase().includes(q);
        const addrMatch = (c.address || "").toLowerCase().includes(q);
        if (!nameMatch && !mobMatch && !villMatch && !addrMatch) return false;
      }

      return true;
    });
  }, [customers, searchQuery, statusFilter]);

  // Recalculate summary metrics
  const summary = useMemo(() => {
    const totalPurchases = filteredCustomers.reduce((acc: number, c: any) => acc + Number(c.total_purchases || 0), 0);
    const totalPaid = filteredCustomers.reduce((acc: number, c: any) => acc + Number(c.total_paid || 0), 0);
    const totalOutstanding = filteredCustomers.reduce((acc: number, c: any) => acc + Number(c.outstanding || 0), 0);
    const dueCount = filteredCustomers.filter((c: any) => Number(c.outstanding || 0) > 0).length;

    return {
      customers: filteredCustomers,
      totalPurchases,
      totalPaid,
      totalOutstanding,
      dueCount,
    };
  }, [filteredCustomers]);

  // Sync with parent export toolbar
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(summary, {
        statusFilter: statusFilter === "due" ? "Outstanding Dues Only" : statusFilter === "clear" ? "Cleared Accounts Only" : "All Customers",
        searchQuery: searchQuery.trim() || undefined,
      });
    }
  }, [summary, statusFilter, searchQuery, onFilterChange]);

  const customerColumns = [
    { accessorKey: "name", header: "Customer Name" },
    { accessorKey: "mobile", header: "Mobile", cell: ({ row }: any) => row.original.mobile || "-" },
    { accessorKey: "village", header: "Village", cell: ({ row }: any) => row.original.village || "-" },
    {
      accessorKey: "total_purchases",
      header: "Total Purchases",
      cell: ({ row }: any) => (
        <span className="font-semibold text-foreground">
          {formatCurrency(Number(row.original.total_purchases || 0))}
        </span>
      ),
    },
    {
      accessorKey: "outstanding",
      header: "Outstanding",
      cell: ({ row }: any) => {
        const out = Number(row.original.outstanding || 0);
        return (
          <span className={out > 0 ? "text-red-600 font-bold" : "text-muted-foreground"}>
            {formatCurrency(out)}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: any) => {
        const out = Number(row.original.outstanding || 0);
        return (
          <Badge variant={out > 0 ? "destructive" : "secondary"}>
            {out > 0 ? "Due" : "Clear"}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredCustomers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalPurchases)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalOutstanding)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{summary.dueCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg bg-card shadow-xs">
        <div className="w-full sm:w-[180px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              <SelectItem value="due">Outstanding Due Only</SelectItem>
              <SelectItem value="clear">Cleared Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-72">
          <Input
            placeholder="Search by customer, mobile, village..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      {filteredCustomers.length === 0 ? (
        <div className="p-8 border border-dashed rounded-md text-center text-muted-foreground">
          No customer records found matching the filter.
        </div>
      ) : (
        <DataTable columns={customerColumns} data={filteredCustomers} />
      )}
    </div>
  );
}
