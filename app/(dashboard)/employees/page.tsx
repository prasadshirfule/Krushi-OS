import { getEmployeesAction } from "@/actions/employees";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Employees | KRUSHI OS',
};

export default async function EmployeesPage() {
  const res = await getEmployeesAction({});
  const employees = res.success && res.data?.employees ? res.data.employees : [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff & Roles</h1>
          <p className="text-sm text-muted-foreground">Manage shop staff members, cashiers, and role-based permissions</p>
        </div>
        <EmployeeFormDialog />
      </div>

      <DataTable
        columns={[
          { 
            accessorKey: "name", 
            header: "Full Name",
            cell: ({ row }: any) => (
              <div>
                <div className="font-semibold">{row.original.name || `${row.original.first_name || ''} ${row.original.last_name || ''}`}</div>
                <div className="text-xs text-muted-foreground">{row.original.email || 'No email registered'}</div>
              </div>
            )
          },
          { 
            accessorKey: "role", 
            header: "Assigned Role",
            cell: ({ row }: any) => <Badge variant="outline" className="font-semibold text-primary">{row.original.role || row.original.roles?.name || 'Staff'}</Badge>
          },
          { accessorKey: "phone", header: "Contact Number" },
          { 
            accessorKey: "status", 
            header: "Status",
            cell: ({ row }: any) => (
              <Badge className={row.original.status === 'ACTIVE' ? 'bg-green-600' : 'bg-gray-400'}>
                {row.original.status || 'ACTIVE'}
              </Badge>
            )
          },
          { accessorKey: "joined_at", header: "Joined Date" },
        ]}
        data={employees}
        searchKey="name"
        searchPlaceholder="Search staff members..."
      />
    </div>
  );
}
