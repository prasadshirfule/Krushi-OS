'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  recognizePackagingDetails,
  PackagingScanResult,
  OcrProgressCallback,
} from '@/lib/scanner/web-ocr';
import { isWebCameraSupported, isSecureContextActive } from '@/lib/scanner/web-barcode-scanner';
import { Capacitor } from '@capacitor/core';
import { CameraPreview } from '@capacitor-community/camera-preview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  X,
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Calendar,
  Layers,
  Building2,
  Package,
  IndianRupee,
  Barcode,
  RefreshCw,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Edit3,
} from 'lucide-react';
import { formatToDDMMYYYY } from '@/lib/validations';

export interface ConfirmedPackagingDetails {
  productName?: string;
  manufacturer?: string;
  batchNumber?: string;
  manufacturingDate?: string; // DD/MM/YYYY or YYYY-MM-DD
  expiryDate?: string; // DD/MM/YYYY
  expiryDateDB?: string; // YYYY-MM-DD
  mrp?: number;
  barcode?: string;
  packSize?: string;
  sizeValue?: number;
  sizeUnit?: string;
  composition?: string;
  formulation?: string;
}

interface PackagingScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDetails: (details: ConfirmedPackagingDetails) => void;
  initialProductHint?: string;
}

export function PackagingScannerModal({
  isOpen,
  onClose,
  onConfirmDetails,
  initialProductHint,
}: PackagingScannerModalProps) {
  const [stage, setStage] = useState<'capture' | 'processing' | 'review'>('capture');
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('Initializing OCR...');
  const [scanResult, setScanResult] = useState<PackagingScanResult | null>(null);

  // Review Form Editable State
  const [editProductName, setEditProductName] = useState('');
  const [editManufacturer, setEditManufacturer] = useState('');
  const [editBatchNumber, setEditBatchNumber] = useState('');
  const [editMfgDate, setEditMfgDate] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editMrp, setEditMrp] = useState<string>('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editPackSize, setEditPackSize] = useState('');

  // Live Camera Video Element Ref
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setStage('capture');
      setPreviewImage(null);
      setScanResult(null);
      setOcrProgress(0);
      return;
    }

    if (activeTab === 'camera') {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  const startCamera = async () => {
    if (isNative) {
      // Capacitor Android path handled via Camera preview or device file picker
      return;
    }

    if (!isWebCameraSupported() || !isSecureContextActive()) {
      setActiveTab('upload');
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('muted', 'true');
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('[PACKAGING SCANNER] Camera start failed:', err);
      toast.info('Camera unavailable, switched to photo upload mode.');
      setActiveTab('upload');
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {}
    }
  };

  // Capture snapshot from live camera feed
  const handleCaptureSnapshot = async () => {
    if (isNative) {
      // Trigger file picker or Camera plugin on native
      fileInputRef.current?.click();
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl || videoEl.videoWidth === 0) {
      toast.error('Camera feed is not ready yet');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    stopCamera();
    setPreviewImage(dataUrl);
    runOcrAnalysis(canvas);
  };

  // Handle uploaded image file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopCamera();
    const url = URL.createObjectURL(file);
    setPreviewImage(url);
    runOcrAnalysis(file);
  };

  // Run OCR analysis and populate review form
  const runOcrAnalysis = async (source: File | HTMLCanvasElement | string) => {
    setStage('processing');
    setOcrProgress(5);
    setOcrStatusText('Preparing packaging label...');

    try {
      const result = await recognizePackagingDetails(source, (progress, status) => {
        setOcrProgress(progress);
        setOcrStatusText(status);
      });

      setScanResult(result);

      // Populate editable fields with detected or formatted values
      setEditProductName(result.productName || initialProductHint || '');
      setEditManufacturer(result.manufacturer || result.brand || '');
      setEditBatchNumber(result.batchNumber || '');
      setEditMfgDate(result.manufacturingDate ? formatToDDMMYYYY(result.manufacturingDate) : '');
      setEditExpiryDate(result.expiryDate || (result.expiryDateDB ? formatToDDMMYYYY(result.expiryDateDB) : ''));
      setEditMrp(result.mrp !== undefined && result.mrp !== null ? String(result.mrp) : '');
      setEditBarcode(result.barcode || result.gtin || '');
      setEditPackSize(result.packSize || (result.sizeValue ? `${result.sizeValue} ${result.sizeUnit || ''}`.trim() : ''));

      setStage('review');
    } catch (err: any) {
      console.error('[PACKAGING OCR] Analysis failed:', err);
      toast.error('Failed to read packaging text: ' + (err.message || 'Please try another photo.'));
      setStage('capture');
    }
  };

  const getConfidenceBadge = (fieldKey: string, value: any) => {
    if (!value || String(value).trim() === '') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
          <HelpCircle className="h-3 w-3" /> Manual Input
        </span>
      );
    }

    const conf = scanResult?.confidence?.[fieldKey];
    if (conf !== undefined && conf >= 0.85) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">
          <CheckCircle2 className="h-3 w-3" /> High Confidence
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
        <AlertCircle className="h-3 w-3" /> Suggestion (Verify)
      </span>
    );
  };

  const handleApplyDetails = () => {
    // Validate Expiry Date if provided
    let cleanExpUI = editExpiryDate.trim();
    let cleanExpDB: string | undefined = undefined;

    if (cleanExpUI) {
      const match = cleanExpUI.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
      if (match) {
        const dd = match[1].padStart(2, '0');
        const mm = match[2].padStart(2, '0');
        const yyyy = match[3];
        cleanExpUI = `${dd}/${mm}/${yyyy}`;
        cleanExpDB = `${yyyy}-${mm}-${dd}`;
      }
    }

    const confirmed: ConfirmedPackagingDetails = {
      productName: editProductName.trim().toUpperCase() || undefined,
      manufacturer: editManufacturer.trim().toUpperCase() || undefined,
      batchNumber: editBatchNumber.trim().toUpperCase() || undefined,
      manufacturingDate: editMfgDate.trim() || undefined,
      expiryDate: cleanExpUI || undefined,
      expiryDateDB: cleanExpDB,
      mrp: editMrp ? parseFloat(editMrp) : undefined,
      barcode: editBarcode.trim() || undefined,
      packSize: editPackSize.trim() || undefined,
      sizeValue: scanResult?.sizeValue,
      sizeUnit: scanResult?.sizeUnit,
      composition: scanResult?.composition,
      formulation: scanResult?.formulation,
    };

    onConfirmDetails(confirmed);
    toast.success('Packaging details applied to product form ✓');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-xl w-[95vw] sm:w-full p-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl"
      >
        {/* Modal Header */}
        <DialogHeader className="p-4 pb-3 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                {stage === 'review'
                  ? 'Review Packaging Details'
                  : 'Scan Agricultural Packaging Label'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {stage === 'review'
                  ? 'Verify or edit detected batch, expiry, and MRP before saving'
                  : 'Capture or upload a packaging photo to automatically extract batch & expiry'}
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
        <div className="p-4 max-h-[75vh] overflow-y-auto">
          {/* ══════════════════════════════════════════════════
              STAGE 1: CAPTURE PHOTO OR UPLOAD
          ══════════════════════════════════════════════════ */}
          {stage === 'capture' && (
            <div className="space-y-4">
              {/* Tab Selector: Live Camera vs Photo Upload */}
              <div className="flex rounded-xl bg-muted p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setActiveTab('camera')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'camera'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>Live Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'upload'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload / Photo Picker</span>
                </button>
              </div>

              {activeTab === 'camera' ? (
                <div className="space-y-3">
                  <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black/95 flex items-center justify-center border-2 border-primary/40 shadow-inner">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="absolute inset-0 w-full h-full object-cover"
                    />

                    {/* Viewfinder Target */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                      <div className="w-64 h-44 border-2 border-dashed border-primary/70 rounded-xl bg-primary/5 flex items-center justify-center">
                        <span className="text-[11px] font-semibold text-white/90 px-2 py-1 rounded bg-black/60 backdrop-blur-xs">
                          Fit label, batch & expiry inside
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-1">
                    <Button
                      type="button"
                      onClick={handleCaptureSnapshot}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-11 rounded-xl shadow-md gap-2"
                    >
                      <Camera className="h-4 w-4" />
                      <span>Capture & Recognize Details</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-4 text-center">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-8 border-2 border-dashed border-border hover:border-primary/60 rounded-2xl bg-muted/30 cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 group"
                  >
                    <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-foreground">
                        Click to select packaging photo
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports JPEG, PNG, WEBP from device camera or gallery
                      </p>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              STAGE 2: PROCESSING OCR
          ══════════════════════════════════════════════════ */}
          {stage === 'processing' && (
            <div className="py-10 text-center space-y-4">
              <div className="relative h-16 w-16 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="h-8 w-8 animate-pulse text-primary" />
              </div>
              <div className="space-y-1.5 max-w-sm mx-auto">
                <h4 className="text-base font-bold text-foreground">
                  Reading Packaging Details...
                </h4>
                <p className="text-xs text-muted-foreground">{ocrStatusText}</p>
              </div>

              <div className="max-w-xs mx-auto space-y-1 pt-2">
                <Progress value={ocrProgress} className="h-2 rounded-full" />
                <span className="text-[11px] font-mono font-bold text-primary">
                  {ocrProgress}%
                </span>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              STAGE 3: REVIEW & EDIT EXTRACTED DETAILS
          ══════════════════════════════════════════════════ */}
          {stage === 'review' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                <p className="text-xs text-foreground font-medium">
                  Review extracted fields below. You can edit any value before saving.
                  <strong> No fake stock will be added.</strong>
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Product Name */}
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Product Name</Label>
                    {getConfidenceBadge('productName', editProductName)}
                  </div>
                  <Input
                    value={editProductName}
                    onChange={(e) => setEditProductName(e.target.value.toUpperCase())}
                    placeholder="e.g. EVICENT, UREA, CONFIDOR"
                    className="h-10 text-sm uppercase font-bold"
                  />
                </div>

                {/* Manufacturer / Brand */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Manufacturer / Brand</Label>
                    {getConfidenceBadge('manufacturer', editManufacturer)}
                  </div>
                  <Input
                    value={editManufacturer}
                    onChange={(e) => setEditManufacturer(e.target.value.toUpperCase())}
                    placeholder="e.g. SYNGENTA, BAYER"
                    className="h-10 text-sm uppercase"
                  />
                </div>

                {/* Batch / Lot Number */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Batch / Lot Number</Label>
                    {getConfidenceBadge('batchNumber', editBatchNumber)}
                  </div>
                  <Input
                    value={editBatchNumber}
                    onChange={(e) => setEditBatchNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. SPL6A20014"
                    className="h-10 text-sm uppercase font-mono font-bold"
                  />
                </div>

                {/* Manufacturing Date */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Mfg Date (MFD)</Label>
                    {getConfidenceBadge('manufacturingDate', editMfgDate)}
                  </div>
                  <Input
                    value={editMfgDate}
                    onChange={(e) => setEditMfgDate(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="h-10 text-sm font-mono"
                  />
                </div>

                {/* Expiry Date */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Expiry Date (EXP)</Label>
                    {getConfidenceBadge('expiryDate', editExpiryDate)}
                  </div>
                  <Input
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="h-10 text-sm font-mono font-bold"
                  />
                </div>

                {/* MRP */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Maximum Retail Price (MRP)</Label>
                    {getConfidenceBadge('mrp', editMrp)}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">
                      ₹
                    </span>
                    <Input
                      type="number"
                      step="any"
                      value={editMrp}
                      onChange={(e) => setEditMrp(e.target.value)}
                      placeholder="e.g. 1569.00"
                      className="h-10 pl-7 text-sm font-bold"
                    />
                  </div>
                </div>

                {/* Barcode / GTIN */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Barcode / GTIN</Label>
                    {getConfidenceBadge('barcode', editBarcode)}
                  </div>
                  <Input
                    value={editBarcode}
                    onChange={(e) => setEditBarcode(e.target.value)}
                    placeholder="e.g. 08904232801980"
                    className="h-10 text-sm font-mono"
                  />
                </div>

                {/* Pack Size */}
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Pack Size / Net Content</Label>
                    {getConfidenceBadge('packSize', editPackSize)}
                  </div>
                  <Input
                    value={editPackSize}
                    onChange={(e) => setEditPackSize(e.target.value)}
                    placeholder="e.g. 60 g, 100 ml, 1 kg"
                    className="h-10 text-sm"
                  />
                </div>
              </div>

              {/* Raw Recognized OCR Snippet Accordion */}
              {scanResult?.rawOcrText && (
                <details className="text-xs border border-border rounded-lg p-2.5 bg-muted/20">
                  <summary className="font-semibold cursor-pointer text-muted-foreground hover:text-foreground">
                    View Raw OCR Recognized Text ({scanResult.rawOcrText.length} chars)
                  </summary>
                  <pre className="mt-2 p-2 rounded bg-background font-mono text-[11px] whitespace-pre-wrap max-h-32 overflow-y-auto border border-border">
                    {scanResult.rawOcrText}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-4 pt-3 border-t border-border flex flex-row items-center justify-between gap-2">
          {stage === 'review' ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStage('capture');
                  setPreviewImage(null);
                  setScanResult(null);
                  if (activeTab === 'camera') startCamera();
                }}
                className="gap-1.5 text-xs font-semibold"
              >
                <RefreshCw className="h-3.5 w-3.5" />
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
                  onClick={handleApplyDetails}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-4 gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Apply to Product</span>
                </Button>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs"
              >
                Cancel
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
