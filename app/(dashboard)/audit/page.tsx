import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { MOCK_AUDIT_LOGS } from "@/lib/mock-data";

export const metadata = {
  title: 'Audit Logs | KRUSHI OS',
};

export default async function AuditPage() {
  const auditLogs = MOCK_AUDIT_LOGS;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Trail</h1>
          <p className="text-sm text-muted-foreground">Tamper-evident logs of inventory adjustments, billing sales, and customer repayments</p>
        </div>
      </div>

      <DataTable
        columns={[
          { accessorKey: "created_at", header: "Timestamp", cell: ({ row }: any) => new Date(row.original.created_at).toLocaleString('en-IN') },
          { accessorKey: "user_name", header: "User", cell: ({ row }: any) => <span className="font-semibold">{row.original.user_name}</span> },
          { 
            accessorKey: "action", 
            header: "Action",
            cell: ({ row }: any) => <Badge variant="secondary">{row.original.action}</Badge>
          },
          { accessorKey: "module", header: "Module" },
          { accessorKey: "details", header: "Details Logged" },
        ]}
        data={auditLogs}
        searchKey="details"
        searchPlaceholder="Search audit logs..."
      />
    </div>
  );
}
