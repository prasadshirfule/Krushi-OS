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
export interface ProcessedImageResult {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Loads an image from a native local path or data URL into an HTMLImageElement
 * and measures its true dimensions.
 */
export async function loadImageElement(imagePath: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      return reject(new Error('DOM not available'));
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Failed to load image into DOM: ' + String(err)));
    const src = imagePath.startsWith('data:')
      ? imagePath
      : (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()
          ? Capacitor.convertFileSrc(imagePath)
          : imagePath);
    img.src = src;
  });
}

/**
 * Crops the central region of the image (viewfinder target area) and upscales by scaleFactor.
 * Optionally applies contrast and grayscale filters for difficult / dense 2D codes.
 */
export function processImageRegion(
  img: HTMLImageElement,
  options: {
    cropRatio?: number;
    scaleFactor?: number;
    enhanceContrast?: boolean;
  }
): ProcessedImageResult {
  const cropRatio = options.cropRatio ?? 0.65;
  const scale = options.scaleFactor ?? 2;

  const originalWidth = img.naturalWidth || img.width || 640;
  const originalHeight = img.naturalHeight || img.height || 480;

  // Calculate center crop bounding box
  const cropWidth = Math.max(32, Math.round(originalWidth * cropRatio));
  const cropHeight = Math.max(32, Math.round(originalHeight * cropRatio));
  const cropX = Math.max(0, Math.round((originalWidth - cropWidth) / 2));
  const cropY = Math.max(0, Math.round((originalHeight - cropHeight) / 2));

  const targetWidth = Math.round(cropWidth * scale);
  const targetHeight = Math.round(cropHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  // High-quality interpolation for dense 2D codes
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (options.enhanceContrast) {
    ctx.filter = 'grayscale(100%) contrast(160%) brightness(105%)';
  }

  ctx.drawImage(
    img,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    targetWidth,
    targetHeight
  );

  if (options.enhanceContrast) {
    try {
      const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const boosted = avg > 128 ? Math.min(255, avg * 1.25) : Math.max(0, avg * 0.75);
        data[i] = boosted;
        data[i + 1] = boosted;
        data[i + 2] = boosted;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {}
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.95),
    width: targetWidth,
    height: targetHeight,
  };
}

export class NativeBarcodeScannerSession {
  private isScanning = false;
  private isLocked = false;
  private isStopping = false;
  private isLoopRunning = false;
  private isDecodeInProgress = false;
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

  isDecodeInProgressStatus(): boolean {
    return this.isDecodeInProgress;
  }

  /**
   * Starts bounded native camera preview at exact coordinates.
   */
  async start(box?: EmbeddedScannerBoxRect): Promise<boolean> {
    // Reset all internal state flags cleanly for this session
    this.isLocked = false;
    this.isStopping = false;
    this.isScanning = false;
    this.isDecodeInProgress = false;

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
      // Clean up any stale active session / camera first
      if (activeSession && activeSession !== this) {
        try {
          await activeSession.stop();
        } catch {}
      }
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

      // Start controlled, strictly sequential frame analysis loop
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
   * Controlled strictly sequential frame capture and ML Kit barcode decoding loop.
   * Runs Attempt 1 (full frame) -> Attempt 2 (cropped + 2x upscaled) -> Attempt 3 (enhanced contrast).
   * Stops immediately on any valid barcode detection.
   */
  private async startCaptureLoop(): Promise<void> {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;

    // Dedicated camera warm-up period after start so autofocus & auto-exposure settle
    console.log('[KRUSHI SCANNER] CAMERA_WARMUP_START (400ms)');
    await new Promise((r) => setTimeout(r, 400));
    console.log('[KRUSHI SCANNER] CAMERA_WARMUP_COMPLETE');

    let frameCount = 0;
    const MLKIT_FORMATS = [
      BarcodeFormat.QrCode,
      BarcodeFormat.DataMatrix,
      BarcodeFormat.Aztec,
      BarcodeFormat.Pdf417,
      BarcodeFormat.Ean13,
      BarcodeFormat.Ean8,
      BarcodeFormat.UpcA,
      BarcodeFormat.UpcE,
      BarcodeFormat.Code128,
      BarcodeFormat.Code39,
      BarcodeFormat.Code93,
      BarcodeFormat.Codabar,
      BarcodeFormat.Itf,
    ];

    while (this.isScanning && !this.isLocked && !this.isStopping) {
      // 1. Guard against overlapping decodes
      if (this.isDecodeInProgress) {
        console.log(`[KRUSHI SCANNER] FRAME_SKIPPED: Previous decode still in progress (Frame #${frameCount})`);
        await new Promise((r) => setTimeout(r, 100));
        continue;
      }

      frameCount++;
      const captureStartTime = Date.now();

      try {
        if (!Capacitor.isNativePlatform()) {
          // Web environment: wait and continue
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }

        // 2. Capture single frame synchronously
        const captureResult = await CameraPreview.capture({ quality: 85 });
        const captureDuration = Date.now() - captureStartTime;

        if (!this.isScanning || this.isLocked || this.isStopping) break;

        const rawPath = captureResult?.value;
        console.log(`[KRUSHI SCANNER] IMAGE_CAPTURED (Frame #${frameCount})`, {
          hasPath: Boolean(rawPath),
          captureDurationMs: captureDuration,
          pathSnippet: rawPath ? (rawPath.length > 60 ? '...' + rawPath.slice(-45) : rawPath) : 'NONE',
        });

        if (rawPath) {
          const imagePath = rawPath.startsWith('file://')
            ? rawPath
            : rawPath.startsWith('/')
            ? `file://${rawPath}`
            : rawPath;

          this.isDecodeInProgress = true;

          try {
            // ─── ATTEMPT 1: Normal full frame decode ───
            console.log(`[KRUSHI SCANNER] BARCODE_DECODE_ATTEMPT (Frame #${frameCount})`, {
              attempt: '1_NORMAL_FULL_FRAME',
              imagePathSnippet: imagePath.length > 60 ? '...' + imagePath.slice(-45) : imagePath,
              formatsCount: MLKIT_FORMATS.length,
            });

            const t1 = Date.now();
            const decodeRes1 = await BarcodeScanner.readBarcodesFromImage({
              path: imagePath,
              formats: MLKIT_FORMATS,
            });
            const dur1 = Date.now() - t1;
            const count1 = decodeRes1?.barcodes?.length || 0;

            console.log(`[KRUSHI SCANNER] NORMAL_DECODE_RESULT (Frame #${frameCount})`, {
              count: count1,
              durationMs: dur1,
            });

            let acceptedDecodeRes = count1 > 0 ? decodeRes1 : null;

            // Load image element to inspect actual captured dimensions & prepare fallback crops if needed
            let loadedImg: HTMLImageElement | null = null;
            if (typeof document !== 'undefined') {
              try {
                loadedImg = await loadImageElement(imagePath);
                console.log(`[KRUSHI SCANNER] IMAGE_DIMENSIONS (Frame #${frameCount})`, {
                  width: loadedImg.naturalWidth || loadedImg.width,
                  height: loadedImg.naturalHeight || loadedImg.height,
                });
              } catch (imgErr: any) {
                console.warn(`[KRUSHI SCANNER] IMAGE_DIMENSIONS_MEASURE_FAILED (Frame #${frameCount}):`, imgErr?.message || imgErr);
              }
            }

            // ─── ATTEMPT 2: Cropped Central Scan Region + 2x Upscale ───
            if (!acceptedDecodeRes && loadedImg && this.isScanning && !this.isLocked) {
              try {
                const cropped = processImageRegion(loadedImg, {
                  cropRatio: 0.65,
                  scaleFactor: 2,
                  enhanceContrast: false,
                });

                console.log(`[KRUSHI SCANNER] CROP_DECODE_ATTEMPT (Frame #${frameCount})`, {
                  attempt: '2_CROP_UPSCALE_2X',
                  targetDimensions: `${cropped.width}x${cropped.height}`,
                });
                console.log(`[KRUSHI SCANNER] UPSCALE_DECODE_ATTEMPT (Frame #${frameCount})`, {
                  scaleFactor: 2,
                });

                const t2 = Date.now();
                const decodeRes2 = await BarcodeScanner.readBarcodesFromImage({
                  path: cropped.dataUrl,
                  formats: MLKIT_FORMATS,
                });
                const dur2 = Date.now() - t2;
                const count2 = decodeRes2?.barcodes?.length || 0;

                console.log(`[KRUSHI SCANNER] CROP_DECODE_RESULT (Frame #${frameCount})`, {
                  count: count2,
                  durationMs: dur2,
                });

                if (count2 > 0) {
                  acceptedDecodeRes = decodeRes2;
                }
              } catch (cropErr: any) {
                console.warn(`[KRUSHI SCANNER] CROP_DECODE_ERROR (Frame #${frameCount}):`, cropErr?.message || cropErr);
              }
            }

            // ─── ATTEMPT 3: Grayscale / High-Contrast Enhanced Cropped Region ───
            if (!acceptedDecodeRes && loadedImg && this.isScanning && !this.isLocked) {
              try {
                const enhanced = processImageRegion(loadedImg, {
                  cropRatio: 0.65,
                  scaleFactor: 2,
                  enhanceContrast: true,
                });

                console.log(`[KRUSHI SCANNER] ENHANCED_DECODE_ATTEMPT (Frame #${frameCount})`, {
                  attempt: '3_CROP_ENHANCED_CONTRAST_2X',
                  targetDimensions: `${enhanced.width}x${enhanced.height}`,
                });

                const t3 = Date.now();
                const decodeRes3 = await BarcodeScanner.readBarcodesFromImage({
                  path: enhanced.dataUrl,
                  formats: MLKIT_FORMATS,
                });
                const dur3 = Date.now() - t3;
                const count3 = decodeRes3?.barcodes?.length || 0;

                console.log(`[KRUSHI SCANNER] ENHANCED_DECODE_RESULT (Frame #${frameCount})`, {
                  count: count3,
                  durationMs: dur3,
                });

                if (count3 > 0) {
                  acceptedDecodeRes = decodeRes3;
                }
              } catch (enhanceErr: any) {
                console.warn(`[KRUSHI SCANNER] ENHANCED_DECODE_ERROR (Frame #${frameCount}):`, enhanceErr?.message || enhanceErr);
              }
            }

            // ─── PROCESS FINAL RESULT ───
            const barcodeCount = acceptedDecodeRes?.barcodes ? acceptedDecodeRes.barcodes.length : 0;

            if (barcodeCount > 0 && acceptedDecodeRes) {
              const detectedFormats = acceptedDecodeRes.barcodes.map((b) => b.format);
              console.log(`[KRUSHI SCANNER] BARCODE_DETECTED (Frame #${frameCount})`, {
                count: barcodeCount,
                formats: detectedFormats,
              });

              const first = acceptedDecodeRes.barcodes[0];
              const rawValue = (first.rawValue || first.displayValue || '').trim();
              const format = String(first.format || 'UNKNOWN');

              if (rawValue && !this.isLocked && this.isScanning) {
                // Synchronously lock immediately on first valid scan
                this.isLocked = true;
                console.log(`[KRUSHI SCANNER] RAW_VALUE_RECEIVED (Frame #${frameCount})`, {
                  format,
                  rawValueLength: rawValue.length,
                  sample: rawValue.length > 80 ? rawValue.slice(0, 80) + '...' : rawValue,
                });

                // Stop camera immediately
                console.log('[KRUSHI SCANNER] STOP');
                await this.stop();

                // Dispatch raw decoded value unconditionally (safe fallback parse)
                let parsed: ProductScanResult;
                try {
                  parsed = parseScannedBarcode(rawValue, format);
                } catch (parseErr) {
                  console.warn('[KRUSHI SCANNER] Optional barcode parse error, using raw fallback:', parseErr);
                  parsed = {
                    rawValue,
                    format,
                    source: 'unknown',
                  };
                }

                this.options.onScanResult(parsed);
                break;
              } else if (!rawValue) {
                console.warn(`[KRUSHI SCANNER] BARCODE_DETECTED BUT EMPTY RAW VALUE (Frame #${frameCount})`);
              }
            } else {
              console.log(`[KRUSHI SCANNER] NO_BARCODE_DETECTED (Frame #${frameCount})`);
            }
          } catch (decodeErr: any) {
            console.warn(`[KRUSHI SCANNER] BARCODE_DECODE_ERROR (Frame #${frameCount}):`, decodeErr?.message || decodeErr);
          } finally {
            this.isDecodeInProgress = false;
          }
        } else {
          console.warn(`[KRUSHI SCANNER] IMAGE_CAPTURED RETURNED EMPTY VALUE (Frame #${frameCount})`);
        }
      } catch (loopErr: any) {
        console.warn(`[KRUSHI SCANNER] FRAME_CAPTURE_ERROR (Frame #${frameCount}):`, loopErr?.message || loopErr);
      }

      // Brief sequential delay (180ms) to allow camera sensor auto-focus adjust and avoid CPU starvation
      if (this.isScanning && !this.isLocked && !this.isStopping) {
        await new Promise((r) => setTimeout(r, 180));
      }
    }

    this.isLoopRunning = false;
    this.isDecodeInProgress = false;
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
   * Stops scanning and releases native CameraPreview resources. Idempotent and resets state.
   */
  async stop(): Promise<void> {
    if (this.isStopping) return;
    this.isStopping = true;
    this.isScanning = false;
    this.isDecodeInProgress = false;
    this.isTorchOn = false;

    try {
      await CameraPreview.stop();
    } catch (err) {
      // Safe ignore
    } finally {
      this.isStopping = false;
      this.isLoopRunning = false;
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
