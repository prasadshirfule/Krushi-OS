"use client";

import { useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { toggleEmployeeStatusAction } from "@/actions/employees";
import { useRouter } from "next/navigation";
import { Edit2, ShieldAlert, ShieldCheck, UserX, UserCheck } from "lucide-react";

interface EmployeeTableProps {
  initialEmployees?: any[];
}

export function EmployeeTable({ initialEmployees = [] }: EmployeeTableProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const router = useRouter();

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    setLoadingId(id);
    try {
      const res = await toggleEmployeeStatusAction(id);
      if (res.success) {
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to toggle employee status:", err);
    } finally {
      setLoadingId(null);
    }
  };

  const columns = [
    { 
      accessorKey: "name", 
      header: "Staff Member",
      cell: ({ row }: any) => {
        const emp = row.original;
        const name = emp.full_name || emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Staff Member';
        return (
          <div>
            <div className="font-semibold text-foreground">{name}</div>
            <div className="text-xs text-muted-foreground">{emp.email || 'No email registered'}</div>
          </div>
        );
      }
    },
    { 
      accessorKey: "role", 
      header: "Assigned Role",
      cell: ({ row }: any) => {
        const role = row.original.role?.name || row.original.roles?.name || row.original.role || 'Staff';
        return (
          <Badge variant="outline" className="font-semibold text-primary">
            {role}
          </Badge>
        );
      }
    },
    { 
      accessorKey: "phone", 
      header: "Contact",
      cell: ({ row }: any) => row.original.phone || 'N/A'
    },
    { 
      accessorKey: "status", 
      header: "Status",
      cell: ({ row }: any) => {
        const isActive = row.original.is_active !== false;
        return (
          <Badge className={isActive ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-muted text-muted-foreground'}>
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        );
      }
    },
    { 
      accessorKey: "created_at", 
      header: "Joined Date",
      cell: ({ row }: any) => formatDate(row.original.created_at || row.original.joined_at)
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: any) => {
        const emp = row.original;
        const isActive = emp.is_active !== false;
        const isToggling = loadingId === emp.id;

        return (
          <div className="flex items-center space-x-2">
            <EmployeeFormDialog 
              employee={emp} 
              trigger={
                <Button variant="outline" size="sm">
                  <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
              } 
            />
            <Button
              variant={isActive ? "ghost" : "outline"}
              size="sm"
              disabled={isToggling}
              onClick={() => handleToggleStatus(emp.id, isActive)}
              className={isActive ? "text-amber-600 hover:text-amber-700" : "text-green-600 hover:text-green-700"}
              title={isActive ? "Deactivate employee" : "Activate employee"}
            >
              {isActive ? <UserX className="h-3.5 w-3.5 mr-1" /> : <UserCheck className="h-3.5 w-3.5 mr-1" />}
              {isActive ? "Deactivate" : "Activate"}
            </Button>
          </div>
        );
      }
    }
  ];

  if (initialEmployees.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground bg-card">
        <h3 className="text-lg font-semibold mb-1">No Staff Members Found</h3>
        <p className="text-sm max-w-sm mx-auto mb-4">
          Add cashiers, inventory managers, or billing staff to collaborate in your shop.
        </p>
        <EmployeeFormDialog />
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={initialEmployees}
      searchKey="name"
      searchPlaceholder="Search staff by name or email..."
    />
  );
}
