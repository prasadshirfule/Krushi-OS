"use client";

import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface AuditTableProps {
  initialLogs?: any[];
}

export function AuditTable({ initialLogs = [] }: AuditTableProps) {
  const columns = [
    { 
      accessorKey: "created_at", 
      header: "Timestamp", 
      cell: ({ row }: any) => (
        <span className="text-xs font-mono">
          {formatDate(row.original.created_at)}
        </span>
      )
    },
    { 
      accessorKey: "user", 
      header: "User / Operator", 
      cell: ({ row }: any) => (
        <span className="font-semibold text-foreground">
          {row.original.user?.full_name || 'System / Admin'}
        </span>
      )
    },
    { 
      accessorKey: "action", 
      header: "Action",
      cell: ({ row }: any) => (
        <Badge variant="secondary" className="font-mono text-xs">
          {row.original.action}
        </Badge>
      )
    },
    { 
      accessorKey: "entity_type", 
      header: "Module",
      cell: ({ row }: any) => (
        <span className="font-medium text-xs uppercase tracking-wider text-muted-foreground">
          {row.original.entity_type || 'SYSTEM'}
        </span>
      )
    },
    { 
      accessorKey: "details", 
      header: "Details / Payload", 
      cell: ({ row }: any) => {
        const val = row.original.new_values || row.original.old_values;
        if (!val || Object.keys(val).length === 0) return <span className="text-muted-foreground text-xs">-</span>;
        return (
          <code className="text-[11px] bg-muted px-2 py-1 rounded max-w-xs truncate block">
            {JSON.stringify(val)}
          </code>
        );
      }
    },
  ];

  if (initialLogs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground bg-card">
        <h3 className="text-lg font-semibold mb-1">No Audit Logs Recorded Yet</h3>
        <p className="text-sm max-w-sm mx-auto">
          System activities, billing sales, user actions, and inventory adjustments will be logged here with immutable timestamps.
        </p>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={initialLogs}
      searchKey="action"
      searchPlaceholder="Search audit trail by action..."
    />
  );
}
