"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CustomerFormDialog } from '@/components/customers/customer-form-dialog';
import { ArrowLeft, Edit, CreditCard } from 'lucide-react';

export function CustomerDetailHeader({ customer }: { customer: any }) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/customers"
            className="h-9 w-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{customer?.name || "Customer Details"}</h1>
            <p className="text-sm text-muted-foreground">
              {customer?.village ? `${customer.village} • ` : ""}{customer?.mobile || customer?.phone || "No phone"}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setShowEdit(true)}>
            <Edit className="h-4 w-4 mr-1.5" /> Edit
          </Button>
          <Link href={`/billing`}>
            <Button className="bg-primary hover:bg-primary/90">
              <CreditCard className="h-4 w-4 mr-1.5" /> New Bill
            </Button>
          </Link>
        </div>
      </div>

      {showEdit && (
        <CustomerFormDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          customer={customer}
          onSuccess={() => {
            setShowEdit(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
