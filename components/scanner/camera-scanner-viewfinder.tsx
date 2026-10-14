'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  UniversalScannerSession,
  checkCameraSupport,
  getAvailableVideoDevices,
  openCameraSettings,
} from '@/lib/scanner/universal-camera';
import { ProductScanResult } from '@/lib/scanner/types';
import { VideoDeviceOption } from '@/lib/scanner/web-barcode-scanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Flashlight,
  FlashlightOff,
  SwitchCamera,
  Smartphone,
  ShieldAlert,
  Loader2,
  Scan,
  RefreshCw,
  Keyboard,
  X,
  Camera,
} from 'lucide-react';
import { toast } from 'sonner';

interface CameraScannerViewfinderProps {
  onScanSuccess: (result: ProductScanResult) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  viewfinderId?: string;
  allowManualEntry?: boolean;
  manualPlaceholder?: string;
  onManualSubmit?: (value: string) => void;
}

export function CameraScannerViewfinder({
  onScanSuccess,
  onClose,
  title = 'Scan QR / Barcode',
  subtitle = 'Point camera at product barcode or QR code',
  viewfinderId = 'krushi-camera-viewfinder',
  allowManualEntry = true,
  manualPlaceholder = 'e.g. 08904232801980 or paste code...',
  onManualSubmit,
}: CameraScannerViewfinderProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<UniversalScannerSession | null>(null);
  const scanLockedRef = useRef(false);

  const [mode, setMode] = useState<'initializing' | 'scanning' | 'permission_denied' | 'insecure_context' | 'manual_fallback'>('initializing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [cameras, setCameras] = useState<VideoDeviceOption[]>([]);
  const [currentCameraIdx, setCurrentCameraIdx] = useState(0);
  const [manualInput, setManualInput] = useState('');
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function initScanner() {
      scanLockedRef.current = false;
      const status = await checkCameraSupport();

      if (!isMounted) return;
      setIsNative(status.isNative);

      if (!status.isSecureContext) {
        setErrorMessage(status.errorMessage || 'Camera requires HTTPS or localhost.');
        setMode('insecure_context');
        return;
      }

      if (!status.supported && !status.isNative) {
        setErrorMessage(status.errorMessage || 'Camera access is not available on this browser.');
        setMode('manual_fallback');
        return;
      }

      setMode('scanning');

      // Initialize Universal Scanner
      const session = new UniversalScannerSession({
        onScanResult: (result) => {
          if (scanLockedRef.current) return;
          scanLockedRef.current = true;

          // Haptic feedback if supported
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate(80); } catch {}
          }

          cleanup();
          onScanSuccess(result);
        },
        onError: (err) => {
          if (!isMounted) return;
          console.warn('[CAMERA SCANNER] Error:', err);
          setErrorMessage(err);
        },
        onPermissionDenied: () => {
          if (!isMounted) return;
          setMode('permission_denied');
        },
        onCamerasFound: (foundCameras) => {
          if (!isMounted) return;
          setCameras(foundCameras);
        },
      });

      sessionRef.current = session;

      // Allow DOM to settle before mounting video or capacitor box
      await new Promise((r) => setTimeout(r, 80));
      if (!isMounted) return;

      const videoEl = videoRef.current;
      const viewfinderEl = document.getElementById(viewfinderId);
      let boxRect: any = undefined;

      if (viewfinderEl) {
        const rect = viewfinderEl.getBoundingClientRect();
        boxRect = {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          parentId: viewfinderId,
        };
      }

      await session.start({
        videoElement: videoEl,
        box: boxRect,
        facingMode: 'environment',
      });
    }

    initScanner();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [viewfinderId]);

  const cleanup = () => {
    if (sessionRef.current) {
      sessionRef.current.stop();
      sessionRef.current = null;
    }
    setIsTorchOn(false);
  };

  const handleToggleTorch = async () => {
    if (sessionRef.current) {
      const active = await sessionRef.current.toggleTorch();
      setIsTorchOn(active);
    }
  };

  const handleSwitchCamera = async () => {
    if (!sessionRef.current) return;
    if (cameras.length > 1) {
      const nextIdx = (currentCameraIdx + 1) % cameras.length;
      setCurrentCameraIdx(nextIdx);
      const nextCam = cameras[nextIdx];
      await sessionRef.current.switchCamera(nextCam.deviceId);
      toast.info(`Switched to: ${nextCam.label}`);
    } else {
      await sessionRef.current.switchCamera();
      toast.info('Switched camera');
    }
  };

  const handleManualFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualInput.trim();
    if (!clean) return;

    if (onManualSubmit) {
      onManualSubmit(clean);
    } else {
      onScanSuccess({
        rawValue: clean,
        format: 'MANUAL_ENTRY',
        barcode: clean,
        source: 'barcode',
        detectedFields: ['barcode'],
      });
    }
  };

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* ─── SCANNING MODE ─── */}
      {mode === 'scanning' && (
        <div className="space-y-3">
          {/* Camera Viewport Container */}
          <div
            id={viewfinderId}
            className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black/95 flex items-center justify-center border-2 border-primary/50 shadow-2xl"
          >
            {/* HTML5 Video Preview for Web & Mobile Browsers */}
            {!isNative && (
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* Target Reticle Overlay */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
              <div className="relative w-56 sm:w-64 h-36 sm:h-40 border-2 border-dashed border-primary/70 rounded-xl bg-primary/5 shadow-inner flex items-center justify-center">
                {/* 4 Corner Markers */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-primary rounded-tl-sm" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-primary rounded-tr-sm" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-primary rounded-bl-sm" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-primary rounded-br-sm" />

                {/* Animated Horizontal Laser Scanline */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_rgba(34,197,94,0.9)] animate-pulse" />
              </div>

              {/* Status Indicator */}
              <div className="mt-3 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-white/90 text-xs font-semibold flex items-center gap-1.5 shadow-md">
                <Scan className="h-3.5 w-3.5 text-primary animate-spin" style={{ animationDuration: '3s' }} />
                <span>Align barcode or QR inside frame</span>
              </div>
            </div>

            {/* Floating Top Bar for Camera Controls */}
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-20">
              {cameras.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleSwitchCamera}
                  className="h-8 w-8 rounded-full bg-black/60 border-white/20 text-white hover:bg-black/90 hover:text-white backdrop-blur-sm"
                  title="Switch camera"
                >
                  <SwitchCamera className="h-4 w-4" />
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleToggleTorch}
                className="h-8 w-8 rounded-full bg-black/60 border-white/20 text-white hover:bg-black/90 hover:text-white backdrop-blur-sm"
                title="Toggle flashlight"
              >
                {isTorchOn ? (
                  <FlashlightOff className="h-4 w-4 text-amber-400" />
                ) : (
                  <Flashlight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleToggleTorch}
                className="h-8 px-3 rounded-lg text-xs font-semibold gap-1.5"
              >
                {isTorchOn ? <FlashlightOff className="h-3.5 w-3.5 text-amber-500" /> : <Flashlight className="h-3.5 w-3.5" />}
                <span>{isTorchOn ? 'Flash Off' : 'Flashlight'}</span>
              </Button>

              {cameras.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSwitchCamera}
                  className="h-8 px-3 rounded-lg text-xs font-semibold gap-1.5"
                >
                  <SwitchCamera className="h-3.5 w-3.5" />
                  <span>Switch Cam</span>
                </Button>
              )}
            </div>

            {allowManualEntry && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMode('manual_fallback')}
                className="h-8 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5"
              >
                <Keyboard className="h-3.5 w-3.5" />
                <span>Type manually</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ─── INITIALIZING MODE ─── */}
      {mode === 'initializing' && (
        <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-xs font-medium text-muted-foreground">Starting camera scanner...</p>
        </div>
      )}

      {/* ─── PERMISSION DENIED MODE ─── */}
      {mode === 'permission_denied' && (
        <div className="py-6 px-4 rounded-xl border border-destructive/20 bg-destructive/5 text-center space-y-3">
          <div className="h-12 w-12 mx-auto rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <Smartphone className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">Camera Permission Required</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Please allow camera access in your browser or device settings to scan product packaging, barcodes, and QR codes.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                cleanup();
                setMode('scanning');
              }}
              className="gap-1.5 text-xs font-bold"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Try Again</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMode('manual_fallback')}
              className="text-xs"
            >
              Use Manual Entry
            </Button>
          </div>
        </div>
      )}

      {/* ─── INSECURE CONTEXT MODE (HTTP) ─── */}
      {mode === 'insecure_context' && (
        <div className="py-6 px-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-center space-y-3">
          <div className="h-12 w-12 mx-auto rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">HTTPS Connection Required</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Web browsers require a secure HTTPS connection or localhost to access cameras. The deployed Vercel application provides HTTPS.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setMode('manual_fallback')}
            className="text-xs font-bold"
          >
            Switch to Manual Identifier Entry
          </Button>
        </div>
      )}

      {/* ─── MANUAL ENTRY FALLBACK ─── */}
      {mode === 'manual_fallback' && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Manual Barcode / Identifier Entry
              </h4>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode('scanning')}
              className="h-7 px-2 text-xs text-primary font-bold gap-1"
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Back to Camera</span>
            </Button>
          </div>

          <form onSubmit={handleManualFormSubmit} className="space-y-3">
            <Input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder={manualPlaceholder}
              autoFocus
              className="font-mono text-sm h-11 bg-background"
            />
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!manualInput.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-4"
              >
                Submit Code
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
