'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomerLedger } from '@/components/customers/customer-ledger';
import { CustomerDetailHeader } from '@/components/customers/customer-detail-header';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CreditCard, PlusCircle, ShoppingBag, Eye } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { 
  isClientDemoMode, 
  getDemoCustomerByIdClient,
  getDemoSalesClient,
} from '@/lib/client-demo-store';
import { maskAadhaar } from '@/components/customers/customer-form';
import { PaymentDialog } from '@/components/customers/payment-dialog';
import { AddUdhariDialog } from '@/components/customers/add-udhari-dialog';
import { getSalesAction } from '@/actions/sales';

interface CustomerDetailClientProps {
  initialCustomer: any | null;
  customerId: string;
}

export function CustomerDetailClient({ initialCustomer, customerId }: CustomerDetailClientProps) {
  const [customer, setCustomer] = useState<any | null>(initialCustomer);
  const [showPayment, setShowPayment] = useState(false);
  const [showUdhari, setShowUdhari] = useState(false);
  const [customerSales, setCustomerSales] = useState<any[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);

  const loadCustomer = () => {
    if (!initialCustomer && isClientDemoMode()) {
      const found = getDemoCustomerByIdClient(customerId);
      if (found) setCustomer(found);
    } else {
      setCustomer(initialCustomer);
    }
  };

  const loadCustomerSales = async () => {
    try {
      if (isClientDemoMode()) {
        const allSales = getDemoSalesClient();
        const filtered = allSales.filter(
          (s: any) => s.customer_id === customerId && s.status !== 'CANCELLED'
        );
        setCustomerSales(filtered);
      } else {
        const res = await getSalesAction({ customerId, limit: 200 });
        if (res.success && res.data?.sales) {
          setCustomerSales(res.data.sales.filter((s: any) => s.status !== 'CANCELLED'));
        }
      }
    } catch (err) {
      console.error('Error loading customer sales:', err);
    } finally {
      setSalesLoading(false);
    }
  };

  useEffect(() => {
    loadCustomer();
  }, [initialCustomer, customerId]);

  useEffect(() => {
    loadCustomerSales();
  }, [customerId]);

  // Listen for customer/ledger/sales updates in demo mode
  useEffect(() => {
    if (isClientDemoMode()) {
      const handleCustomerUpdate = () => {
        const found = getDemoCustomerByIdClient(customerId);
        if (found) setCustomer(found);
      };
      const handleSalesUpdate = () => {
        handleCustomerUpdate();
        // Reload sales from the same demo store used by billing
        const allSales = getDemoSalesClient();
        const filtered = allSales.filter(
          (s: any) => s.customer_id === customerId && s.status !== 'CANCELLED'
        );
        setCustomerSales(filtered);
      };
      window.addEventListener('krushi-customers-updated', handleCustomerUpdate);
      window.addEventListener('krushi-ledger-updated', handleCustomerUpdate);
      window.addEventListener('krushi-sales-updated', handleSalesUpdate);
      return () => {
        window.removeEventListener('krushi-customers-updated', handleCustomerUpdate);
        window.removeEventListener('krushi-ledger-updated', handleCustomerUpdate);
        window.removeEventListener('krushi-sales-updated', handleSalesUpdate);
      };
    }
  }, [customerId]);

  // Calculate Total Purchases from actual customer sales
  const totalPurchases = useMemo(() => {
    if (customerSales.length > 0) {
      return customerSales.reduce((sum: number, s: any) => {
        return sum + Number(s.grand_total ?? s.total_amount ?? s.totalAmount ?? s.payableAmount ?? 0);
      }, 0);
    }
    // Fallback to stored value while sales are loading
    return Number(customer?.total_purchases ?? customer?.totalPurchases ?? 0);
  }, [customerSales, customer]);

  const outstanding = Number(customer?.outstanding ?? customer?.outstanding_balance ?? 0);

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

  return (
    <div className="space-y-6 p-6">
      <CustomerDetailHeader customer={customer} />

      {/* Stats Cards — 3 cards: Profile, Total Purchases, Outstanding */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Farmer Profile */}
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow p-6">
          <h3 className="font-semibold text-lg mb-4 text-foreground">Farmer Profile</h3>
          <div className="space-y-2.5 text-sm text-card-foreground">
            <p><span className="text-muted-foreground font-medium">Name:</span> {customer.name}</p>
            <p><span className="text-muted-foreground font-medium">Mobile:</span> {customer.mobile || customer.phone || 'N/A'}</p>
            {customer.aadhaar && <p><span className="text-muted-foreground font-medium">Aadhaar:</span> {maskAadhaar(customer.aadhaar)}</p>}
            {(customer.village) && <p><span className="text-muted-foreground font-medium">Village / Area:</span> {customer.village}</p>}
            {customer.address && <p><span className="text-muted-foreground font-medium">Address:</span> {customer.address}</p>}
            {customer.notes && <p><span className="text-muted-foreground font-medium">Notes:</span> {customer.notes}</p>}
          </div>
        </div>

        {/* Total Purchases */}
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow p-6 flex flex-col justify-center">
          <h3 className="text-sm font-medium text-muted-foreground">Total Purchases</h3>
          <div className="text-2xl font-bold mt-2 text-foreground">{formatCurrency(totalPurchases)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {customerSales.length} {customerSales.length === 1 ? 'invoice' : 'invoices'}
          </p>
        </div>

        {/* Outstanding (Udhari) */}
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow p-6 flex flex-col justify-center">
          <h3 className="text-sm font-medium text-muted-foreground">Outstanding (Udhari)</h3>
          <div className={`text-3xl font-bold mt-2 ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(outstanding)}
          </div>
        </div>
      </div>

      {/* Tabs + Action Buttons Row */}
      <Tabs defaultValue="ledger" className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="ledger">Credit Ledger</TabsTrigger>
            <TabsTrigger value="purchases">Purchase History</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              className="bg-green-600 hover:bg-green-700 text-white font-medium"
              onClick={() => setShowPayment(true)}
            >
              <CreditCard className="w-4 h-4 mr-1.5" /> 
              Receive Payment
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="font-medium"
              onClick={() => setShowUdhari(true)}
            >
              <PlusCircle className="w-4 h-4 mr-1.5" /> 
              Add Udhari
            </Button>
          </div>
        </div>

        <TabsContent value="ledger" className="mt-4">
          <CustomerLedger customerId={customerId} />
        </TabsContent>

        <TabsContent value="purchases" className="mt-4">
          <CustomerPurchaseHistory 
            sales={customerSales} 
            loading={salesLoading} 
            customerName={customer.name}
          />
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

/* ─────────────────────────────────────────────────────────
   Purchase History Sub-Component
   ───────────────────────────────────────────────────────── */

function CustomerPurchaseHistory({ 
  sales, 
  loading, 
  customerName 
}: { 
  sales: any[]; 
  loading: boolean; 
  customerName: string;
}) {
  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading purchase history...
      </div>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center bg-card">
        <ShoppingBag className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-foreground mb-1">No purchases yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {customerName} has no purchase history. Bills created for this customer will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice #</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Items</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Payment</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale: any) => {
              const dateVal = sale.sale_date || sale.created_at;
              let dateStr = '-';
              if (dateVal) {
                try {
                  const dt = new Date(dateVal);
                  dateStr = dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                } catch {
                  dateStr = dateVal;
                }
              }

              const invoiceNum = sale.invoice_number || sale.invoiceNumber || sale.id;
              const items = sale.items || sale.sale_items || [];
              const itemsSummary = items.length > 0
                ? items.map((it: any) => it.product_name || it.name || 'Product').join(', ')
                : '-';
              const displayItems = itemsSummary.length > 40 ? itemsSummary.substring(0, 37) + '...' : itemsSummary;
              const total = Number(sale.grand_total ?? sale.total_amount ?? sale.totalAmount ?? sale.payableAmount ?? 0);
              const paymentMethod = sale.payment_method || sale.payment_mode || 'Cash';
              const status = sale.status || 'COMPLETED';
              const paymentStatus = sale.payment_status || 'PAID';

              return (
                <tr key={sale.id} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-foreground whitespace-nowrap">{dateStr}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{invoiceNum}</td>
                  <td className="px-4 py-3 text-foreground max-w-[200px]" title={itemsSummary}>
                    {displayItems}
                    {items.length > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">({items.length})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge 
                      variant={paymentMethod.toUpperCase() === 'CREDIT' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {paymentMethod}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">
                    {formatCurrency(total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge 
                      variant={paymentStatus === 'PAID' ? 'default' : 'destructive'}
                      className={`text-xs ${paymentStatus === 'PAID' ? 'bg-green-600/15 text-green-600 border-green-600/20' : ''}`}
                    >
                      {paymentStatus === 'PAID' ? 'Paid' : 'Unpaid'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link href={`/sales/${sale.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
