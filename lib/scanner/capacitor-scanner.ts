import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { CameraPreview, CameraPreviewOptions } from '@capacitor-community/camera-preview';
import { Capacitor } from '@capacitor/core';
import { ProductScanResult } from './types';
import { parseScannedBarcode } from './barcode-parser';

export interface ScannerControllerOptions {
  onScanResult: (result: ProductScanResult) => void;
  onError: (error: string) => void;
  onPermissionDenied?: () => void;
}

export interface EmbeddedScannerBoxRect {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  parentId?: string;
}

let activeSession: NativeBarcodeScannerSession | null = null;

/**
 * Checks whether native camera and barcode scanning are supported on this platform.
 */
export async function isNativeScannerSupported(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  return true;
}

/**
 * Checks and requests camera permissions.
 */
export async function ensureCameraPermission(): Promise<{ granted: boolean; deniedPermanently?: boolean }> {
  if (!Capacitor.isNativePlatform()) {
    return { granted: false };
  }

  try {
    const mlkitStatus = await BarcodeScanner.requestPermissions();
    if (mlkitStatus.camera === 'granted') {
      return { granted: true };
    }
    return { granted: false, deniedPermanently: mlkitStatus.camera === 'denied' };
  } catch {
    return { granted: true };
  }
}

/**
 * Opens device app settings (useful if permission was permanently denied).
 */
export async function openCameraSettings(): Promise<void> {
  try {
    await BarcodeScanner.openSettings();
  } catch (err) {
    console.error('Failed to open app settings:', err);
  }
}

/**
 * Native Embedded Camera Scanner Session Manager
 * Uses @capacitor-community/camera-preview for genuine bounded preview
 * and @capacitor-mlkit/barcode-scanning readBarcodesFromImage for on-device ML Kit decoding.
 */
export class NativeBarcodeScannerSession {
  private isScanning = false;
  private isLocked = false;
  private isStopping = false;
  private isLoopRunning = false;
  private isTorchOn = false;
  private options: ScannerControllerOptions;

  constructor(options: ScannerControllerOptions) {
    this.options = options;
  }

  /**
   * Atomically acquires scan lock. Returns true if acquired, false if already locked.
   */
  acquireLock(): boolean {
    if (this.isLocked) return false;
    this.isLocked = true;
    return true;
  }

  isLockedStatus(): boolean {
    return this.isLocked;
  }

  /**
   * Starts bounded native camera preview at exact coordinates.
   */
  async start(box?: EmbeddedScannerBoxRect): Promise<boolean> {
    this.isLocked = false;
    this.isStopping = false;

    console.log('[KRUSHI SCANNER] START');
    console.log('[KRUSHI SCANNER] CAMERA PATH: EMBEDDED_CAMERA_PREVIEW');

    const isSupported = await isNativeScannerSupported();
    if (!isSupported) {
      this.options.onError('Product scanning with live camera is available in the KRUSHI OS Android app.');
      return false;
    }

    const { granted, deniedPermanently } = await ensureCameraPermission();
    if (!granted) {
      if (this.options.onPermissionDenied) {
        this.options.onPermissionDenied();
      } else {
        this.options.onError(
          deniedPermanently
            ? 'Camera permission was denied. Please enable camera access in app settings.'
            : 'Camera permission is required to scan products.'
        );
      }
      return false;
    }

    try {
      // Clean up any stale camera session first
      try {
        await CameraPreview.stop();
      } catch {}

      if (Capacitor.isNativePlatform()) {
        const previewOptions: CameraPreviewOptions = {
          position: 'rear',
          toBack: false,
          storeToFile: true,
          disableAudio: true,
          enableOpacity: true,
          x: box?.x ? Math.max(0, Math.round(box.x)) : 0,
          y: box?.y ? Math.max(0, Math.round(box.y)) : 0,
          width: box?.width ? Math.round(box.width) : 0,
          height: box?.height ? Math.round(box.height) : 0,
        };

        await CameraPreview.start(previewOptions);
      } else {
        // Web fallback
        const previewOptions: CameraPreviewOptions = {
          position: 'rear',
          parent: box?.parentId || 'krushi-barcode-viewfinder',
          className: 'w-full h-full object-cover',
          toBack: false,
          disableAudio: true,
        };
        await CameraPreview.start(previewOptions);
      }

      this.isScanning = true;
      activeSession = this;

      // Start controlled frame analysis loop
      this.startCaptureLoop();
      return true;
    } catch (err: any) {
      console.error('[KRUSHI SCANNER] Failed to start embedded camera:', err);
      await this.stop();
      this.options.onError(err.message || 'Failed to start camera preview.');
      return false;
    }
  }

  /**
   * Controlled frame capture and ML Kit barcode decoding loop
   */
  private async startCaptureLoop(): Promise<void> {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;

    // Small delay for camera sensor to adjust auto-focus and auto-exposure
    await new Promise((r) => setTimeout(r, 300));

    while (this.isScanning && !this.isLocked && !this.isStopping) {
      try {
        if (!Capacitor.isNativePlatform()) {
          // Web environment: wait and continue
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }

        const captureResult = await CameraPreview.capture({ quality: 85 });
        if (!this.isScanning || this.isLocked || this.isStopping) break;

        const rawPath = captureResult?.value;
        if (rawPath) {
          const imagePath = rawPath.startsWith('file://')
            ? rawPath
            : rawPath.startsWith('/')
            ? `file://${rawPath}`
            : rawPath;

          const decodeRes = await BarcodeScanner.readBarcodesFromImage({
            path: imagePath,
            formats: [
              BarcodeFormat.QrCode,
              BarcodeFormat.DataMatrix,
              BarcodeFormat.Ean13,
              BarcodeFormat.Ean8,
              BarcodeFormat.UpcA,
              BarcodeFormat.UpcE,
              BarcodeFormat.Code128,
            ],
          });

          if (decodeRes.barcodes && decodeRes.barcodes.length > 0) {
            const first = decodeRes.barcodes[0];
            const rawValue = (first.rawValue || first.displayValue || '').trim();
            const format = String(first.format || 'UNKNOWN');

            if (rawValue && !this.isLocked && this.isScanning) {
              // 1. Synchronously lock IMMEDIATELY
              this.isLocked = true;
              console.log('[KRUSHI SCANNER] DETECTED', { format });
              console.log('[KRUSHI SCANNER] LOCKED');
              console.log('[KRUSHI SCANNER] RAW VALUE:', rawValue.slice(0, 80));

              // 2. Stop camera immediately
              console.log('[KRUSHI SCANNER] STOP');
              await this.stop();

              // 3. Dispatch to callback with locked value
              try {
                const parsed = parseScannedBarcode(rawValue, format);
                this.options.onScanResult(parsed);
              } catch (parseErr: any) {
                console.error('[KRUSHI SCANNER] Error parsing scanned barcode:', parseErr);
                this.options.onError('Failed to parse scanned barcode data.');
              }
              break;
            }
          }
        }
      } catch (loopErr) {
        // Transient capture failure: continue to next tick
      }

      // Controlled interval (220ms) to prevent UI thread starvation
      if (this.isScanning && !this.isLocked && !this.isStopping) {
        await new Promise((r) => setTimeout(r, 220));
      }
    }

    this.isLoopRunning = false;
  }

  /**
   * Toggles flashlight/torch.
   */
  async toggleTorch(): Promise<boolean> {
    if (!this.isScanning) return false;
    try {
      const nextMode = this.isTorchOn ? 'off' : 'torch';
      await CameraPreview.setFlashMode({ flashMode: nextMode });
      this.isTorchOn = !this.isTorchOn;
      return this.isTorchOn;
    } catch (err) {
      console.warn('[KRUSHI SCANNER] Torch not available:', err);
      return false;
    }
  }

  getTorchStatus(): boolean {
    return this.isTorchOn;
  }

  /**
   * Stops scanning and releases native CameraPreview resources. Idempotent.
   */
  async stop(): Promise<void> {
    if (this.isStopping) return;
    this.isStopping = true;
    this.isScanning = false;
    this.isTorchOn = false;

    try {
      await CameraPreview.stop();
    } catch (err) {
      // Safe ignore
    } finally {
      this.isStopping = false;
      if (activeSession === this) {
        activeSession = null;
      }
    }
  }
}

export async function stopEmbeddedBarcodeCamera(): Promise<void> {
  if (activeSession) {
    await activeSession.stop();
    activeSession = null;
  }
  try {
    await CameraPreview.stop();
  } catch {}
}

export async function toggleEmbeddedBarcodeTorch(currentState: boolean): Promise<boolean> {
  if (activeSession) {
    return await activeSession.toggleTorch();
  }
  return false;
}
