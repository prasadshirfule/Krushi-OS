"use client";

import { useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { Users, Edit, Trash2, BookOpen } from 'lucide-react';
import { CustomerFormDialog } from './customer-form-dialog';
import { maskAadhaar } from './customer-form';
import { deleteCustomerAction } from '@/actions/customers';
import { toast } from 'sonner';

import { useEffect } from 'react';
import { 
  isClientDemoMode, 
  getDemoCustomersClient, 
  deleteDemoCustomerClient 
} from '@/lib/client-demo-store';

export function CustomerTable({ initialData = [] }: { initialData?: any[] }) {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>(initialData);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Sync with client-side demo store in demo mode
  useEffect(() => {
    if (isClientDemoMode()) {
      setCustomers(getDemoCustomersClient());

      const handleUpdate = () => {
        setCustomers(getDemoCustomersClient());
      };

      window.addEventListener('krushi-customers-updated', handleUpdate);
      return () => window.removeEventListener('krushi-customers-updated', handleUpdate);
    } else {
      setCustomers(initialData);
    }
  }, [initialData]);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete customer "${name}"?`)) {
      return;
    }
    setIsDeleting(id);
    try {
      if (isClientDemoMode()) {
        deleteDemoCustomerClient(id);
        setCustomers(getDemoCustomersClient());
        try {
          deleteCustomerAction(id).catch(() => {});
        } catch {}
        toast.success(`Customer "${name}" deleted successfully`);
      } else {
        const res = await deleteCustomerAction(id);
        if (res.success) {
          toast.success(`Customer "${name}" deleted successfully`);
          router.refresh();
        } else {
          toast.error(res.error || "Failed to delete customer");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete customer");
    } finally {
      setIsDeleting(null);
    }
  };

  const columns = [
    { 
      accessorKey: 'name', 
      header: 'Name', 
      cell: ({ row }: any) => (
        <Link href={`/customers/${row.original.id}`} className="font-semibold text-primary hover:underline">
          {row.original.name}
        </Link>
      ) 
    },
    { 
      accessorKey: 'mobile', 
      header: 'Mobile', 
      cell: ({ row }: any) => row.original.mobile || row.original.phone || 'N/A' 
    },
    { 
      accessorKey: 'aadhaar', 
      header: 'Aadhaar', 
      cell: ({ row }: any) => {
        const aadhaar = row.original.aadhaar;
        return aadhaar ? maskAadhaar(aadhaar) : '-';
      }
    },
    { 
      accessorKey: 'village', 
      header: 'Village', 
      cell: ({ row }: any) => row.original.village || '-' 
    },
    { 
      accessorKey: 'total_purchases', 
      header: 'Total Purchases',
      cell: ({ row }: any) => formatCurrency(Number(row.original.total_purchases || row.original.totalPurchases || 0))
    },
    { 
      accessorKey: 'outstanding', 
      header: 'Outstanding Balance', 
      cell: ({ row }: any) => {
        const amt = Number(row.original.outstanding ?? row.original.outstanding_balance ?? 0);
        return (
          <span className={amt > 0 ? 'text-destructive font-bold' : 'text-primary font-medium'}>
            {formatCurrency(amt)}
          </span>
        );
      } 
    },
    { 
      accessorKey: 'is_active', 
      header: 'Status',
      cell: ({ row }: any) => (
        <Badge variant={row.original.is_active !== false ? "default" : "secondary"}>
          {row.original.is_active !== false ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    { 
      id: 'actions', 
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex items-center space-x-1.5">
          <Link href={`/customers/${row.original.id}`}>
            <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs">
              <BookOpen className="h-3.5 w-3.5 mr-1 text-muted-foreground" /> Ledger
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs hover:text-primary hover:bg-primary/10"
            onClick={() => setEditingCustomer(row.original)}
            title="Edit Customer"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs hover:text-destructive hover:bg-destructive/10"
            disabled={isDeleting === row.original.id}
            onClick={() => handleDelete(row.original.id, row.original.name)}
            title="Delete Customer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) 
    }
  ];

  return (
    <>
      {customers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10 text-muted-foreground/50" />}
          title="No customers registered yet"
          description="Register your farmer customers to track their purchases, credit (udhar), and payment history."
          actionLabel="+ Add Customer"
          actionHref="/customers/new"
        />
      ) : (
        <DataTable columns={columns} data={customers} searchKey="name" searchPlaceholder="Search customers by name or phone..." />
      )}

      {editingCustomer && (
        <CustomerFormDialog
          open={!!editingCustomer}
          onOpenChange={(open) => !open && setEditingCustomer(null)}
          customer={editingCustomer}
          onSuccess={() => {
            setEditingCustomer(null);
            if (isClientDemoMode()) {
              setCustomers(getDemoCustomersClient());
            }
            router.refresh();
          }}
        />
      )}
    </>
  );
}
