'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ProductSearch from '@/components/billing/product-search';
import BillingCart from '@/components/billing/billing-cart';
import BillAdjustments from '@/components/billing/bill-adjustments';
import PaymentPanel from '@/components/billing/payment-panel';
import BillSuccessDialog from '@/components/billing/bill-success-dialog';
import { CustomerFormDialog } from '@/components/customers/customer-form-dialog';
import { BillingCartItem, BillAdjustment } from '@/types/sales';
import { generateId } from '@/lib/utils';
import { calculateBillTotal } from '@/lib/calculations';
import { getCustomersAction } from '@/actions/customers';
import { getShopProfileAction } from '@/actions/settings';
import { isShopProfileComplete, ShopDetails } from '@/lib/shop-details';
import { User, X, UserPlus, Wifi, Phone, MapPin, Search, AlertCircle, Store, ArrowRight, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';

import { 
  isClientDemoMode, 
  getDemoCustomersClient 
} from '@/lib/client-demo-store';

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
  const [adjustments, setAdjustments] = useState<BillAdjustment[]>([]);
  const [customerList, setCustomerList] = useState<CustomerOption[]>([]);
  const [recentCustomerIds, setRecentCustomerIds] = useState<string[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerVillage, setCustomerVillage] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState<string | null>(null);
  const [lastSaleTotals, setLastSaleTotals] = useState<any>(null);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [shopProfile, setShopProfile] = useState<ShopDetails | null>(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);

  /* ─── Fetch customers dynamically ─── */
  const loadCustomers = useCallback(async () => {
    try {
      if (isClientDemoMode()) {
        const demoCusts = getDemoCustomersClient();
        const mapped: CustomerOption[] = demoCusts.map((c: any) => ({
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
        return;
      }

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

    // Check shop profile completeness
    getShopProfileAction().then(res => {
      if (res.success && res.data) {
        setShopProfile(res.data);
      }
      setIsProfileLoaded(true);
    }).catch(() => {
      setIsProfileLoaded(true);
    });

    if (isClientDemoMode()) {
      const handleCustomersUpdated = () => {
        loadCustomers();
      };
      window.addEventListener('krushi-customers-updated', handleCustomersUpdated);
      return () => window.removeEventListener('krushi-customers-updated', handleCustomersUpdated);
    }
  }, [loadCustomers]);

  /* ─── Derived ─── */
  const totals = useMemo(() => calculateBillTotal(cart, adjustments), [cart, adjustments]);
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
    const isWalkIn = cust.id === 'walk-in' || cust.name.toLowerCase() === 'walk-in' || cust.name.toLowerCase() === 'walk-in customer';
    const cleanName = isWalkIn ? 'WALK-IN CUSTOMER' : (cust.name || '').trim().toUpperCase();

    setCustomerId(cust.id);
    setCustomerName(cleanName);
    setCustomerPhone(cust.phone || '');
    setCustomerVillage((cust.village || '').trim().toUpperCase());
    setCustomerSearch('');

    if (!isWalkIn) {
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
        name: (newCust.name || '').toUpperCase(),
        phone: newCust.phone || newCust.mobile || '',
        village: (newCust.village || '').toUpperCase(),
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
          name: customerSearch.trim().toUpperCase(),
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
    if ((cart.length > 0 || adjustments.length > 0 || customerName) && window.confirm('Clear all items, adjustments, and customer from the bill?')) {
      setCart([]);
      setAdjustments([]);
      setCustomerId('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerVillage('');
      setCustomerSearch('');
    }
  }, [cart, adjustments, customerName]);

  const handleSaleComplete = (saleId: string, invoiceNumber?: string, completedTotals?: any) => {
    setLastSaleId(saleId);
    if (invoiceNumber) setLastInvoiceNumber(invoiceNumber);
    if (completedTotals) setLastSaleTotals(completedTotals);
    setShowSuccessDialog(true);
    setCart([]);
    setAdjustments([]);
    setCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerVillage('');
    setCustomerSearch('');
  };

  const handleAddToCart = useCallback((newItem: any) => {
    setCart(prev => {
      const matchIndex = prev.findIndex(item => {
        if (item.product_id !== newItem.product_id) return false;
        if (newItem.batch_id || item.batch_id) {
          return item.batch_id === newItem.batch_id;
        }
        return (item.batch_number || '') === (newItem.batch_number || '');
      });

      if (matchIndex > -1) {
        const updated = [...prev];
        const existing = updated[matchIndex];
        const addQty = Number(newItem.quantity) || 1;
        const newQty = (Number(existing.quantity) || 1) + addQty;

        updated[matchIndex] = {
          ...existing,
          quantity: newQty,
        };

        toast.info(`Increased "${existing.product_name || 'Item'}" quantity to ${newQty}`);
        return updated;
      }

      return [...prev, { ...newItem, id: generateId() }];
    });
  }, []);

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

      {/* ════════ SETUP NOTICE IF PROFILE / BANK DETAILS INCOMPLETE ════════ */}
      {isProfileLoaded && !isShopProfileComplete(shopProfile) && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-bold text-foreground">
                Complete Your Shop &amp; Bank Details
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                {!shopProfile?.shopName 
                  ? 'Please enter your shop details and bank account in Settings before printing invoices.' 
                  : 'Please complete your bank account details (Bank Name, A/C No, IFSC) in Settings for official invoices.'}
              </p>
            </div>
          </div>
          <Link href="/settings?tab=shop" className="shrink-0 w-full sm:w-auto">
            <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1.5">
              <Store className="h-4 w-4" /> Complete Setup <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}

      {/* ════════ SECTION 1: CUSTOMER (Dark Card) ════════ */}
      <section className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm text-card-foreground">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Customer / Farmer</h2>
              <p className="text-xs text-muted-foreground">Select registered farmer or enter customer details directly below</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="text-muted-foreground border-border hover:bg-muted font-medium"
              onClick={() => setShowNewCustomerDialog(true)}
            >
              <UserPlus className="h-4 w-4 mr-1.5" /> New Registered Farmer
            </Button>
            {(customerName || customerPhone || customerVillage) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={clearCustomer}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Clear Customer
              </Button>
            )}
          </div>
        </div>

        {/* Customer Input Fields: Customer Name, Contact No., Village */}
        <div className="space-y-3.5">
          {/* 1. Customer Name */}
          <div className="space-y-1.5">
            <label htmlFor="billing-customer-name" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Customer Name</span>
              {customerId && customerId !== 'walk-in' ? (
                <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                  ✓ Registered Farmer
                </span>
              ) : customerName ? (
                <span className="text-[11px] font-medium text-muted-foreground">
                  Walk-in Customer
                </span>
              ) : null}
            </label>
            <div className="relative">
              <Input
                id="billing-customer-name"
                value={customerName}
                onChange={e => {
                  const val = e.target.value.toUpperCase();
                  setCustomerName(val);
                  setCustomerSearch(val);
                  if (customerId && customerId !== 'walk-in') {
                    setCustomerId('walk-in');
                  }
                }}
                onKeyDown={handleCustomerSearchKeyDown}
                placeholder="Enter customer name or search registered farmer..."
                className="text-base py-5 uppercase font-medium bg-background border-border text-foreground placeholder:text-muted-foreground/70"
              />
              {customerSearch.trim() && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto p-1.5 space-y-1">
                  <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1">
                    Matching Registered Farmers:
                  </div>
                  {searchResults.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground text-sm flex items-center justify-between transition-colors cursor-pointer"
                      onClick={() => selectCustomer(c)}
                    >
                      <span className="font-semibold text-foreground">{c.name}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                        {c.phone && <span>{c.phone}</span>}
                        {c.village && <span className="font-sans text-muted-foreground/80">• {c.village}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Contact No. & 3. Village directly below Customer Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label htmlFor="billing-contact-no" className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span>Contact No.</span>
              </label>
              <Input
                id="billing-contact-no"
                type="tel"
                maxLength={10}
                value={customerPhone}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setCustomerPhone(val);
                  if (customerId && customerId !== 'walk-in') {
                    setCustomerId('walk-in');
                  }
                }}
                placeholder="10-digit mobile number"
                className="text-sm py-4 bg-background border-border text-foreground placeholder:text-muted-foreground/70 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="billing-village" className="text-xs font-semibold text-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span>Village</span>
              </label>
              <Input
                id="billing-village"
                value={customerVillage}
                onChange={e => {
                  setCustomerVillage(e.target.value.toUpperCase());
                  if (customerId && customerId !== 'walk-in') {
                    setCustomerId('walk-in');
                  }
                }}
                placeholder="Village / Town name"
                className="text-sm py-4 uppercase bg-background border-border text-foreground placeholder:text-muted-foreground/70"
              />
            </div>
          </div>
        </div>

        {/* Quick select recent customers chips */}
        <div className="flex flex-wrap gap-2 items-center mt-3 pt-3 border-t border-border/60">
          <span className="text-xs text-muted-foreground mr-1 font-medium">Recent Farmers:</span>
          {recentCustomers.map(c => (
            <Button
              key={c.id}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full px-3 py-1 h-auto text-xs font-medium border-border bg-background/50 hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all text-foreground cursor-pointer"
              onClick={() => selectCustomer(c)}
            >
              {c.name}
            </Button>
          ))}
        </div>
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

      {/* ════════ SECTION 4: BILL ADJUSTMENTS ════════ */}
      <BillAdjustments
        adjustments={adjustments}
        onChange={setAdjustments}
        productsTotal={totals.productsTotal || totals.subtotal}
      />

      {/* ════════ SECTION 5: PAYMENT & COMPLETE ════════ */}
      <PaymentPanel
        cart={cart}
        adjustments={adjustments}
        totals={totals}
        customerId={customerId || (customerSearch.trim() ? `cust-${Date.now()}` : '')}
        customerName={customerName || customerSearch.trim().toUpperCase()}
        customerPhone={customerPhone}
        customerVillage={customerVillage}
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
          invoiceNumber={lastInvoiceNumber || undefined}
          totals={lastSaleTotals || totals}
          onClose={() => {
            setShowSuccessDialog(false);
            setLastSaleId(null);
            setLastInvoiceNumber(null);
            setLastSaleTotals(null);
          }}
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
