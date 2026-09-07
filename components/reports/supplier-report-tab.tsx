"use client";

import React, { useState, useMemo, useEffect } from "react";
import { DataTable } from "@/components/ui/data-table";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ReportFilterMeta } from "@/lib/report-export";

interface SupplierReportTabProps {
  suppliers?: any[];
  onFilterChange?: (filteredData: any, meta: Partial<ReportFilterMeta>) => void;
}

export function SupplierReportTab({ suppliers = [], onFilterChange }: SupplierReportTabProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s: any) => {
      // Status filter
      if (statusFilter === "payable" && Number(s.outstanding || 0) <= 0) return false;
      if (statusFilter === "settled" && Number(s.outstanding || 0) > 0) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (s.name || "").toLowerCase().includes(q);
        const compMatch = (s.company || "").toLowerCase().includes(q);
        const mobMatch = (s.mobile || "").toLowerCase().includes(q);
        const gstMatch = (s.gst_number || "").toLowerCase().includes(q);
        if (!nameMatch && !compMatch && !mobMatch && !gstMatch) return false;
      }

      return true;
    });
  }, [suppliers, searchQuery, statusFilter]);

  // Recalculate summary metrics
  const summary = useMemo(() => {
    const totalPurchases = filteredSuppliers.reduce((acc: number, s: any) => acc + Number(s.total_purchases || 0), 0);
    const totalPaid = filteredSuppliers.reduce((acc: number, s: any) => acc + Number(s.total_paid || 0), 0);
    const totalOutstanding = filteredSuppliers.reduce((acc: number, s: any) => acc + Number(s.outstanding || 0), 0);
    const payableCount = filteredSuppliers.filter((s: any) => Number(s.outstanding || 0) > 0).length;

    return {
      suppliers: filteredSuppliers,
      totalPurchases,
      totalPaid,
      totalOutstanding,
      payableCount,
    };
  }, [filteredSuppliers]);

  // Sync with parent export toolbar
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(summary, {
        statusFilter: statusFilter === "payable" ? "Pending Payables Only" : statusFilter === "settled" ? "Settled Accounts Only" : "All Suppliers",
        searchQuery: searchQuery.trim() || undefined,
      });
    }
  }, [summary, statusFilter, searchQuery, onFilterChange]);

  const supplierColumns = [
    { accessorKey: "name", header: "Supplier Name" },
    { accessorKey: "company", header: "Company", cell: ({ row }: any) => row.original.company || "-" },
    { accessorKey: "mobile", header: "Mobile", cell: ({ row }: any) => row.original.mobile || "-" },
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
      header: "Outstanding Payable",
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
            {out > 0 ? "Pending" : "Settled"}
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
            <CardTitle className="text-sm font-medium">Total Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSuppliers.length}</div>
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
            <CardTitle className="text-sm font-medium">Outstanding Payable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalOutstanding)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payable Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{summary.payableCount}</div>
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
              <SelectItem value="all">All Suppliers</SelectItem>
              <SelectItem value="payable">Pending Payable Only</SelectItem>
              <SelectItem value="settled">Settled Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-72">
          <Input
            placeholder="Search supplier, company, mobile, GSTIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      {filteredSuppliers.length === 0 ? (
        <div className="p-8 border border-dashed rounded-md text-center text-muted-foreground">
          No supplier records found matching the filter.
        </div>
      ) : (
        <DataTable columns={supplierColumns} data={filteredSuppliers} />
      )}
    </div>
  );
}
