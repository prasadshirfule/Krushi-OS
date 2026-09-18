'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  NativeBarcodeScannerSession,
  isNativeScannerSupported,
  openCameraSettings,
  EmbeddedScannerBoxRect,
} from '@/lib/scanner/capacitor-scanner';
import {
  matchBillingProductStock,
  buildBillingCartItem,
  BillingScanLookupResult,
} from '@/lib/scanner/billing-scanner-service';
import { getProductByBarcodeAction } from '@/actions/products';
import { isClientDemoMode, getDemoProductsClient } from '@/lib/client-demo-store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Flashlight,
  FlashlightOff,
  X,
  Scan,
  RotateCcw,
  Search,
  AlertCircle,
  Package,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

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
  const [mode, setMode] = useState<'scanning' | 'not_found' | 'ambiguous' | 'out_of_stock' | 'permission_denied' | 'web_fallback'>('scanning');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [lookupResult, setLookupResult] = useState<BillingScanLookupResult | null>(null);
  const [scannedCodeDisplay, setScannedCodeDisplay] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const sessionRef = useRef<NativeBarcodeScannerSession | null>(null);
  const scanLockedRef = useRef(false);
  const isProcessingRef = useRef(false);

  // Initialize or teardown scanner session when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      scanLockedRef.current = false;
      isProcessingRef.current = false;
      cleanupScanner();
      setLookupResult(null);
      setScannedCodeDisplay('');
      setManualInput('');
      return;
    }

    startScannerFlow();

    return () => {
      scanLockedRef.current = false;
      isProcessingRef.current = false;
      cleanupScanner();
    };
  }, [isOpen]);

  const cleanupScanner = () => {
    if (sessionRef.current) {
      sessionRef.current.stop();
      sessionRef.current = null;
    }
    setIsTorchOn(false);
    try {
      document.body.classList.remove('barcode-scanner-active');
      document.documentElement.classList.remove('barcode-scanner-active');
    } catch {}
  };

  /**
   * Performs strictly local-first product resolution and stock check
   */
  const handleBarcodeScanned = async (rawValue: string) => {
    if (isProcessingRef.current) {
      return;
    }
    isProcessingRef.current = true;
    setIsSearching(true);

    const acceptedRawValue = rawValue.trim();
    setScannedCodeDisplay(acceptedRawValue);

    // Stop native camera preview immediately after capture
    cleanupScanner();

    try {
      // 1. First, search in-memory products list (demo store or preloaded list)
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

      // Success: Build cart item and add to cart
      const cartItem = buildBillingCartItem(match);
      if (cartItem) {
        onAddToCart(cartItem);
        toast.success(`✓ "${cartItem.product_name}" added to cart`);
        onClose();
      } else {
        setMode('not_found');
      }
    } catch (err: any) {
      console.error('[BILLING SCANNER] Resolution failed:', err);
      setMode('not_found');
    } finally {
      setIsSearching(false);
      isProcessingRef.current = false;
    }
  };

  const startScannerFlow = async () => {
    scanLockedRef.current = false;
    isProcessingRef.current = false;
    setLookupResult(null);

    const isSupported = await isNativeScannerSupported();

    if (!isSupported) {
      setMode('web_fallback');
      return;
    }

    setMode('scanning');

    const session = new NativeBarcodeScannerSession({
      onScanResult: (result) => {
        if (scanLockedRef.current) {
          return;
        }
        scanLockedRef.current = true;
        const acceptedRawValue = result.rawValue;
        cleanupScanner();
        handleBarcodeScanned(acceptedRawValue);
      },
      onError: (errMessage) => {
        toast.error(errMessage);
        setMode('web_fallback');
      },
      onPermissionDenied: () => {
        setMode('permission_denied');
      },
    });

    sessionRef.current = session;

    // Small delay to allow Dialog and viewfinder DOM to mount before measuring coordinates
    await new Promise((r) => setTimeout(r, 60));

    const viewfinderEl = document.getElementById('billing-barcode-viewfinder');
    let box: EmbeddedScannerBoxRect | undefined;
    if (viewfinderEl) {
      const rect = viewfinderEl.getBoundingClientRect();
      box = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        parentId: 'billing-barcode-viewfinder',
      };
    }

    await session.start(box);
  };

  const handleToggleTorch = async () => {
    if (sessionRef.current) {
      const active = await sessionRef.current.toggleTorch();
      setIsTorchOn(active);
    }
  };

  const handleScanAgain = () => {
    scanLockedRef.current = false;
    isProcessingRef.current = false;
    cleanupScanner();
    setLookupResult(null);
    setScannedCodeDisplay('');
    startScannerFlow();
  };

  const handleManualSearchClick = () => {
    cleanupScanner();
    onClose();
    if (onOpenManualSearch) {
      onOpenManualSearch();
    }
  };

  const handleManualBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleBarcodeScanned(manualInput.trim());
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          cleanupScanner();
          onClose();
        }
      }}
    >
      <DialogContent showCloseButton={false} className="max-w-md w-[92vw] sm:w-full p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-4 pb-2 border-b border-border/60 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Scan className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Scan Product
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Point camera at barcode or QR to add directly to bill
              </DialogDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              cleanupScanner();
              onClose();
            }}
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* Body Content by Mode */}
        <div className="p-4 space-y-4">
          {mode === 'scanning' && (
            <div className="space-y-4">
              {/* Bounded Camera Viewfinder */}
              <div
                id="billing-barcode-viewfinder"
                className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black/90 flex flex-col items-center justify-center border-2 border-primary/40 shadow-inner"
              >
                {/* Laser scan animation & target reticle */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div className="w-48 h-32 border-2 border-dashed border-primary/80 rounded-lg relative flex items-center justify-center bg-primary/5">
                    {/* Reticle corner marks */}
                    <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-primary" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-primary" />
                    <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-primary" />
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-primary" />

                    <div className="w-full h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
                  </div>
                  <span className="text-[11px] font-medium text-white/80 mt-3 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm">
                    Align barcode inside frame
                  </span>
                </div>
              </div>

              {/* Controls Footer */}
              <div className="flex items-center justify-between pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleToggleTorch}
                  className="gap-1.5 text-xs font-semibold h-9 rounded-lg"
                >
                  {isTorchOn ? (
                    <>
                      <FlashlightOff className="h-3.5 w-3.5 text-amber-500" />
                      <span>Flash Off</span>
                    </>
                  ) : (
                    <>
                      <Flashlight className="h-3.5 w-3.5" />
                      <span>Flashlight</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    cleanupScanner();
                    onClose();
                  }}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground h-9"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {mode === 'web_fallback' && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-muted/40 border border-border text-center space-y-3">
                <div className="h-10 w-10 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Scan className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-foreground">Manual Barcode Input / Desktop</h4>
                  <p className="text-xs text-muted-foreground">
                    Native hardware camera scanning is optimized on Android device. You can type or scan using a USB barcode gun below:
                  </p>
                </div>

                <form onSubmit={handleManualBarcodeSubmit} className="space-y-2 pt-2">
                  <Input
                    placeholder="Enter or scan barcode (e.g. 08904232801980)..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    autoFocus
                    className="text-center font-mono text-sm h-11"
                  />
                  <div className="flex gap-2 justify-center pt-1">
                    <Button type="submit" size="sm" className="font-bold text-xs px-4" disabled={!manualInput.trim()}>
                      Find & Add to Bill
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        cleanupScanner();
                        onClose();
                      }}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {mode === 'ambiguous' && (
            <div className="py-3 text-center space-y-4">
              <div className="h-12 w-12 mx-auto rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <AlertCircle className="h-6 w-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-foreground">Product Identification Ambiguous</h3>
                {scannedCodeDisplay && (
                  <p className="text-xs font-mono bg-muted/60 py-1 px-2.5 rounded-md inline-block text-muted-foreground border border-border">
                    {lookupResult?.batchNumber ? `Batch: ${lookupResult.batchNumber}` : (scannedCodeDisplay.length > 50 ? scannedCodeDisplay.slice(0, 50) + '...' : scannedCodeDisplay)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Multiple products may match this QR. Please select the product manually.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={handleManualSearchClick}
                  className="w-full gap-2 font-bold text-xs h-10 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Search className="h-3.5 w-3.5" /> Search Manually
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    cleanupScanner();
                    onClose();
                  }}
                  className="w-full text-xs text-muted-foreground h-9"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {mode === 'not_found' && (
            <div className="py-3 text-center space-y-4">
              <div className="h-12 w-12 mx-auto rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <AlertCircle className="h-6 w-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-foreground">Product Not Registered</h3>
                {scannedCodeDisplay && (
                  <p className="text-xs font-mono bg-muted/60 py-1 px-2.5 rounded-md inline-block text-muted-foreground border border-border">
                    {scannedCodeDisplay.length > 50 ? scannedCodeDisplay.slice(0, 50) + '...' : scannedCodeDisplay}
                  </p>
                )}
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  This barcode or QR is not registered in your inventory.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={handleScanAgain}
                  className="w-full gap-2 font-bold text-xs h-10 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Scan Again
                </Button>
                <Button
                  variant="outline"
                  onClick={handleManualSearchClick}
                  className="w-full gap-2 font-semibold text-xs h-10"
                >
                  <Search className="h-3.5 w-3.5" /> Search Manually
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    cleanupScanner();
                    onClose();
                  }}
                  className="w-full text-xs text-muted-foreground h-9"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {mode === 'out_of_stock' && (
            <div className="py-3 text-center space-y-4">
              <div className="h-12 w-12 mx-auto rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <AlertTriangle className="h-6 w-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-foreground">Product is Out of Stock</h3>
                {lookupResult?.product && (
                  <p className="text-sm font-semibold text-foreground">
                    {lookupResult.product.name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Available stock: <span className="font-bold text-destructive">0</span>
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={handleScanAgain}
                  className="w-full gap-2 font-bold text-xs h-10"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Scan Another Product
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    cleanupScanner();
                    onClose();
                  }}
                  className="w-full text-xs h-10"
                >
                  Close
                </Button>
              </div>
            </div>
          )}

          {mode === 'permission_denied' && (
            <div className="py-4 text-center space-y-4">
              <div className="h-12 w-12 mx-auto rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <Smartphone className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-foreground">Camera Permission Required</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Camera permission is needed to scan product barcodes. Please enable it in your device settings.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => openCameraSettings()}
                  className="w-full font-bold text-xs h-10"
                >
                  Open App Settings
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    cleanupScanner();
                    onClose();
                  }}
                  className="w-full text-xs h-9"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
