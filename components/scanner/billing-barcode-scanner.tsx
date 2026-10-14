'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CameraScannerViewfinder } from './camera-scanner-viewfinder';
import {
  matchBillingProductStock,
  buildBillingCartItem,
  BillingScanLookupResult,
} from '@/lib/scanner/billing-scanner-service';
import { getProductByBarcodeAction } from '@/actions/products';
import { isClientDemoMode, getDemoProductsClient } from '@/lib/client-demo-store';
import { PackagingScannerModal, ConfirmedPackagingDetails } from './packaging-scanner-modal';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  X,
  Scan,
  RotateCcw,
  Search,
  AlertCircle,
  Package,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Calendar,
  Layers,
  IndianRupee,
  ShoppingBag,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { formatProductNameWithSize } from '@/lib/validations';

interface BillingBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: any) => void;
  productsList?: any[];
  onOpenManualSearch?: () => void;
}

export function BillingBarcodeScannerModal({
  isOpen,
  onClose,
  onAddToCart,
  productsList = [],
  onOpenManualSearch,
}: BillingBarcodeScannerModalProps) {
  const [mode, setMode] = useState<
    'scanning' | 'confirmed_preview' | 'not_found' | 'ambiguous' | 'out_of_stock'
  >('scanning');
  const [lookupResult, setLookupResult] = useState<BillingScanLookupResult | null>(null);
  const [scannedCodeDisplay, setScannedCodeDisplay] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [isPackagingModalOpen, setIsPackagingModalOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setMode('scanning');
      setLookupResult(null);
      setScannedCodeDisplay('');
      setSelectedBatchId('');
      setIsPackagingModalOpen(false);
    }
  }, [isOpen]);

  /**
   * Performs strictly local-first product resolution and stock check
   */
  const handleBarcodeScanned = async (rawValue: string) => {
    setIsSearching(true);
    const acceptedRawValue = rawValue.trim();
    setScannedCodeDisplay(acceptedRawValue);

    try {
      // 1. Search in-memory products list (demo store or preloaded list)
      let candidateProducts = productsList;
      if (isClientDemoMode() || candidateProducts.length === 0) {
        const demoList = getDemoProductsClient();
        if (demoList && demoList.length > 0) {
          candidateProducts = demoList;
        }
      }

      let match = matchBillingProductStock(candidateProducts, acceptedRawValue);

      // 2. If not found in-memory and not in client demo mode, perform exact DB lookup action
      if (!match.found && !match.isAmbiguous && !isClientDemoMode()) {
        try {
          const res = await getProductByBarcodeAction(acceptedRawValue);
          if (res.success && res.data) {
            match = matchBillingProductStock([res.data], acceptedRawValue);
          }
        } catch (dbErr) {
          console.warn('[BILLING SCANNER] Server lookup error:', dbErr);
        }
      }

      setLookupResult(match);

      if (match.isAmbiguous || match.reason === 'AMBIGUOUS') {
        setMode('ambiguous');
        return;
      }

      if (!match.found) {
        setMode('not_found');
        return;
      }

      if (match.isOutOfStock) {
        setMode('out_of_stock');
        return;
      }

      if (match.isExpired) {
        toast.error(`Cannot add "${match.product.name}": batch is expired.`);
        setMode('out_of_stock');
        return;
      }

      // Successful product match: Set selected batch id and display confirmation preview
      const initialBatch = match.selectedBatch;
      if (initialBatch?.id) {
        setSelectedBatchId(initialBatch.id);
      }
      setMode('confirmed_preview');
    } catch (err: any) {
      console.error('[BILLING SCANNER] Resolution failed:', err);
      setMode('not_found');
    } finally {
      setIsSearching(false);
    }
  };

  // Confirm adding the recognized product & batch to the cart
  const handleConfirmAddToCart = () => {
    if (!lookupResult || !lookupResult.product) return;

    let activeBatch = lookupResult.selectedBatch;
    const allBatches: any[] = lookupResult.product.batches || [];

    if (selectedBatchId && allBatches.length > 0) {
      const customBatch = allBatches.find((b: any) => b.id === selectedBatchId);
      if (customBatch) {
        activeBatch = customBatch;
      }
    }

    const modifiedMatch: BillingScanLookupResult = {
      ...lookupResult,
      selectedBatch: activeBatch,
    };

    const cartItem = buildBillingCartItem(modifiedMatch);
    if (cartItem) {
      onAddToCart(cartItem);
      toast.success(`✓ "${cartItem.product_name}" added to bill`);
      onClose();
    } else {
      toast.error('Failed to prepare item for cart');
    }
  };

  // Dedicated fallback: Packaging OCR details confirmed
  const handlePackagingDetailsConfirmed = (details: ConfirmedPackagingDetails) => {
    setIsPackagingModalOpen(false);

    let candidateProducts = productsList;
    if (isClientDemoMode() || candidateProducts.length === 0) {
      candidateProducts = getDemoProductsClient() || [];
    }

    // Try matching product by name or barcode
    let matchedProduct: any = null;
    if (details.barcode) {
      const match = matchBillingProductStock(candidateProducts, details.barcode);
      if (match.found) matchedProduct = match.product;
    }

    if (!matchedProduct && details.productName) {
      const q = details.productName.trim().toLowerCase();
      matchedProduct = candidateProducts.find(
        (p: any) => (p.name || '').trim().toLowerCase() === q
      );
    }

    if (matchedProduct) {
      const allBatches: any[] = matchedProduct.batches || [];
      let selectedBatch = details.batchNumber
        ? allBatches.find((b: any) => (b.batch_number || '').trim().toUpperCase() === details.batchNumber?.trim().toUpperCase())
        : allBatches[0];

      const match: BillingScanLookupResult = {
        found: true,
        product: matchedProduct,
        selectedBatch,
        availableStock: selectedBatch
          ? Number(selectedBatch.quantity_available ?? selectedBatch.stock_quantity ?? 0)
          : Number(matchedProduct.current_stock ?? 0),
        reason: 'SUCCESS',
      };

      setLookupResult(match);
      if (selectedBatch?.id) setSelectedBatchId(selectedBatch.id);
      setMode('confirmed_preview');
      toast.success(`Recognized "${matchedProduct.name}" from packaging`);
    } else {
      toast.info('Packaging read complete. Please select matching product in billing search.');
      onClose();
      onOpenManualSearch?.();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          showCloseButton={false}
          className="max-w-md w-[94vw] sm:w-full p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl"
        >
          {/* Header */}
          <DialogHeader className="p-4 pb-2 border-b border-border/70 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Scan className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  {mode === 'confirmed_preview' ? 'Confirm Batch & Add to Bill' : 'Scan Product for Billing'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {mode === 'confirmed_preview'
                    ? 'Verify recognized product, batch, and selling price'
                    : 'Point camera at barcode or QR on desktop, mobile & Android'}
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          {/* Body Content by Mode */}
          <div className="p-4 space-y-4">
            {/* ─── SCANNING MODE ─── */}
            {mode === 'scanning' && (
              <div className="space-y-3">
                <CameraScannerViewfinder
                  viewfinderId="billing-barcode-viewfinder"
                  onScanSuccess={(res) => handleBarcodeScanned(res.rawValue || res.barcode || '')}
                  onClose={onClose}
                  manualPlaceholder="Enter or scan barcode (e.g. 08904232801980)..."
                  onManualSubmit={(code) => handleBarcodeScanned(code)}
                />

                {/* Secondary Action: Scan Packaging Details Fallback */}
                <div className="pt-1 border-t border-border/60 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPackagingModalOpen(true)}
                    className="w-full h-9 rounded-xl border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 font-bold text-xs gap-1.5 transition-all"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Scan Packaging Details / Read Label (OCR)</span>
                  </Button>
                </div>
              </div>
            )}

            {/* ─── CONFIRMED PREVIEW MODE (Batch & Price Recognition) ─── */}
            {mode === 'confirmed_preview' && lookupResult?.product && (
              <div className="space-y-4">
                {/* Product & Recognized Batch Card */}
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/20 text-primary">
                        {lookupResult.product.category?.name || 'Product'}
                      </span>
                      <h3 className="text-base font-bold text-foreground mt-1">
                        {formatProductNameWithSize(
                          lookupResult.product.name,
                          lookupResult.product.pack_size,
                          lookupResult.product.unit
                        )}
                      </h3>
                      {lookupResult.product.brand?.name && (
                        <p className="text-xs text-muted-foreground">
                          By {lookupResult.product.brand.name}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-muted-foreground block">Selling Rate</span>
                      <span className="text-lg font-black text-primary">
                        {formatCurrency(
                          lookupResult.selectedBatch?.selling_price ?? lookupResult.product.selling_price ?? 0
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Batch Details Section */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-primary/10 text-xs">
                    <div className="p-2 rounded-lg bg-background border border-border">
                      <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
                        Batch Number
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {lookupResult.selectedBatch?.batch_number || lookupResult.batchNumber || 'Standard Batch'}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-background border border-border">
                      <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
                        Expiry Date
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {lookupResult.selectedBatch?.expiry_date
                          ? formatDate(lookupResult.selectedBatch.expiry_date)
                          : lookupResult.expiryDate || 'Not specified'}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-background border border-border">
                      <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
                        Available Stock
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {lookupResult.availableStock ?? lookupResult.product.current_stock ?? 0} {lookupResult.product.unit || 'Units'}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-background border border-border">
                      <span className="text-muted-foreground block text-[10px] font-semibold uppercase">
                        Batch MRP
                      </span>
                      <span className="font-bold text-foreground">
                        {formatCurrency(lookupResult.product.mrp || lookupResult.product.wholesale_price || lookupResult.product.selling_price || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Batch Selector if multiple batches available */}
                  {Array.isArray(lookupResult.product.batches) && lookupResult.product.batches.length > 1 && (
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[11px] font-bold text-foreground flex items-center justify-between">
                        <span>Select Specific Batch:</span>
                        <span className="text-muted-foreground font-normal">
                          {lookupResult.product.batches.length} batches available
                        </span>
                      </label>
                      <Select
                        value={selectedBatchId || lookupResult.selectedBatch?.id || ''}
                        onValueChange={(val) => setSelectedBatchId(val)}
                      >
                        <SelectTrigger className="h-9 text-xs bg-background">
                          <SelectValue placeholder="Choose batch" />
                        </SelectTrigger>
                        <SelectContent>
                          {lookupResult.product.batches.map((b: any) => (
                            <SelectItem key={b.id} value={b.id} className="text-xs">
                              {b.batch_number} (Exp: {b.expiry_date ? formatDate(b.expiry_date) : 'N/A'} • Stock: {b.quantity_available ?? b.stock_quantity ?? 0})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLookupResult(null);
                      setMode('scanning');
                    }}
                    className="gap-1.5 text-xs font-semibold"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Scan Another</span>
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onClose}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleConfirmAddToCart}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-5 gap-1.5 shadow-sm"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      <span>Add to Bill</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── NOT FOUND MODE ─── */}
            {mode === 'not_found' && (
              <div className="py-3 text-center space-y-4">
                <div className="h-12 w-12 mx-auto rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-foreground">Product Not Found</h3>
                  {scannedCodeDisplay && (
                    <p className="text-xs font-mono bg-muted/60 py-1 px-2.5 rounded-md inline-block text-muted-foreground border border-border">
                      {scannedCodeDisplay.length > 50 ? scannedCodeDisplay.slice(0, 50) + '...' : scannedCodeDisplay}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    This barcode or QR is not linked to any active product. You can try reading the label details with OCR or search manually.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    onClick={() => setIsPackagingModalOpen(true)}
                    className="w-full gap-2 font-bold text-xs h-10 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Scan Packaging Details (OCR)
                  </Button>
                  <Button
                    onClick={() => {
                      setLookupResult(null);
                      setMode('scanning');
                    }}
                    variant="outline"
                    className="w-full gap-2 font-bold text-xs h-9"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Scan Again
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      onClose();
                      onOpenManualSearch?.();
                    }}
                    className="w-full text-xs text-muted-foreground h-9"
                  >
                    Search Catalog Manually
                  </Button>
                </div>
              </div>
            )}

            {/* ─── OUT OF STOCK MODE ─── */}
            {mode === 'out_of_stock' && (
              <div className="py-3 text-center space-y-4">
                <div className="h-12 w-12 mx-auto rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-foreground">Out of Stock / Expired</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    {lookupResult?.product?.name ? `"${lookupResult.product.name}" has 0 available units or all batches are expired.` : 'No available stock.'}
                  </p>
                </div>
                <div className="flex gap-2 justify-center pt-2">
                  <Button
                    onClick={() => {
                      setLookupResult(null);
                      setMode('scanning');
                    }}
                    className="text-xs font-bold"
                  >
                    Scan Another Product
                  </Button>
                  <Button variant="outline" onClick={onClose} className="text-xs">
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Packaging Scanner Modal Fallback */}
      <PackagingScannerModal
        isOpen={isPackagingModalOpen}
        onClose={() => setIsPackagingModalOpen(false)}
        onConfirmDetails={handlePackagingDetailsConfirmed}
      />
    </>
  );
}
