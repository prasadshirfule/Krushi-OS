'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomerLedger } from '@/components/customers/customer-ledger';
import { CustomerDetailHeader } from '@/components/customers/customer-detail-header';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CreditCard, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { 
  isClientDemoMode, 
  getDemoCustomerByIdClient 
} from '@/lib/client-demo-store';
import { maskAadhaar } from '@/components/customers/customer-form';
import { PaymentDialog } from '@/components/customers/payment-dialog';
import { AddUdhariDialog } from '@/components/customers/add-udhari-dialog';

interface CustomerDetailClientProps {
  initialCustomer: any | null;
  customerId: string;
}

export function CustomerDetailClient({ initialCustomer, customerId }: CustomerDetailClientProps) {
  const [customer, setCustomer] = useState<any | null>(initialCustomer);
  const [showPayment, setShowPayment] = useState(false);
  const [showUdhari, setShowUdhari] = useState(false);

  const loadCustomer = () => {
    if (!initialCustomer && isClientDemoMode()) {
      const found = getDemoCustomerByIdClient(customerId);
      if (found) setCustomer(found);
    } else {
      setCustomer(initialCustomer);
    }
  };

  useEffect(() => {
    loadCustomer();
  }, [initialCustomer, customerId]);

  // Listen for customer/ledger updates in demo mode
  useEffect(() => {
    if (isClientDemoMode()) {
      const handleUpdate = () => {
        const found = getDemoCustomerByIdClient(customerId);
        if (found) setCustomer(found);
      };
      window.addEventListener('krushi-customers-updated', handleUpdate);
      window.addEventListener('krushi-ledger-updated', handleUpdate);
      window.addEventListener('krushi-sales-updated', handleUpdate);
      return () => {
        window.removeEventListener('krushi-customers-updated', handleUpdate);
        window.removeEventListener('krushi-ledger-updated', handleUpdate);
        window.removeEventListener('krushi-sales-updated', handleUpdate);
      };
    }
  }, [customerId]);

  if (!customer) {
    return (
      <div className="p-8 text-center text-muted-foreground font-medium space-y-4">
        <p>Customer not found</p>
        <Link href="/customers">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Customers
          </Button>
        </Link>
      </div>
    );
  }

  const totalPurchases = Number(customer.total_purchases || customer.totalPurchases || 0);
  const outstanding = Number(customer.outstanding || customer.outstanding_balance || 0);
  const totalPaid = Math.max(0, totalPurchases - outstanding);

  return (
    <div className="space-y-6 p-6">
      <CustomerDetailHeader customer={customer} />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="col-span-1 rounded-xl border border-border bg-card text-card-foreground shadow p-6">
          <h3 className="font-semibold text-lg mb-4 text-foreground">Farmer Profile</h3>
          <div className="space-y-2.5 text-sm text-card-foreground">
            <p><span className="text-muted-foreground font-medium">Name:</span> {customer.name}</p>
            <p><span className="text-muted-foreground font-medium">Mobile:</span> {customer.mobile || customer.phone || 'N/A'}</p>
            {customer.aadhaar && <p><span className="text-muted-foreground font-medium">Aadhaar:</span> {maskAadhaar(customer.aadhaar)}</p>}
            <p><span className="text-muted-foreground font-medium">Village:</span> {customer.village || 'N/A'}</p>
            {customer.address && <p><span className="text-muted-foreground font-medium">Address:</span> {customer.address}</p>}
            <p><span className="text-muted-foreground font-medium">Farm Size:</span> {customer.farm_size || customer.farmSize || 'N/A'}</p>
            <p><span className="text-muted-foreground font-medium">Crops:</span> {customer.crops || 'N/A'}</p>
            {customer.notes && <p><span className="text-muted-foreground font-medium">Notes:</span> {customer.notes}</p>}
          </div>
        </div>
        <div className="col-span-3 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card text-card-foreground shadow p-6">
            <h3 className="text-sm font-medium text-muted-foreground">Total Purchases</h3>
            <div className="text-2xl font-bold mt-2 text-foreground">{formatCurrency(totalPurchases)}</div>
          </div>
          <div className="rounded-xl border border-border bg-card text-card-foreground shadow p-6">
            <h3 className="text-sm font-medium text-muted-foreground">Estimated Paid</h3>
            <div className="text-2xl font-bold mt-2 text-green-600">{formatCurrency(totalPaid)}</div>
          </div>
          <div className="rounded-xl border border-border bg-card text-card-foreground shadow p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Outstanding (Udhar)</h3>
              <div className={`text-3xl font-bold mt-2 ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(outstanding)}
              </div>
            </div>
            
            {/* Action Buttons for Udhari */}
            <div className="mt-4 flex gap-2">
              <Button 
                size="sm" 
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium"
                onClick={() => setShowPayment(true)}
              >
                <CreditCard className="w-4 h-4 mr-1.5" /> 
                Receive Payment
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 font-medium"
                onClick={() => setShowUdhari(true)}
              >
                <PlusCircle className="w-4 h-4 mr-1.5" /> 
                Add Udhari
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="ledger" className="w-full">
        <TabsList>
          <TabsTrigger value="ledger">Credit Ledger</TabsTrigger>
          <TabsTrigger value="purchases">Purchase History</TabsTrigger>
        </TabsList>
        <TabsContent value="ledger" className="mt-4">
          <CustomerLedger customerId={customerId} />
        </TabsContent>
        <TabsContent value="purchases" className="mt-4">
          <div className="p-6 border border-border rounded-xl text-center text-muted-foreground bg-card">
            Purchase history records for {customer.name} are tracked with sales invoices.
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <PaymentDialog
        open={showPayment}
        onOpenChange={setShowPayment}
        customerId={customerId}
        customerName={customer.name}
        outstanding={outstanding}
        onSuccess={() => loadCustomer()}
      />

      <AddUdhariDialog
        open={showUdhari}
        onOpenChange={setShowUdhari}
        customerId={customerId}
        customerName={customer.name}
        outstanding={outstanding}
        onSuccess={() => loadCustomer()}
      />
    </div>
  );
}
