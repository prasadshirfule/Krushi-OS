'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  NativeBarcodeScannerSession,
  isNativeScannerSupported,
  openCameraSettings,
  EmbeddedScannerBoxRect,
} from '@/lib/scanner/capacitor-scanner';
import { extractBillingLookupCodes } from '@/lib/scanner/billing-scanner-service';
import { extractBatchAndExpiryFromIdentifier } from '@/lib/scanner/barcode-parser';
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
  Smartphone,
  Check,
  QrCode,
  Barcode,
} from 'lucide-react';

export interface LinkedIdentifierPayload {
  raw_value: string;
  identifier_type: 'barcode' | 'gtin' | 'qr' | 'other';
  normalized_value?: string | null;
  is_primary?: boolean;
  detected_batch?: string;
  detected_expiry?: string;
}

interface LinkProductBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinkIdentifier: (identifier: LinkedIdentifierPayload) => void;
}

export function LinkProductBarcodeModal({
  isOpen,
  onClose,
  onLinkIdentifier,
}: LinkProductBarcodeModalProps) {
  const [mode, setMode] = useState<'scanning' | 'permission_denied' | 'web_fallback'>('scanning');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [manualInput, setManualInput] = useState('');

  const sessionRef = useRef<NativeBarcodeScannerSession | null>(null);
  const scanLockedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      scanLockedRef.current = false;
      cleanupScanner();
      setManualInput('');
      return;
    }

    startScannerFlow();

    return () => {
      scanLockedRef.current = false;
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

  const handleCaptureIdentifier = (rawValue: string, format = 'UNKNOWN') => {
    const clean = rawValue.trim();
    if (!clean) return;

    // Determine type
    const isUrl = /^https?:\/\//i.test(clean);
    const isMultiLine = clean.includes('\n') || clean.includes('\r');
    let type: 'barcode' | 'gtin' | 'qr' | 'other' = 'barcode';

    if (isUrl || isMultiLine || format === 'QR_CODE') {
      type = 'qr';
    } else if (/^\d{8,14}$/.test(clean)) {
      type = 'gtin';
    }

    const { primaryCode } = extractBillingLookupCodes(clean);
    const { batchNumber, expiryDate } = extractBatchAndExpiryFromIdentifier(clean);

    const payload: LinkedIdentifierPayload = {
      raw_value: clean,
      identifier_type: type,
      normalized_value: primaryCode || clean,
      is_primary: true,
      detected_batch: batchNumber,
      detected_expiry: expiryDate,
    };

    cleanupScanner();
    onLinkIdentifier(payload);
    onClose();
  };

  const startScannerFlow = async () => {
    scanLockedRef.current = false;

    const isSupported = await isNativeScannerSupported();

    if (!isSupported) {
      setMode('web_fallback');
      return;
    }

    setMode('scanning');

    const session = new NativeBarcodeScannerSession({
      onScanResult: (result) => {
        if (scanLockedRef.current) return;
        scanLockedRef.current = true;
        const acceptedRawValue = result.rawValue;
        const acceptedFormat = result.format;
        cleanupScanner();
        handleCaptureIdentifier(acceptedRawValue, acceptedFormat);
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

    // Delay to let modal DOM mount before measuring rect
    await new Promise((r) => setTimeout(r, 60));

    const viewfinderEl = document.getElementById('link-barcode-viewfinder');
    let box: EmbeddedScannerBoxRect | undefined;
    if (viewfinderEl) {
      const rect = viewfinderEl.getBoundingClientRect();
      box = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        parentId: 'link-barcode-viewfinder',
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

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleCaptureIdentifier(manualInput.trim());
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
      <DialogContent className="max-w-md w-[92vw] sm:w-full p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-4 pb-2 border-b border-border/60 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Scan className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Link Product QR / Barcode
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Point camera at product barcode or QR to register identifier
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

        {/* Body Content */}
        <div className="p-4 space-y-4">
          {mode === 'scanning' && (
            <div className="space-y-4">
              {/* Bounded Camera Viewfinder */}
              <div
                id="link-barcode-viewfinder"
                className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black/90 flex flex-col items-center justify-center border-2 border-primary/40 shadow-inner"
              >
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div className="w-48 h-32 border-2 border-dashed border-primary/80 rounded-lg relative flex items-center justify-center bg-primary/5">
                    <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-primary" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-primary" />
                    <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-primary" />
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-primary" />

                    <div className="w-full h-0.5 bg-primary/90 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse" />
                  </div>
                  <span className="text-[11px] font-medium text-white/80 mt-3 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm">
                    Align QR / barcode inside frame
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
                  <h4 className="text-sm font-bold text-foreground">Type or Scan Identifier</h4>
                  <p className="text-xs text-muted-foreground">
                    Enter the barcode number, GTIN, or scan using a USB barcode gun:
                  </p>
                </div>

                <form onSubmit={handleManualSubmit} className="space-y-2 pt-2">
                  <Input
                    placeholder="e.g. 08904232801980 or paste QR payload..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    autoFocus
                    className="text-center font-mono text-sm h-11"
                  />
                  <div className="flex gap-2 justify-center pt-1">
                    <Button type="submit" size="sm" className="font-bold text-xs px-4" disabled={!manualInput.trim()}>
                      Link Identifier
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

          {mode === 'permission_denied' && (
            <div className="py-4 text-center space-y-4">
              <div className="h-12 w-12 mx-auto rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <Smartphone className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-foreground">Camera Permission Required</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Camera permission is needed to scan product barcodes and QR codes.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => openCameraSettings()} className="w-full font-bold text-xs h-10">
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
