'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProductSearch from '@/components/billing/product-search';
import BillingCart from '@/components/billing/billing-cart';
import PaymentPanel from '@/components/billing/payment-panel';
import BillSuccessDialog from '@/components/billing/bill-success-dialog';
import { BillingCartItem } from '@/types/sales';
import { KEYBOARD_SHORTCUTS } from '@/lib/constants';
import { generateId } from '@/lib/utils';
import { calculateBillTotal } from '@/lib/calculations';
import { Card } from '@/components/ui/card';

export default function BillingPage() {
  const [cart, setCart] = useState<BillingCartItem[]>([]);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  
  // Calculate totals
  const totals = calculateBillTotal(cart);

  const handleClearCart = useCallback(() => {
    if (cart.length > 0 && window.confirm('Are you sure you want to clear the cart?')) {
      setCart([]);
    }
  }, [cart]);

  const handleSaleComplete = (saleId: string) => {
    setLastSaleId(saleId);
    setShowSuccessDialog(true);
    setCart([]);
  };

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

  return (
    <div className="flex flex-col h-full lg:flex-row gap-4 p-4">
      {/* LEFT panel (30%): Product search + quick add */}
      <div className="w-full lg:w-[30%] flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-green-700">New Bill</h1>
        <div className="flex gap-2 text-xs text-muted-foreground mb-2">
          <span className="bg-muted px-2 py-1 rounded border">F2: New/Clear</span>
          <span className="bg-muted px-2 py-1 rounded border">F4: Search</span>
          <span className="bg-muted px-2 py-1 rounded border">F8: Complete</span>
        </div>
        <ProductSearch onAddToCart={(item) => setCart(prev => [...prev, { ...item, id: generateId() }])} />
      </div>

      {/* CENTER panel (45%): Cart/bill items table */}
      <div className="w-full lg:w-[45%] flex flex-col">
        <Card className="h-full flex flex-col overflow-hidden">
          <BillingCart 
            items={cart} 
            onChange={(newCart) => setCart(newCart)} 
            onClear={handleClearCart}
          />
        </Card>
      </div>

      {/* RIGHT panel (25%): Payment & totals */}
      <div className="w-full lg:w-[25%] flex flex-col">
        <Card className="h-full p-4 flex flex-col overflow-y-auto">
          <PaymentPanel 
            cart={cart}
            totals={totals}
            onComplete={handleSaleComplete}
          />
        </Card>
      </div>

      {showSuccessDialog && lastSaleId && (
        <BillSuccessDialog 
          saleId={lastSaleId} 
          totals={totals}
          onClose={() => setShowSuccessDialog(false)} 
        />
      )}
    </div>
  );
}
