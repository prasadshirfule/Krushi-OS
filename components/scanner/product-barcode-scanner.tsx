'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ProductScanResult, FieldConflictRecord } from '@/lib/scanner/types';
import {
  NativeBarcodeScannerSession,
  isNativeScannerSupported,
  openCameraSettings,
} from '@/lib/scanner/capacitor-scanner';
import {
  startEmbeddedOcrCamera,
  stopEmbeddedOcrCamera,
  toggleEmbeddedOcrTorch,
  captureAndRecognizeEmbeddedOcr,
} from '@/lib/scanner/capacitor-ocr';
import { parseScannedBarcode } from '@/lib/scanner/barcode-parser';
import { matchScannedProduct } from '@/lib/scanner/product-matcher';
import { parseProductLabelOcr } from '@/lib/scanner/ocr-parser';
import { mergeProductScanResults } from '@/lib/scanner/source-merger';
import { enrichProductFromUrlAction } from '@/actions/product-enrichment';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Flashlight,
  FlashlightOff,
  X,
  CheckCircle2,
  AlertCircle,
  Scan,
  RotateCcw,
  Sparkles,
  Smartphone,
  ExternalLink,
  Loader2,
  Camera,
  FileText,
  AlertTriangle,
} from 'lucide-react';

interface ProductBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyScanResult: (result: ProductScanResult) => void;
}

function renderSourceBadge(sourceKey?: string) {
  if (!sourceKey) return null;
  const s = sourceKey.toLowerCase();
  let label = sourceKey.toUpperCase();
  let colorClass = 'bg-primary/10 text-primary border border-primary/20';

  if (s === 'manufacturer_url' || s === 'manufacturer') {
    label = 'MANUFACTURER';
    colorClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
  } else if (s === 'gs1') {
    label = 'GS1';
    colorClass = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30';
  } else if (s === 'database' || s === 'db') {
    label = 'DB';
    colorClass = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30';
  } else if (s === 'ocr') {
    label = 'OCR';
    colorClass = 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30';
  }

  return (
    <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold tracking-tight ${colorClass}`}>
      [{label}]
    </span>
  );
}

export function ProductBarcodeScannerModal({
  isOpen,
  onClose,
  onApplyScanResult,
}: ProductBarcodeScannerModalProps) {
  const [mode, setMode] = useState<
    'scanning' | 'ocr_preview' | 'summary' | 'ocr_manual_fallback' | 'permission_denied' | 'web_fallback'
  >('scanning');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isOcrTorchOn, setIsOcrTorchOn] = useState(false);
  const [scanResult, setScanResult] = useState<ProductScanResult | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [ocrRawInput, setOcrRawInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEnrichingUrl, setIsEnrichingUrl] = useState(false);
  const [isOcrCapturing, setIsOcrCapturing] = useState(false);

  const sessionRef = useRef<NativeBarcodeScannerSession | null>(null);

  // Initialize or teardown scanner session when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      cleanupScanner();
      setScanResult(null);
      setManualInput('');
      setOcrRawInput('');
      return;
    }

    startScannerFlow();

    return () => {
      cleanupScanner();
    };
  }, [isOpen]);

  const cleanupScanner = () => {
    if (sessionRef.current) {
      sessionRef.current.stop();
      sessionRef.current = null;
    }
    stopEmbeddedOcrCamera();
    setIsTorchOn(false);
    setIsOcrTorchOn(false);
    try {
      document.body.classList.remove('barcode-scanner-active');
      document.documentElement.classList.remove('barcode-scanner-active');
    } catch {}
  };

  /**
   * Main scan processing pipeline: Local parse -> Instant UI -> DB Lookup -> Background URL Enrichment
   */
  const processRawScanValue = async (rawValue: string, format = 'UNKNOWN') => {
    setIsProcessing(true);
    console.log('[SCANNER RUNTIME] QR detected:', { rawValue, format });

    // 1. Instant Local Parse (GS1 / URL GS1 / Structured QR / Plain Barcode)
    const initialParsed = parseScannedBarcode(rawValue, format);
    console.log('[SCANNER RUNTIME] Digital Link parsed:', initialParsed);
    setScanResult(initialParsed);
    setMode('summary');
    setIsProcessing(false);

    // 2. Safe Background URL Enrichment from manufacturer Digital Link (if present)
    let currentResult = initialParsed;
    if (initialParsed.sourceUrl && initialParsed.sourceUrl.startsWith('https://')) {
      console.log('[SCANNER RUNTIME] Enrichment started for URL:', initialParsed.sourceUrl);
      setIsEnrichingUrl(true);
      try {
        const enrichRes = await enrichProductFromUrlAction(initialParsed.sourceUrl);
        console.log('[SCANNER RUNTIME] Enrichment completed:', enrichRes);
        if (enrichRes.success && enrichRes.data) {
          const webResult: ProductScanResult = {
            rawValue: initialParsed.rawValue,
            format: initialParsed.format,
            source: 'manufacturer_url',
            ...enrichRes.data,
          };
          currentResult = mergeProductScanResults([currentResult, webResult]);
          setScanResult(currentResult);
          toast.success('Product details enriched from manufacturer page');
        }
      } catch (enrichErr) {
        console.warn('[SCANNER RUNTIME] Enrichment failed (non-blocking):', enrichErr);
        // Safe fail: keep original scan data
      } finally {
        setIsEnrichingUrl(false);
      }
    }

    // 3. KRUSHI OS Database Match
    try {
      const dbMatched = await matchScannedProduct(currentResult);
      if (dbMatched && dbMatched !== currentResult) {
        currentResult = mergeProductScanResults([currentResult, dbMatched]);
        setScanResult(currentResult);
        if (dbMatched.existingProductFound) {
          toast.success('Existing KRUSHI OS product matched!');
        }
      }
    } catch {
      // Non-blocking
    }
  };

  const startScannerFlow = async () => {
    setIsProcessing(true);
    setScanResult(null);

    const isSupported = await isNativeScannerSupported();

    if (!isSupported) {
      setIsProcessing(false);
      setMode('web_fallback');
      return;
    }

    setMode('scanning');

    const session = new NativeBarcodeScannerSession({
      onScanResult: (result) => {
        setIsProcessing(false);
        processRawScanValue(result.rawValue, result.format);
      },
      onError: (errMessage) => {
        setIsProcessing(false);
        toast.error(errMessage);
        setMode('web_fallback');
      },
      onPermissionDenied: () => {
        setIsProcessing(false);
        setMode('permission_denied');
      },
    });

    sessionRef.current = session;
    const started = await session.start();
    setIsProcessing(false);

    if (!started) {
      // Handled in session callbacks
    }
  };

  const handleToggleTorch = async () => {
    if (sessionRef.current) {
      const active = await sessionRef.current.toggleTorch();
      setIsTorchOn(active);
    }
  };

  const handleToggleOcrTorch = async () => {
    const nextState = await toggleEmbeddedOcrTorch(isOcrTorchOn);
    setIsOcrTorchOn(nextState);
  };

  const handleApply = () => {
    if (scanResult) {
      onApplyScanResult(scanResult);
      cleanupScanner();
      onClose();
    }
  };

  const handleScanAgain = () => {
    cleanupScanner();
    setScanResult(null);
    setOcrRawInput('');
    startScannerFlow();
  };

  const handleManualTestScan = async () => {
    const trimmed = manualInput.trim();
    if (!trimmed) {
      toast.error('Please enter a barcode, GS1 stream, or QR code URL');
      return;
    }

    await processRawScanValue(trimmed, 'MANUAL_TEST');
  };

  /**
   * Launch Embedded Live Camera OCR Preview (Fallback - User explicit action only)
   */
  const handleOpenEmbeddedOcrPreview = async () => {
    console.log('[SCANNER RUNTIME] OCR fallback requested manually by user');
    setMode('ocr_preview');
    setIsOcrTorchOn(false);
    console.log('[SCANNER RUNTIME] OCR camera starting...');
    const startRes = await startEmbeddedOcrCamera({
      parentId: 'ocr-camera-preview-box',
    });
    if (!startRes.success) {
      console.warn('[SCANNER RUNTIME] OCR camera start failed:', startRes.error);
      toast.error(startRes.error || 'Failed to start camera preview.');
      setMode('ocr_manual_fallback');
    } else {
      console.log('[SCANNER RUNTIME] OCR camera started successfully');
    }
  };

  /**
   * Capture photo from embedded live camera & run Google ML Kit Text Recognition
   */
  const handleCaptureEmbeddedOcr = async () => {
    setIsOcrCapturing(true);
    try {
      const ocrRes = await captureAndRecognizeEmbeddedOcr();
      if (ocrRes.success && ocrRes.parsedResult) {
        if (scanResult) {
          const merged = mergeProductScanResults([scanResult, ocrRes.parsedResult]);
          setScanResult(merged);
        } else {
          setScanResult(ocrRes.parsedResult);
        }
        toast.success('Product label captured & text recognized via ML Kit!');
        setMode('summary');
      } else if (ocrRes.error) {
        toast.error(ocrRes.error);
        setMode('summary');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to process label image.');
      setMode('summary');
    } finally {
      setIsOcrCapturing(false);
    }
  };

  const handleCancelOcrPreview = async () => {
    await stopEmbeddedOcrCamera();
    setIsOcrTorchOn(false);
    if (scanResult) {
      setMode('summary');
    } else {
      cleanupScanner();
      onClose();
    }
  };

  const handleApplyManualOcrText = () => {
    if (!ocrRawInput.trim()) {
      toast.error('Please enter or paste package label text');
      return;
    }

    const ocrResult = parseProductLabelOcr(ocrRawInput);
    if (scanResult) {
      const merged = mergeProductScanResults([scanResult, ocrResult]);
      setScanResult(merged);
      toast.success('Product label information merged with scan data!');
    } else {
      setScanResult(ocrResult);
      toast.success('Product label information extracted!');
    }

    setMode('summary');
  };

  const handleResolveConflictItem = (conflict: FieldConflictRecord, useA: boolean) => {
    if (!scanResult) return;
    const chosenValue = useA ? conflict.valueA : conflict.valueB;
    const chosenSource = useA ? conflict.sourceA : conflict.sourceB;

    const updated: ProductScanResult = {
      ...scanResult,
      [conflict.field]: chosenValue,
      fieldSources: {
        ...scanResult.fieldSources,
        [conflict.field]: chosenSource as any,
      },
      conflicts: scanResult.conflicts?.filter((c) => c !== conflict),
    };

    setScanResult(updated);
    toast.success(`Applied ${conflict.label} from ${chosenSource.toUpperCase()}`);
  };

  if (!isOpen) return null;

  // Identify missing fields for clear presentation
  const missingImportantFields: string[] = [];
  if (scanResult) {
    if (scanResult.mrp === undefined) missingImportantFields.push('MRP');
    if (!scanResult.hsnCode) missingImportantFields.push('HSN');
    if (scanResult.gstRate === undefined) missingImportantFields.push('GST');
    if (!scanResult.composition) missingImportantFields.push('Composition');
    if (!scanResult.packSize && !scanResult.size) missingImportantFields.push('Pack Size');
  }

  return (
    <>
      {/* ─────────────────────────────────────────────────────────
          1. NATIVE BARCODE / QR SCANNING OVERLAY
      ───────────────────────────────────────────────────────── */}
      {mode === 'scanning' && (
        <div
          data-scanner-overlay="true"
          className="fixed inset-0 z-50 flex flex-col justify-between p-4 pointer-events-auto select-none bg-transparent"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between bg-black/75 backdrop-blur-md rounded-2xl p-4 text-white border border-white/10 shadow-2xl">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold">
                <Scan className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-wide">Scan Product Barcode / QR</h3>
                <p className="text-[11px] text-zinc-300">Point camera at QR code, GS1 stream, or barcode</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                cleanupScanner();
                onClose();
              }}
              className="text-white hover:bg-white/20 rounded-full h-9 w-9"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Center Scan Area Viewport with Clear Cutout Window */}
          <div className="relative flex-1 flex flex-col items-center justify-center my-6">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-3xl border-2 border-primary/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.60)] overflow-hidden bg-transparent">
              {/* Corner Indicators */}
              <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />

              {/* Laser Animation */}
              <div className="w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_14px_#22c55e] animate-pulse my-auto absolute top-1/2 -translate-y-1/2" />
            </div>

            <p className="text-xs font-semibold text-white/90 bg-black/60 px-4 py-1.5 rounded-full mt-5 backdrop-blur-md border border-white/10">
              Align barcode or QR inside the box
            </p>
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center justify-center gap-4 bg-black/75 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-2xl">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleToggleTorch}
              className={`rounded-xl px-5 font-bold gap-2 text-white border-white/20 ${
                isTorchOn ? 'bg-amber-500 hover:bg-amber-600 text-black border-amber-500' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {isTorchOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
              {isTorchOn ? 'Torch ON' : 'Flashlight'}
            </Button>

            <Button
              type="button"
              variant="destructive"
              size="lg"
              onClick={() => {
                cleanupScanner();
                onClose();
              }}
              className="rounded-xl px-6 font-bold gap-2"
            >
              <X className="h-5 w-5" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          2. EMBEDDED MINI OCR LIVE CAMERA PREVIEW MODAL (FALLBACK)
      ───────────────────────────────────────────────────────── */}
      {mode === 'ocr_preview' && (
        <div
          data-scanner-overlay="true"
          className="fixed inset-0 z-50 flex flex-col justify-between p-4 pointer-events-auto select-none bg-transparent"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between bg-black/80 backdrop-blur-md rounded-2xl p-4 text-white border border-white/10 shadow-2xl">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold">
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-wide">Scan Product Label (OCR Fallback)</h3>
                <p className="text-[11px] text-zinc-300">Point camera at printed packaging to capture details</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancelOcrPreview}
              className="text-white hover:bg-white/20 rounded-full h-9 w-9"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Center Embedded Camera Viewport */}
          <div className="relative flex-1 flex flex-col items-center justify-center my-4">
            <div
              id="ocr-camera-preview-box"
              className="relative w-80 h-72 sm:w-96 sm:h-80 rounded-3xl border-2 border-primary/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] overflow-hidden bg-transparent"
            >
              {/* Green Corner Brackets */}
              <div className="absolute top-2 left-2 w-7 h-7 border-t-4 border-l-4 border-primary rounded-tl-lg pointer-events-none" />
              <div className="absolute top-2 right-2 w-7 h-7 border-t-4 border-r-4 border-primary rounded-tr-lg pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-7 h-7 border-b-4 border-l-4 border-primary rounded-bl-lg pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-7 h-7 border-b-4 border-r-4 border-primary rounded-br-lg pointer-events-none" />

              {/* Center Guidance Reticle */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-16 border border-white/30 rounded-xl border-dashed" />
              </div>

              {/* Processing Overlay */}
              {isOcrCapturing && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white gap-3 p-4 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-xs font-bold">Recognizing text with Google ML Kit...</p>
                  <p className="text-[11px] text-zinc-300">Extracting Product Name, Composition, MRP & Pack Size</p>
                </div>
              )}
            </div>

            <div className="text-center mt-4 space-y-1">
              <p className="text-xs font-semibold text-white/90 bg-black/60 px-4 py-1.5 rounded-full backdrop-blur-md border border-white/10 inline-block">
                Position product label inside frame
              </p>
              <p className="text-[11px] text-zinc-300">
                Align Name, Active Ingredients, Pack Size & MRP
              </p>
            </div>
          </div>

          {/* Bottom Action Controls */}
          <div className="bg-black/80 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-2xl space-y-3">
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleToggleOcrTorch}
                className={`rounded-xl px-4 font-bold gap-2 text-white border-white/20 ${
                  isOcrTorchOn ? 'bg-amber-500 hover:bg-amber-600 text-black border-amber-500' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                {isOcrTorchOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
                {isOcrTorchOn ? 'Torch ON' : 'Flashlight'}
              </Button>

              <Button
                type="button"
                size="lg"
                onClick={handleCaptureEmbeddedOcr}
                disabled={isOcrCapturing}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 px-6 rounded-xl shadow-lg h-12 text-sm"
              >
                {isOcrCapturing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                {isOcrCapturing ? 'Processing...' : 'Capture Label'}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleCancelOcrPreview}
                className="rounded-xl px-4 font-bold gap-1 text-white border-white/20 bg-white/10 hover:bg-white/20"
              >
                Cancel
              </Button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  stopEmbeddedOcrCamera();
                  setMode('ocr_manual_fallback');
                }}
                className="text-[11px] text-zinc-300 hover:text-white underline underline-offset-2"
              >
                Enter label text manually instead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          3. SCAN RESULT SUMMARY MODAL
      ───────────────────────────────────────────────────────── */}
      {mode === 'summary' && scanResult && (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto border-border bg-card text-card-foreground p-6 rounded-2xl shadow-2xl">
            <DialogHeader className="space-y-2 text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                    <CheckCircle2 className="h-6 w-6 text-primary stroke-[2.5]" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-foreground">
                      {scanResult.existingProductFound
                        ? 'Existing KRUSHI OS Product Found ✓'
                        : scanResult.productName
                        ? `${scanResult.productName} ✓`
                        : 'Product Data Detected ✓'}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <span>Source:</span>
                      {scanResult.source === 'gs1' && <span className="font-semibold text-primary">GS1 Digital Link / AI Identifiers</span>}
                      {scanResult.source === 'structured_qr' && <span className="font-semibold text-primary">Structured QR Code</span>}
                      {scanResult.source === 'manufacturer_url' && <span className="font-semibold text-emerald-600 dark:text-emerald-400">Manufacturer Digital Link</span>}
                      {scanResult.source === 'combined' && <span className="font-semibold text-primary">Multi-Source Enriched (QR + Manufacturer + DB)</span>}
                      {scanResult.source === 'ocr' && <span className="font-semibold text-sky-600 dark:text-sky-400">Product Label OCR (ML Kit)</span>}
                      {scanResult.source === 'barcode' && <span className="font-semibold text-primary">Standard Barcode</span>}
                    </DialogDescription>
                  </div>
                </div>

                {isEnrichingUrl && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enriching from manufacturer...
                  </div>
                )}
              </div>
            </DialogHeader>

            {/* Conflicts Alert if any */}
            {scanResult.conflicts && scanResult.conflicts.length > 0 && (
              <div className="my-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                  <AlertTriangle className="h-4 w-4" /> Conflicting product information detected ({scanResult.conflicts.length})
                </div>
                {scanResult.conflicts.map((conflict, idx) => (
                  <div key={idx} className="bg-background/80 p-2.5 rounded-lg text-xs space-y-1.5 border border-amber-500/20">
                    <div className="font-semibold text-foreground">{conflict.label}:</div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-muted p-1.5 rounded">
                        <span className="text-muted-foreground uppercase text-[9px] font-bold">[{conflict.sourceA}]</span>
                        <div className="font-mono font-bold text-foreground">{String(conflict.valueA)}</div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveConflictItem(conflict, true)}
                          className="h-6 text-[10px] mt-1 w-full"
                        >
                          Use {conflict.sourceA.toUpperCase()}
                        </Button>
                      </div>
                      <div className="bg-muted p-1.5 rounded">
                        <span className="text-muted-foreground uppercase text-[9px] font-bold">[{conflict.sourceB}]</span>
                        <div className="font-mono font-bold text-foreground">{String(conflict.valueB)}</div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveConflictItem(conflict, false)}
                          className="h-6 text-[10px] mt-1 w-full"
                        >
                          Use {conflict.sourceB.toUpperCase()}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Detected Details Grid */}
            <div className="my-3 p-4 rounded-xl bg-muted/40 border border-border space-y-3 text-sm">
              {/* Product Identity */}
              {scanResult.productName ? (
                <div className="flex justify-between items-start border-b border-border/50 pb-2">
                  <span className="text-xs font-semibold text-muted-foreground">Product Name:</span>
                  <div className="text-right">
                    <span className="font-bold text-foreground">{scanResult.productName}</span>
                    {renderSourceBadge(scanResult.fieldSources?.['productName'])}
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center border-b border-border/50 pb-2 text-xs text-muted-foreground">
                  <span>Product Name:</span>
                  <span className="italic text-amber-500">Not detected in QR/Barcode</span>
                </div>
              )}

              {/* Manufacturer / Brand */}
              {(scanResult.manufacturer || scanResult.brand) && (
                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                  <span className="text-xs font-semibold text-muted-foreground">Manufacturer:</span>
                  <div className="text-right">
                    <span className="font-semibold text-foreground">{scanResult.manufacturer || scanResult.brand}</span>
                    {renderSourceBadge(scanResult.fieldSources?.['manufacturer'] || scanResult.fieldSources?.['brand'])}
                  </div>
                </div>
              )}

              {/* Composition */}
              {scanResult.composition && (
                <div className="flex justify-between items-start border-b border-border/50 pb-2">
                  <span className="text-xs font-semibold text-muted-foreground">Composition:</span>
                  <div className="text-right max-w-[65%]">
                    <span className="font-medium text-xs text-foreground">{scanResult.composition}</span>
                    {scanResult.formulation && (
                      <span className="ml-1 text-[10px] font-bold text-primary">({scanResult.formulation})</span>
                    )}
                    {renderSourceBadge(scanResult.fieldSources?.['composition'])}
                  </div>
                </div>
              )}

              {/* Pack Size */}
              {(scanResult.packSize || scanResult.size) && (
                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                  <span className="text-xs font-semibold text-muted-foreground">Pack Size:</span>
                  <div>
                    <span className="font-bold text-foreground">{scanResult.packSize || scanResult.size}</span>
                    {renderSourceBadge(scanResult.fieldSources?.['packSize'])}
                  </div>
                </div>
              )}

              {/* Barcode / GTIN */}
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="text-xs font-semibold text-muted-foreground">GTIN / Barcode:</span>
                <div>
                  <span className="font-mono font-bold text-foreground">{scanResult.gtin || scanResult.barcode || scanResult.rawValue}</span>
                  {renderSourceBadge(scanResult.fieldSources?.['gtin'] || scanResult.fieldSources?.['barcode'])}
                </div>
              </div>

              {/* Traceability: Batch, Serial, Mfg Date, Expiry */}
              {(scanResult.batchNumber || scanResult.serialNumber || scanResult.manufacturingDate || scanResult.expiryDate) && (
                <div className="border-b border-border/50 pb-2 space-y-1.5">
                  {scanResult.batchNumber && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-muted-foreground">Batch No:</span>
                      <div>
                        <span className="font-mono font-bold text-primary">{scanResult.batchNumber}</span>
                        {renderSourceBadge(scanResult.fieldSources?.['batchNumber'])}
                      </div>
                    </div>
                  )}

                  {scanResult.serialNumber && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-muted-foreground">Serial No (AI 21):</span>
                      <div>
                        <span className="font-mono text-xs font-semibold text-foreground">{scanResult.serialNumber}</span>
                        {renderSourceBadge(scanResult.fieldSources?.['serialNumber'])}
                      </div>
                    </div>
                  )}

                  {scanResult.manufacturingDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-muted-foreground">Mfg Date:</span>
                      <div>
                        <span className="font-mono text-xs font-semibold text-foreground">{scanResult.manufacturingDate}</span>
                        {renderSourceBadge(scanResult.fieldSources?.['manufacturingDate'])}
                      </div>
                    </div>
                  )}

                  {scanResult.expiryDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-muted-foreground">Expiry Date:</span>
                      <div>
                        <span className="font-mono font-bold text-foreground">{scanResult.expiryDate}</span>
                        {renderSourceBadge(scanResult.fieldSources?.['expiryDate'])}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Commercial: MRP & Unit Sale Price */}
              {(scanResult.mrp !== undefined || scanResult.unitSalePrice !== undefined) && (
                <div className="flex justify-between items-center border-b border-border/50 pb-2">
                  <span className="text-xs font-semibold text-muted-foreground">MRP / Unit Price:</span>
                  <div>
                    {scanResult.mrp !== undefined && (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{scanResult.mrp.toFixed(2)}</span>
                    )}
                    {scanResult.unitSalePrice !== undefined && (
                      <span className="text-xs text-muted-foreground ml-1.5">(₹{scanResult.unitSalePrice}/unit)</span>
                    )}
                    {renderSourceBadge(scanResult.fieldSources?.['mrp'])}
                  </div>
                </div>
              )}

              {/* Regulatory: HSN / GST */}
              {(scanResult.hsnCode || scanResult.gstRate !== undefined) && (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-muted-foreground">HSN / GST:</span>
                  <span className="font-semibold text-foreground">
                    {scanResult.hsnCode ? `HSN ${scanResult.hsnCode}` : '—'} / {scanResult.gstRate !== undefined ? `${scanResult.gstRate}%` : '—'}
                  </span>
                </div>
              )}
            </div>

            {/* Missing Product Details Notice */}
            {missingImportantFields.length > 0 && (
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-1 text-xs">
                <div className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Missing Details: {missingImportantFields.join(', ')}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  You can scan the printed label via OCR below or type values directly in the product form.
                </p>
              </div>
            )}

            {/* OCR Camera Action Section (Fallback) */}
            <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl space-y-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Camera className="h-4 w-4 text-primary" /> Scan Product Label (OCR Fallback)
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Capture printed package text for missing MRP, Pack Size, or Composition.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleOpenEmbeddedOcrPreview}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5 text-xs h-9 shadow-sm"
                >
                  <Camera className="h-4 w-4" />
                  Open OCR Camera
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMode('ocr_manual_fallback')}
                  className="text-xs h-9 font-semibold text-muted-foreground hover:text-foreground"
                >
                  Manual Text
                </Button>
              </div>
            </div>

            <DialogFooter className="grid grid-cols-2 gap-3 sm:gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleScanAgain}
                className="w-full font-semibold gap-1.5"
              >
                <RotateCcw className="h-4 w-4" /> Scan Again
              </Button>
              <Button
                type="button"
                onClick={handleApply}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4" /> {
                  (scanResult.source === 'gs1' ||
                   scanResult.source === 'structured_qr' ||
                   scanResult.source === 'manufacturer_url' ||
                   scanResult.source === 'combined' ||
                   scanResult.source === 'ocr' ||
                   scanResult.existingProductFound ||
                   Boolean(scanResult.productName || scanResult.batchNumber || scanResult.expiryDate))
                    ? 'Use Detected Data'
                    : 'Use Barcode'
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─────────────────────────────────────────────────────────
          4. MANUAL TEXT FALLBACK MODAL
      ───────────────────────────────────────────────────────── */}
      {mode === 'ocr_manual_fallback' && (
        <Dialog open={true} onOpenChange={(open) => !open && (scanResult ? setMode('summary') : onClose())}>
          <DialogContent className="sm:max-w-md border-border bg-card text-card-foreground p-6 rounded-2xl shadow-2xl">
            <DialogHeader className="space-y-2 text-left">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground">Manual Label Text Entry</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Optional text fallback to paste or type package text for parsing.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="my-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ocr_manual_input" className="text-xs font-bold text-foreground">
                  Product Label Text
                </Label>
                <Textarea
                  id="ocr_manual_input"
                  placeholder="e.g. Evicent&#10;Emamectin benzoate 5% w/w + Lufenuron 40% w/w WG&#10;60 g&#10;Maximum Retail Price Rs. 1569.00&#10;Batch No. SPL6A20014"
                  value={ocrRawInput}
                  onChange={(e) => setOcrRawInput(e.target.value)}
                  className="min-h-[120px] text-xs font-mono"
                  autoFocus
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => (scanResult ? setMode('summary') : onClose())}
                className="font-semibold"
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleApplyManualOcrText}
                disabled={!ocrRawInput.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5"
              >
                <Sparkles className="h-4 w-4" /> Parse Text
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─────────────────────────────────────────────────────────
          5. PERMISSION DENIED MODAL
      ───────────────────────────────────────────────────────── */}
      {mode === 'permission_denied' && (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
          <DialogContent className="sm:max-w-md border-border bg-card text-card-foreground p-6 rounded-2xl shadow-2xl">
            <DialogHeader className="space-y-2 text-left">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center font-bold shrink-0">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground">Camera Permission Required</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Camera permission is required to scan products in KRUSHI OS.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="my-4 p-4 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-2">
              <p>Camera access was disabled or permanently denied on this device.</p>
              <p>To enable scanning, please tap the button below to open App Settings and grant Camera permission.</p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={onClose} className="font-semibold">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  await openCameraSettings();
                  onClose();
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5"
              >
                <ExternalLink className="h-4 w-4" /> Open App Settings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ─────────────────────────────────────────────────────────
          6. WEB / DESKTOP FALLBACK & TEST SCANNER MODAL
      ───────────────────────────────────────────────────────── */}
      {mode === 'web_fallback' && (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
          <DialogContent className="sm:max-w-md border-border bg-card text-card-foreground p-6 rounded-2xl shadow-2xl">
            <DialogHeader className="space-y-2 text-left">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground">Product Scanner</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Native camera scanner is optimized for the KRUSHI OS Android App.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="my-3 space-y-4">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">Live Camera Scanning on Android:</p>
                Product barcode and label OCR scanning with camera autofocus is available when using the KRUSHI OS Android application.
              </div>

              {/* Manual Barcode / GS1 / QR Test Input for Web & Development */}
              <div className="space-y-2 pt-1">
                <Label htmlFor="manual_scan_input" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Scan className="h-3.5 w-3.5 text-primary" /> Test Barcode / GS1 / QR Input
                </Label>
                <Input
                  id="manual_scan_input"
                  placeholder="e.g. https://syngenta.co.in/gpd/01/08904232801980/10/SPL6A20014..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="h-10 text-xs font-mono"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Paste or type any Syngenta GS1 URL, standard GS1 string, EAN-13, or QR payload.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={onClose} className="font-semibold">
                Close
              </Button>
              <Button
                type="button"
                onClick={handleManualTestScan}
                disabled={isProcessing || !manualInput.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Parse & Match
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
