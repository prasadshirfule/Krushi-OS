"use client";

import { CustomerForm } from '@/components/customers/customer-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, UserPlus } from 'lucide-react';

export default function NewCustomerPage() {
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/customers"
          className="h-9 w-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-primary" /> Add New Customer / Farmer
          </h1>
          <p className="text-sm text-muted-foreground">
            Register farmer details, village, farm size, and contact information
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <CustomerForm
          onSuccess={() => {
            router.push('/customers');
          }}
          onCancel={() => {
            router.push('/customers');
          }}
        />
      </div>
    </div>
  );
}
