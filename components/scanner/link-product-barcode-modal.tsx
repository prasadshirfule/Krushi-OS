'use client';

import React, { useState, useEffect } from 'react';
import { CameraScannerViewfinder } from './camera-scanner-viewfinder';
import { extractStableIdentifierInfo } from '@/lib/scanner/barcode-parser';
import { ProductScanResult } from '@/lib/scanner/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  X,
  Scan,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Barcode,
  Calendar,
  Layers,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { validateProductIdentifierAction } from '@/actions/products';

export interface LinkedIdentifierPayload {
  raw_value: string;
  identifier_type: 'barcode' | 'gtin' | 'qr' | 'other';
  normalized_value?: string | null;
  stable_product_key?: string | null;
  detected_batch?: string | null;
  detected_serial?: string | null;
  detected_expiry?: string | null;
  is_primary?: boolean;
}

interface LinkProductBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinkIdentifier: (identifier: LinkedIdentifierPayload) => void;
  currentProductId?: string;
  existingIdentifiers?: Array<{ raw_value: string }>;
}

export function LinkProductBarcodeModal({
  isOpen,
  onClose,
  onLinkIdentifier,
  currentProductId,
  existingIdentifiers = [],
}: LinkProductBarcodeModalProps) {
  const [modalStage, setModalStage] = useState<'scan' | 'confirm'>('scan');
  const [pendingPayload, setPendingPayload] = useState<LinkedIdentifierPayload | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setModalStage('scan');
      setPendingPayload(null);
      setDuplicateWarning(null);
      setCopied(false);
    }
  }, [isOpen]);

  const handleScanOrInput = async (scanResult: ProductScanResult | string) => {
    let rawValue = '';
    let format = 'UNKNOWN';

    if (typeof scanResult === 'string') {
      rawValue = scanResult.trim();
    } else {
      rawValue = (scanResult.rawValue || scanResult.barcode || '').trim();
      format = scanResult.format || 'UNKNOWN';
    }

    if (!rawValue) return;

    // Check if already in the product's current local identifiers list
    const isAlreadyInCurrent = existingIdentifiers.some(
      (item) => item.raw_value.trim() === rawValue
    );

    if (isAlreadyInCurrent) {
      toast.warning('This barcode/QR is already linked to this product.');
    }

    const info = extractStableIdentifierInfo(rawValue, format);

    const payload: LinkedIdentifierPayload = {
      raw_value: rawValue,
      identifier_type: info.identifierType,
      normalized_value: info.normalizedValue || rawValue,
      stable_product_key: info.stableProductKey,
      detected_batch: info.batchNumber,
      detected_serial: info.serialNumber,
      detected_expiry: info.expiryDate,
      is_primary: true,
    };

    setPendingPayload(payload);
    setModalStage('confirm');
    setDuplicateWarning(null);
    setIsValidating(true);

    // Validate if already linked to another product in the shop
    try {
      const res = await validateProductIdentifierAction(rawValue, currentProductId);
      if (res && !res.available && res.linkedProductName) {
        setDuplicateWarning(`Already linked to another product: "${res.linkedProductName}".`);
      }
    } catch (err) {
      console.warn('Identifier validation check error:', err);
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmLink = () => {
    if (!pendingPayload) return;
    onLinkIdentifier(pendingPayload);
    onClose();
  };

  const handleCopyCode = () => {
    if (!pendingPayload?.raw_value) return;
    navigator.clipboard?.writeText(pendingPayload.raw_value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success('Identifier copied to clipboard');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md w-[94vw] sm:w-full p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl"
      >
        {/* Modal Header */}
        <DialogHeader className="p-4 pb-3 border-b border-border/70 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Scan className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                {modalStage === 'scan' ? 'Scan Product Barcode / QR' : 'Confirm Scanned Identifier'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {modalStage === 'scan'
                  ? 'Real camera scanning for desktop webcams, mobile browsers & Android'
                  : 'Review detected identifier before linking to product'}
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

        {/* Modal Body */}
        <div className="p-4">
          {modalStage === 'scan' ? (
            <CameraScannerViewfinder
              viewfinderId="link-product-viewfinder"
              onScanSuccess={(res) => handleScanOrInput(res)}
              onClose={onClose}
              manualPlaceholder="e.g. 08904232801980 or paste QR payload..."
              onManualSubmit={(code) => handleScanOrInput(code)}
            />
          ) : (
            pendingPayload && (
              <div className="space-y-4">
                {/* Detected Value Card */}
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/20 text-primary">
                      {pendingPayload.identifier_type === 'qr' ? (
                        <QrCode className="h-3.5 w-3.5" />
                      ) : (
                        <Barcode className="h-3.5 w-3.5" />
                      )}
                      {pendingPayload.identifier_type}
                    </span>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyCode}
                      className="h-7 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                      Decoded Identifier
                    </label>
                    <p className="font-mono text-sm font-bold text-foreground break-all bg-background/80 p-2.5 rounded-lg border border-border select-all">
                      {pendingPayload.raw_value}
                    </p>
                  </div>

                  {/* Detected Metadata (Batch / Expiry) */}
                  {(pendingPayload.detected_batch || pendingPayload.detected_expiry) && (
                    <div className="pt-1 flex flex-wrap gap-2 text-xs">
                      {pendingPayload.detected_batch && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-border font-semibold">
                          <Layers className="h-3.5 w-3.5 text-primary" />
                          <span>Batch: {pendingPayload.detected_batch}</span>
                        </div>
                      )}
                      {pendingPayload.detected_expiry && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-border font-semibold">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          <span>Expiry: {pendingPayload.detected_expiry}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Duplicate Warning Alert */}
                {duplicateWarning && (
                  <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Duplicate Identifier Warning</p>
                      <p>{duplicateWarning}</p>
                    </div>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="flex items-center justify-between gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPendingPayload(null);
                      setModalStage('scan');
                    }}
                    className="gap-1.5 text-xs font-semibold"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Scan Again</span>
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
                      disabled={isValidating || Boolean(duplicateWarning)}
                      onClick={handleConfirmLink}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-4 gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Link to Product</span>
                    </Button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
