'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProductSearch from '@/components/billing/product-search';
import BillingCart from '@/components/billing/billing-cart';
import PaymentPanel from '@/components/billing/payment-panel';
import BillSuccessDialog from '@/components/billing/bill-success-dialog';
import { CustomerFormDialog } from '@/components/customers/customer-form-dialog';
import { BillingCartItem } from '@/types/sales';
import { generateId } from '@/lib/utils';
import { calculateBillTotal } from '@/lib/calculations';
import { MOCK_CUSTOMERS } from '@/lib/mock-data';
import { User, X, UserPlus, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* Quick-select customers for the billing page */
const QUICK_CUSTOMERS = [
  ...MOCK_CUSTOMERS.map(c => ({ id: c.id, name: c.name, phone: c.phone })),
  { id: 'walk-in', name: 'Walk-in', phone: '' },
];

export default function BillingPage() {
  /* ─── State ─── */
  const [cart, setCart] = useState<BillingCartItem[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);

  /* ─── Derived ─── */
  const totals = calculateBillTotal(cart);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const filteredQuickCustomers = customerSearch.trim()
    ? QUICK_CUSTOMERS.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))
    : QUICK_CUSTOMERS;

  /* ─── Handlers ─── */
  const selectCustomer = (id: string, name: string) => {
    setCustomerId(id);
    setCustomerName(name);
    setCustomerSearch('');
  };

  const clearCustomer = () => {
    setCustomerId('');
    setCustomerName('');
    setCustomerSearch('');
  };

  const handleClearCart = useCallback(() => {
    if (cart.length > 0 && window.confirm('Clear all items from the bill?')) {
      setCart([]);
    }
  }, [cart]);

  const handleSaleComplete = (saleId: string) => {
    setLastSaleId(saleId);
    setShowSuccessDialog(true);
    setCart([]);
    setCustomerId('');
    setCustomerName('');
  };

  const handleAddToCart = (item: any) => {
    setCart(prev => [...prev, { ...item, id: generateId() }]);
  };

  /* ─── Keyboard shortcuts ─── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        handleClearCart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClearCart]);

  /* ─── Render ─── */
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">

      {/* ════════ PAGE HEADER ════════ */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl md:text-3xl font-bold text-green-700 flex items-center gap-2">
          🧾 New Bill
        </h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{dateStr} • {timeStr}</span>
          <span className="flex items-center gap-1 text-green-600">
            <Wifi className="h-4 w-4" /> Online
          </span>
        </div>
      </div>

      {/* ════════ SECTION 1: CUSTOMER ════════ */}
      <section className="rounded-2xl border-2 border-green-100 bg-white p-5 md:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
              <User className="h-5 w-5 text-green-700" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Customer Name</h2>
          </div>
          {!customerName && (
            <Button
              variant="outline"
              size="sm"
              className="text-green-700 border-green-200 hover:bg-green-50"
              onClick={() => setShowNewCustomerDialog(true)}
            >
              <UserPlus className="h-4 w-4 mr-1" /> New Customer
            </Button>
          )}
        </div>

        {/* Selected customer — prominent display */}
        {customerName ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-green-50 border-2 border-green-200 rounded-xl px-5 py-3">
              <p className="text-2xl md:text-3xl font-bold text-green-800 tracking-tight">{customerName}</p>
              {customerId !== 'walk-in' && (
                <p className="text-sm text-green-600 mt-0.5">
                  {QUICK_CUSTOMERS.find(c => c.id === customerId)?.phone || 'Customer'}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-muted-foreground hover:text-destructive hover:bg-red-50"
              onClick={clearCustomer}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        ) : (
          <>
            {/* Customer search input */}
            <Input
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              placeholder="Type customer name..."
              className="text-lg py-5 mb-4"
            />

            {/* Quick-select buttons */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground self-center mr-1 font-medium">Recent:</span>
              {filteredQuickCustomers.map(c => (
                <Button
                  key={c.id}
                  variant="outline"
                  size="sm"
                  className="rounded-full px-4 py-2 h-auto text-sm font-medium hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                  onClick={() => selectCustomer(c.id, c.name)}
                >
                  {c.name}
                </Button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ════════ SECTION 2: PRODUCT SELECTION ════════ */}
      <ProductSearch onAddToCart={handleAddToCart} />

      {/* ════════ SECTION 3: CURRENT BILL ════════ */}
      <BillingCart
        items={cart}
        onChange={setCart}
        onClear={handleClearCart}
        totals={totals}
      />

      {/* ════════ SECTION 4: PAYMENT & COMPLETE ════════ */}
      <PaymentPanel
        cart={cart}
        totals={totals}
        customerId={customerId}
        onComplete={handleSaleComplete}
      />

      {/* ════════ KEYBOARD SHORTCUTS — subtle footer ════════ */}
      <div className="flex gap-3 justify-center pt-2">
        <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-md border">F2 New/Clear</span>
        <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-md border">F4 Search</span>
        <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-md border">F8 Complete</span>
      </div>

      {/* ════════ DIALOGS ════════ */}
      {showSuccessDialog && lastSaleId && (
        <BillSuccessDialog
          saleId={lastSaleId}
          totals={totals}
          onClose={() => setShowSuccessDialog(false)}
        />
      )}

      <CustomerFormDialog
        open={showNewCustomerDialog}
        onOpenChange={setShowNewCustomerDialog}
      />
    </div>
  );
}
