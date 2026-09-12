"use client";

import React, { useState, useMemo } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency, formatDate } from '@/lib/utils';
import { exportToCSV, exportToExcel } from '@/lib/export';
import { Download, ChevronDown, FileSpreadsheet, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentTableProps {
  initialPayments?: any[];
}

export function PaymentTable({ initialPayments = [] }: PaymentTableProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter payments based on search term
  const filteredPayments = useMemo(() => {
    if (!searchTerm.trim()) return initialPayments;
    const q = searchTerm.toLowerCase().trim();
    return initialPayments.filter((p: any) => {
      const party = (p.customer?.name || p.supplier?.name || p.reference_type || '').toLowerCase();
      const method = (p.payment_method || '').toLowerCase();
      const type = (p.payment_type || '').toLowerCase();
      const ref = (p.id || '').toLowerCase();
      return party.includes(q) || method.includes(q) || type.includes(q) || ref.includes(q);
    });
  }, [initialPayments, searchTerm]);

  // Table columns - Notes column strictly removed
  const columns = [
    { 
      accessorKey: 'payment_date', 
      header: 'Date & Time',
      cell: ({ row }: any) => formatDate(row.original.payment_date || row.original.created_at)
    },
    { 
      accessorKey: 'payment_type', 
      header: 'Type', 
      cell: ({ row }: any) => {
        const type = row.original.payment_type;
        const isIncoming = type === 'SALE' || type === 'CUSTOMER_PAYMENT';
        return (
          <Badge variant={isIncoming ? 'default' : 'secondary'} className={isIncoming ? 'bg-green-600' : 'bg-amber-600'}>
            {isIncoming ? 'Incoming' : 'Outgoing'} ({type})
          </Badge>
        );
      } 
    },
    { 
      accessorKey: 'party', 
      header: 'Party / Account',
      cell: ({ row }: any) => {
        const partyName = row.original.customer?.name || row.original.supplier?.name || row.original.reference_type || 'General Account';
        return <span className="font-medium text-foreground">{partyName}</span>;
      }
    },
    { 
      accessorKey: 'payment_method', 
      header: 'Payment Method',
      cell: ({ row }: any) => (
        <Badge variant="outline" className="font-mono text-xs">
          {row.original.payment_method || 'CASH'}
        </Badge>
      )
    },
    { 
      accessorKey: 'amount', 
      header: 'Amount (₹)',
      cell: ({ row }: any) => (
        <span className="font-bold text-base text-foreground font-mono">
          {formatCurrency(Number(row.original.amount || 0))}
        </span>
      )
    },
    {
      accessorKey: 'id',
      header: 'Reference ID',
      cell: ({ row }: any) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.id ? row.original.id.substring(0, 8).toUpperCase() : 'N/A'}
        </span>
      )
    }
  ];

  // Prepare data for export - STRICTLY EXCLUDES NOTES
  const prepareExportData = () => {
    return filteredPayments.map((p: any) => {
      const type = p.payment_type || 'PAYMENT';
      const isIncoming = type === 'SALE' || type === 'CUSTOMER_PAYMENT';
      const partyName = p.customer?.name || p.supplier?.name || p.reference_type || 'General Account';
      const dateVal = p.payment_date || p.created_at;

      return {
        date: dateVal ? new Date(dateVal).toLocaleString('en-IN') : 'N/A',
        payment_id: p.id || 'N/A',
        type: `${isIncoming ? 'Incoming' : 'Outgoing'} (${type})`,
        party: partyName,
        payment_method: p.payment_method || 'CASH',
        amount: Number(p.amount || 0).toFixed(2),
        status: 'Completed',
      };
    });
  };

  const exportColumns = [
    { key: 'date', header: 'Date & Time' },
    { key: 'payment_id', header: 'Payment ID / Ref' },
    { key: 'type', header: 'Type' },
    { key: 'party', header: 'Party / Account' },
    { key: 'payment_method', header: 'Payment Method' },
    { key: 'amount', header: 'Amount (INR)' },
    { key: 'status', header: 'Status' },
  ];

  const handleExportCSV = async () => {
    if (filteredPayments.length === 0) {
      toast.error('No payment records to export');
      return;
    }
    setIsExporting(true);
    try {
      const data = prepareExportData();
      const filename = `payments-log-${new Date().toISOString().split('T')[0]}`;
      exportToCSV(data, filename, exportColumns);
      toast.success('Payment log exported to CSV');
    } catch (err: any) {
      console.error('Export CSV error:', err);
      toast.error(err.message || 'Failed to export payments to CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (filteredPayments.length === 0) {
      toast.error('No payment records to export');
      return;
    }
    setIsExporting(true);
    try {
      const data = prepareExportData();
      const filename = `payments-log-${new Date().toISOString().split('T')[0]}`;
      await exportToExcel(data, filename, exportColumns);
      toast.success('Payment log exported to Excel (.xlsx)');
    } catch (err: any) {
      console.error('Export Excel error:', err);
      toast.error(err.message || 'Failed to export payments to Excel');
    } finally {
      setIsExporting(false);
    }
  };

  if (initialPayments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground bg-card">
        <h3 className="text-lg font-semibold mb-1">No Payment Records Found</h3>
        <p className="text-sm max-w-sm mx-auto">
          Incoming sales payments and outgoing vendor disbursements will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 min-w-0 max-w-full">
      {/* Search & Export Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search party, method, or ref..."
            className="pl-9 h-9 text-sm w-full"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-border hover:bg-muted font-semibold h-9 gap-1.5 text-xs sm:text-sm"
                disabled={isExporting || filteredPayments.length === 0}
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                <span>Export ({filteredPayments.length})</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-1 shadow-lg">
              <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer gap-2 py-2 text-xs sm:text-sm">
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                <span>Export Excel (.xlsx)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer gap-2 py-2 text-xs sm:text-sm">
                <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                <span>Export CSV (.csv)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Responsive Table Container */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <DataTable 
          columns={columns} 
          data={filteredPayments} 
        />
      </div>
    </div>
  );
}
