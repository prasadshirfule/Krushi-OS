import { getEmployeesAction } from "@/actions/employees";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { EmployeeTable } from "@/components/employees/employee-table";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Employees & Staff | KRUSHI OS',
};

export default async function EmployeesPage() {
  const res = await getEmployeesAction({});
  const employees = res.success && res.data?.employees ? res.data.employees : [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff & Roles</h1>
          <p className="text-sm text-muted-foreground">Manage shop staff members, cashiers, and role-based permissions</p>
        </div>
        <EmployeeFormDialog />
      </div>

      <EmployeeTable initialEmployees={employees} />
    </div>
  );
}
