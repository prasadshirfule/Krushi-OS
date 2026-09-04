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
import { getCustomersAction } from '@/actions/customers';
import { User, X, UserPlus, Wifi, Phone, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
  village?: string;
}

const WALK_IN_CUSTOMER: CustomerOption = { id: 'walk-in', name: 'Walk-in', phone: '' };

export default function BillingPage() {
  /* ─── State ─── */
  const [cart, setCart] = useState<BillingCartItem[]>([]);
  const [customerList, setCustomerList] = useState<CustomerOption[]>([]);
  const [recentCustomerIds, setRecentCustomerIds] = useState<string[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerVillage, setCustomerVillage] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);

  /* ─── Fetch customers dynamically ─── */
  const loadCustomers = useCallback(async () => {
    try {
      const res = await getCustomersAction({ limit: 100 });
      if (res.success && res.data?.customers) {
        const mapped: CustomerOption[] = res.data.customers.map((c: any) => ({
          id: String(c.id),
          name: c.name,
          phone: c.phone || c.mobile || '',
          village: c.village || '',
        }));
        setCustomerList(mapped);

        // Initialize recent IDs if empty
        setRecentCustomerIds(prev => {
          if (prev.length > 0) return prev;
          try {
            const saved = localStorage.getItem('krushi_recent_customer_ids');
            if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
          } catch {}
          return mapped.slice(0, 3).map(c => c.id);
        });
      }
    } catch (err) {
      console.error('Failed to load customers for billing:', err);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  /* ─── Derived ─── */
  const totals = calculateBillTotal(cart);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // Filtered search results when typing
  const searchTrimmed = customerSearch.trim().toLowerCase();
  const searchResults = searchTrimmed
    ? customerList.filter(
        c =>
          c.name.toLowerCase().includes(searchTrimmed) ||
          (c.phone && c.phone.includes(searchTrimmed)) ||
          (c.village && c.village.toLowerCase().includes(searchTrimmed))
      )
    : [];

  // Resolve recent customer objects
  const recentCustomers: CustomerOption[] = [
    ...recentCustomerIds
      .map(id => customerList.find(c => c.id === id))
      .filter((c): c is CustomerOption => Boolean(c)),
    WALK_IN_CUSTOMER,
  ];

  /* ─── Handlers ─── */
  const selectCustomer = (cust: CustomerOption) => {
    setCustomerId(cust.id);
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone || '');
    setCustomerVillage(cust.village || '');
    setCustomerSearch('');

    if (cust.id !== 'walk-in') {
      setRecentCustomerIds(prev => {
        const next = [cust.id, ...prev.filter(id => id !== cust.id)].slice(0, 6);
        try {
          localStorage.setItem('krushi_recent_customer_ids', JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  };

  const handleCustomerCreated = (newCust: any) => {
    if (newCust) {
      const item: CustomerOption = {
        id: String(newCust.id),
        name: newCust.name,
        phone: newCust.phone || newCust.mobile || '',
        village: newCust.village || '',
      };
      setCustomerList(prev => [item, ...prev.filter(c => c.id !== item.id)]);
      selectCustomer(item);
    }
    loadCustomers();
    setShowNewCustomerDialog(false);
  };

  const handleCustomerSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && customerSearch.trim()) {
      e.preventDefault();
      const exact = customerList.find(c => c.name.toLowerCase() === searchTrimmed || c.phone === customerSearch.trim());
      if (exact) {
        selectCustomer(exact);
      } else if (searchResults.length > 0) {
        selectCustomer(searchResults[0]);
      } else {
        // Quick select as ad-hoc customer
        selectCustomer({
          id: `cust-${Date.now()}`,
          name: customerSearch.trim(),
          phone: '',
        });
      }
    }
  };

  const clearCustomer = () => {
    setCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerVillage('');
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
    setCustomerPhone('');
    setCustomerVillage('');
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
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <span className="text-primary">🧾</span> New Bill
        </h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{dateStr} • {timeStr}</span>
          <span className="flex items-center gap-1 text-primary font-medium">
            <Wifi className="h-4 w-4" /> Online
          </span>
        </div>
      </div>

      {/* ════════ SECTION 1: CUSTOMER (Dark Card) ════════ */}
      <section className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm text-card-foreground">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Customer / Farmer</h2>
              <p className="text-xs text-muted-foreground">Select registered farmer or walk-in customer</p>
            </div>
          </div>
          {!customerName && (
            <Button
              variant="outline"
              size="sm"
              className="text-primary border-primary/40 hover:bg-primary/10 hover:text-primary"
              onClick={() => setShowNewCustomerDialog(true)}
            >
              <UserPlus className="h-4 w-4 mr-1.5" /> New Customer
            </Button>
          )}
        </div>

        {/* Selected customer — prominent display */}
        {customerName ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-primary/10 border-2 border-primary/40 rounded-xl px-5 py-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-2xl md:text-3xl font-bold text-primary tracking-tight">{customerName}</p>
                {customerId === 'walk-in' && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    Cash Customer
                  </span>
                )}
              </div>
              {customerId !== 'walk-in' && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 font-medium flex-wrap">
                  {customerPhone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-primary/70" /> {customerPhone}
                    </span>
                  )}
                  {customerVillage && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-primary/70" /> {customerVillage}
                    </span>
                  )}
                  <span className="text-xs text-primary font-semibold">Registered Farmer</span>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={clearCustomer}
              title="Clear Customer"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        ) : (
          <>
            {/* Customer search input */}
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                onKeyDown={handleCustomerSearchKeyDown}
                placeholder="Search customer by name or phone (e.g. Ramesh, 9876...)"
                className="text-base py-5 pl-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* If searching: show live search results */}
            {customerSearch.trim() ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>Matching Customers ({searchResults.length}):</span>
                  <span>Press Enter to select first match</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {!searchResults.some(c => c.name.toLowerCase() === searchTrimmed) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full px-4 py-1.5 h-auto text-sm font-semibold border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                      onClick={() =>
                        selectCustomer({
                          id: `cust-${Date.now()}`,
                          name: customerSearch.trim(),
                          phone: '',
                        })
                      }
                    >
                      + Use &ldquo;{customerSearch.trim()}&rdquo;
                    </Button>
                  )}
                  {searchResults.map(c => (
                    <Button
                      key={c.id}
                      variant="outline"
                      size="sm"
                      className="rounded-full px-4 py-1.5 h-auto text-sm font-medium border-primary/40 bg-primary/5 hover:bg-primary/15 hover:text-primary transition-all text-foreground flex items-center gap-1.5"
                      onClick={() => selectCustomer(c)}
                    >
                      <span className="font-semibold text-primary">{c.name}</span>
                      {c.phone && <span className="text-xs text-muted-foreground font-normal">({c.phone})</span>}
                      {c.village && <span className="text-xs text-muted-foreground font-normal">• {c.village}</span>}
                    </Button>
                  ))}
                  {searchResults.length === 0 && (
                    <span className="text-sm text-muted-foreground italic py-1">
                      No registered customer matches &ldquo;{customerSearch}&rdquo;.
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* If not searching: show Recent & Quick select buttons */
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-muted-foreground mr-1 font-medium">Recent:</span>
                {recentCustomers.map(c => (
                  <Button
                    key={c.id}
                    variant="outline"
                    size="sm"
                    className="rounded-full px-4 py-1.5 h-auto text-sm font-medium border-border bg-background/50 hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all text-foreground"
                    onClick={() => selectCustomer(c)}
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            )}
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
        customerId={customerId || (customerSearch.trim() ? `cust-${Date.now()}` : '')}
        customerName={customerName || customerSearch.trim()}
        customerPhone={customerPhone}
        onComplete={handleSaleComplete}
      />

      {/* ════════ KEYBOARD SHORTCUTS — subtle footer ════════ */}
      <div className="flex gap-3 justify-center pt-2">
        <span className="text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md border border-border">F2 New/Clear</span>
        <span className="text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md border border-border">F4 Search</span>
        <span className="text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md border border-border">F8 Complete</span>
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
        onSuccess={handleCustomerCreated}
      />
    </div>
  );
}
