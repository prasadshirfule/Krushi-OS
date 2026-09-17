'use client';

import React, { useState, useRef } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  FileText,
  Camera as CameraIcon,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Plus,
  Trash2,
  Package,
  Building2,
  Receipt,
  Calendar,
  Layers,
} from 'lucide-react';
import { formatCurrency, generateId } from '@/lib/utils';
import {
  PurchaseDraftResult,
  ExtractedPurchaseItem,
  ExtractedSupplier,
} from '@/lib/scanner/purchase-bill-parser';
import { processPurchaseBillImage } from '@/lib/scanner/purchase-bill-engine';

export interface PurchaseBillScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyDraft: (draft: PurchaseDraftResult) => void;
  catalogProducts?: any[];
  suppliersList?: any[];
}

export function PurchaseBillScannerModal({
  isOpen,
  onClose,
  onApplyDraft,
  catalogProducts = [],
  suppliersList = [],
}: PurchaseBillScannerModalProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('upload');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [draft, setDraft] = useState<PurchaseDraftResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isBusyRef = useRef(false);

  // Reset state when closing or opening
  const handleModalClose = () => {
    if (isProcessing) return;
    setSelectedImageUri(null);
    setDraft(null);
    setErrorMessage(null);
    setIsProcessing(false);
    onClose();
  };

  // 1. Camera Capture Handler
  const handleCaptureCamera = async () => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;
    setErrorMessage(null);

    try {
      if (Capacitor.isNativePlatform()) {
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
        });

        if (image && image.webPath) {
          setSelectedImageUri(image.webPath);
          await runProcessingPipeline(image.path || image.webPath);
        }
      } else {
        // Desktop / Web browser: trigger file input with capture or standard picker
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
      }
    } catch (err: any) {
      if (err?.message !== 'User cancelled photos app') {
        console.warn('Camera capture cancelled or failed:', err);
        setErrorMessage(err?.message || 'Could not access camera');
      }
    } finally {
      isBusyRef.current = false;
    }
  };

  // 2. File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (JPG, PNG, WEBP)');
      return;
    }

    setErrorMessage(null);
    const objectUrl = URL.createObjectURL(file);
    setSelectedImageUri(objectUrl);

    await runProcessingPipeline(undefined, file);
    // Reset file input so re-selecting same file triggers onChange
    e.target.value = '';
  };

  // 3. Extraction Processing Pipeline
  const runProcessingPipeline = async (imagePath?: string, file?: File) => {
    setIsProcessing(true);
    setProcessingStatus('Analyzing document...');
    setErrorMessage(null);

    try {
      const result = await processPurchaseBillImage({
        imagePathOrBase64: imagePath,
        file,
        catalogProducts,
        suppliersList,
        onProgress: (status) => setProcessingStatus(status),
      });

      setDraft(result);
      if (result.items.length === 0 && !result.invoiceNumber && !result.supplier?.name) {
        setErrorMessage('Could not detect clear text or invoice details. You can review and enter manually or try another clearer photo.');
      } else {
        toast.success(
          result.source === 'qr'
            ? 'Structured Invoice QR detected!'
            : result.source === 'hybrid'
            ? 'Invoice QR + Bill Text processed'
            : 'Bill text recognized with OCR'
        );
      }
    } catch (err: any) {
      console.error('Bill processing failed:', err);
      setErrorMessage(err?.message || 'Failed to process purchase bill image. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // 4. Draft field update handlers (Editable Review Step)
  const handleUpdateSupplierName = (name: string) => {
    if (!draft) return;
    const existing = suppliersList.find(
      (s) => s.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    setDraft({
      ...draft,
      supplier: {
        ...(draft.supplier || { name: '', isMatched: false }),
        id: existing?.id,
        name,
        isMatched: !!existing,
      },
    });
  };

  const handleUpdateSupplierGstin = (gstin: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      supplier: {
        ...(draft.supplier || { name: '', isMatched: false }),
        gstin,
      },
    });
  };

  const handleUpdateInvoiceField = (field: 'invoiceNumber' | 'invoiceDate', value: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      [field]: value,
    });
  };

  const handleUpdateItem = (index: number, updates: Partial<ExtractedPurchaseItem>) => {
    if (!draft) return;
    const newItems = [...draft.items];
    newItems[index] = { ...newItems[index], ...updates };
    setDraft({
      ...draft,
      items: newItems,
    });
  };

  const handleSelectProductForItem = (index: number, productId: string) => {
    if (!draft) return;
    const prod = catalogProducts.find((p) => p.id === productId);
    const newItems = [...draft.items];
    if (prod) {
      newItems[index] = {
        ...newItems[index],
        matchedProductId: prod.id,
        matchedProductName: prod.name,
        isMatched: true,
        sku: prod.sku,
        unit: prod.unit || newItems[index].unit,
        gstRate: prod.gst_rate ?? newItems[index].gstRate,
        sellingPrice: prod.selling_price ?? newItems[index].sellingPrice,
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        matchedProductId: undefined,
        matchedProductName: undefined,
        isMatched: false,
      };
    }
    setDraft({ ...draft, items: newItems });
  };

  const handleRemoveItem = (index: number) => {
    if (!draft) return;
    const newItems = draft.items.filter((_, i) => i !== index);
    setDraft({ ...draft, items: newItems });
  };

  const handleAddNewItem = () => {
    if (!draft) return;
    const newItem: ExtractedPurchaseItem = {
      rawName: 'New Item',
      isMatched: false,
      unit: 'BAGS',
      quantity: 1,
      purchasePrice: 0,
      gstRate: 5,
    };
    setDraft({
      ...draft,
      items: [...draft.items, newItem],
    });
  };

  // 5. Final Confirmation & Apply to Purchase
  const handleConfirmAndApply = () => {
    if (!draft) return;
    onApplyDraft(draft);
    toast.success('Purchase draft applied to invoice entry');
    handleModalClose();
  };

  // Financial calculations from current draft items
  const draftSubtotal =
    draft?.items.reduce((acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.purchasePrice) || 0), 0) ||
    draft?.subtotal ||
    0;

  const draftTax =
    draft?.items.reduce(
      (acc, item) =>
        acc +
        (Number(item.quantity) || 0) *
          (Number(item.purchasePrice) || 0) *
          ((Number(item.gstRate) || 0) / 100),
      0
    ) ||
    draft?.totalTax ||
    0;

  const draftGrandTotal = draftSubtotal + draftTax || draft?.grandTotal || 0;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleModalClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-3xl w-[95vw] sm:w-full p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl max-h-[92vh] flex flex-col"
      >
        {/* Header with single X close button */}
        <DialogHeader className="p-4 pb-3 border-b border-border/60 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Scan Purchase Bill
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Capture a supplier invoice, bill or QR to automatically prepare the purchase entry
              </DialogDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleModalClose}
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Top Mode Selection: Camera vs Upload */}
          {!draft && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={activeTab === 'upload' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('upload')}
                  className="flex-1 gap-2 font-medium text-xs h-9 rounded-lg"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload Bill Image
                </Button>
                <Button
                  type="button"
                  variant={activeTab === 'camera' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('camera')}
                  className="flex-1 gap-2 font-medium text-xs h-9 rounded-lg"
                >
                  <CameraIcon className="h-3.5 w-3.5" />
                  Camera Scan
                </Button>
              </div>

              {/* Upload Dropzone / Action Area */}
              <div
                onClick={() => {
                  if (activeTab === 'camera') {
                    handleCaptureCamera();
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                className="cursor-pointer border-2 border-dashed border-border/80 hover:border-primary/60 transition-colors rounded-xl p-8 flex flex-col items-center justify-center text-center bg-muted/20 hover:bg-muted/30"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                  {activeTab === 'camera' ? (
                    <CameraIcon className="h-6 w-6" />
                  ) : (
                    <Upload className="h-6 w-6" />
                  )}
                </div>

                <p className="text-sm font-semibold text-foreground mb-1">
                  {activeTab === 'camera'
                    ? 'Take photo of supplier bill'
                    : 'Click or drop bill image here'}
                </p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Supports GST Tax Invoices, wholesale cash memos, and e-Invoice QR codes (JPG, PNG)
                </p>
              </div>
            </div>
          )}

          {/* Loading / Processing State */}
          {isProcessing && (
            <div className="p-8 rounded-xl bg-muted/40 border border-border flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">{processingStatus || 'Processing image...'}</p>
                <p className="text-xs text-muted-foreground">
                  Analyzing QR codes, reading invoice tables, and matching products...
                </p>
              </div>
            </div>
          )}

          {/* Error Banner if any */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{errorMessage}</p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  You can edit the details below or take another clearer photo.
                </p>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              DRAFT REVIEW & EDIT STEP (NEVER AUTO-SAVES)
              ───────────────────────────────────────────────────────── */}
          {draft && !isProcessing && (
            <div className="space-y-4">
              {/* Draft Status Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] uppercase bg-primary/10 text-primary border-primary/30"
                  >
                    {draft.source === 'qr'
                      ? '✓ E-Invoice QR'
                      : draft.source === 'hybrid'
                      ? '✓ QR + OCR Hybrid'
                      : '✓ OCR Extracted'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Review and adjust extracted values before continuing
                  </span>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft(null);
                    setSelectedImageUri(null);
                    setErrorMessage(null);
                  }}
                  className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" /> Re-scan
                </Button>
              </div>

              {/* Section 1: Supplier & Invoice Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-card border border-border">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-primary" /> Supplier Name
                    </label>
                    {draft.supplier?.isMatched ? (
                      <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-0.5">
                        <CheckCircle2 className="h-3 w-3" /> Matched
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-500 font-medium flex items-center gap-0.5">
                        <AlertTriangle className="h-3 w-3" /> Needs review
                      </span>
                    )}
                  </div>
                  <Input
                    value={draft.supplier?.name || ''}
                    onChange={(e) => handleUpdateSupplierName(e.target.value)}
                    placeholder="Supplier / Company name"
                    className="h-9 text-xs"
                  />
                  {draft.supplier?.gstin && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        GSTIN:
                      </span>
                      <Input
                        value={draft.supplier.gstin}
                        onChange={(e) => handleUpdateSupplierGstin(e.target.value)}
                        className="h-6 text-[11px] font-mono uppercase px-1.5 py-0"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Receipt className="h-3.5 w-3.5 text-primary" /> Invoice #
                    </label>
                    <Input
                      value={draft.invoiceNumber || ''}
                      onChange={(e) => handleUpdateInvoiceField('invoiceNumber', e.target.value)}
                      placeholder="e.g. INV-10245"
                      className="h-9 text-xs font-mono uppercase"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-primary" /> Invoice Date
                    </label>
                    <Input
                      type="date"
                      value={draft.invoiceDate || new Date().toISOString().split('T')[0]}
                      onChange={(e) => handleUpdateInvoiceField('invoiceDate', e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Line Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                    <Package className="h-3.5 w-3.5 text-primary" /> Extracted Items ({draft.items.length})
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddNewItem}
                    className="h-7 text-xs gap-1 rounded-lg"
                  >
                    <Plus className="h-3 w-3" /> Add Item
                  </Button>
                </div>

                {draft.items.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-border text-center space-y-2">
                    <p className="text-xs text-muted-foreground">
                      No line items detected automatically from this bill image.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddNewItem}
                      className="text-xs h-8 gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add Item Manually
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {draft.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-card border border-border/90 space-y-2.5 hover:border-border transition-colors"
                      >
                        {/* Item Row 1: Product Name & Match Status */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground">
                                Item #{idx + 1}:
                              </span>
                              <Input
                                value={item.rawName}
                                onChange={(e) =>
                                  handleUpdateItem(idx, { rawName: e.target.value })
                                }
                                placeholder="Product description"
                                className="h-8 text-xs font-medium flex-1"
                              />
                            </div>

                            {/* Catalog Match Selector */}
                            <div className="flex items-center gap-2 pl-12 sm:pl-0">
                              <span className="text-[11px] text-muted-foreground shrink-0">
                                Link to Catalog:
                              </span>
                              <select
                                value={item.matchedProductId || ''}
                                onChange={(e) => handleSelectProductForItem(idx, e.target.value)}
                                className="h-7 text-[11px] px-2 rounded-md border border-border bg-background text-foreground flex-1 focus:outline-none focus:ring-1 focus:ring-primary"
                              >
                                <option value="">-- Product Not Matched (Select) --</option>
                                {catalogProducts.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} {p.sku ? `(${p.sku})` : ''}
                                  </option>
                                ))}
                              </select>
                              {item.isMatched ? (
                                <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                                  ✓ Matched
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] text-amber-500 border-amber-500/30 shrink-0"
                                >
                                  ⚠ Not matched
                                </Badge>
                              )}
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(idx)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 self-end sm:self-center"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Item Row 2: Qty, Rate, GST, Batch, Expiry */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-border/40">
                          <div>
                            <label className="text-[10px] text-muted-foreground">Qty</label>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateItem(idx, {
                                  quantity: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="h-7 text-xs"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-muted-foreground">Rate (₹)</label>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={item.purchasePrice}
                              onChange={(e) =>
                                handleUpdateItem(idx, {
                                  purchasePrice: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="h-7 text-xs"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-muted-foreground">GST %</label>
                            <Input
                              type="number"
                              min="0"
                              max="28"
                              value={item.gstRate}
                              onChange={(e) =>
                                handleUpdateItem(idx, {
                                  gstRate: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="h-7 text-xs"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-muted-foreground">Batch #</label>
                            <Input
                              value={item.batchNumber || ''}
                              onChange={(e) =>
                                handleUpdateItem(idx, { batchNumber: e.target.value })
                              }
                              placeholder="Optional"
                              className="h-7 text-xs font-mono uppercase"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-muted-foreground">Expiry Date</label>
                            <Input
                              type="date"
                              value={item.expiryDate || ''}
                              onChange={(e) =>
                                handleUpdateItem(idx, { expiryDate: e.target.value })
                              }
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3: Financial Summary */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">Draft Total Calculation</span>
                  <div className="text-xs font-medium text-foreground">
                    Subtotal: {formatCurrency(draftSubtotal)} • Tax: {formatCurrency(draftTax)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Grand Total
                  </span>
                  <div className="text-base font-bold text-primary">
                    {formatCurrency(draftGrandTotal)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-border/60 bg-card/80 flex items-center justify-between shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleModalClose}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground h-9"
          >
            Cancel
          </Button>

          {draft && !isProcessing && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleConfirmAndApply}
              className="gap-2 text-xs font-bold h-9 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Confirm & Apply to Purchase
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
