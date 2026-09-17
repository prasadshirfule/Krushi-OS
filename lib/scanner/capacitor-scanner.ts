import { BarcodeFormat, BarcodeScanner, LensFacing } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import { ProductScanResult } from './types';
import { parseScannedBarcode } from './barcode-parser';
import { matchScannedProduct } from './product-matcher';

export interface ScannerControllerOptions {
  onScanResult: (result: ProductScanResult) => void;
  onError: (error: string) => void;
  onPermissionDenied?: () => void;
}

/**
 * Checks whether native ML Kit barcode scanning is supported on this platform.
 */
export async function isNativeScannerSupported(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  try {
    const { supported } = await BarcodeScanner.isSupported();
    return Boolean(supported);
  } catch {
    return false;
  }
}

/**
 * Checks and requests camera permissions.
 */
export async function ensureCameraPermission(): Promise<{ granted: boolean; deniedPermanently?: boolean }> {
  if (!Capacitor.isNativePlatform()) {
    return { granted: false };
  }

  try {
    const status = await BarcodeScanner.checkPermissions();

    if (status.camera === 'granted') {
      return { granted: true };
    }

    if (status.camera === 'denied') {
      // Permission denied
      return { granted: false, deniedPermanently: true };
    }

    const requestStatus = await BarcodeScanner.requestPermissions();
    if (requestStatus.camera === 'granted') {
      return { granted: true };
    }

    return { granted: false, deniedPermanently: requestStatus.camera === 'denied' };
  } catch (err: any) {
    console.error('Failed to request camera permission:', err);
    return { granted: false };
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
 * Native Camera Scanner Session Manager
 */
export class NativeBarcodeScannerSession {
  private isScanning = false;
  private isTorchOn = false;
  private listenerHandle: any = null;
  private options: ScannerControllerOptions;

  constructor(options: ScannerControllerOptions) {
    this.options = options;
  }

  /**
   * Starts native camera preview and ML Kit barcode detection with custom UI.
   */
  async start(): Promise<boolean> {
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
      // Make webview body transparent for camera preview underneath
      document.body.classList.add('barcode-scanner-active');
      document.documentElement.classList.add('barcode-scanner-active');

      // Add listener for detected barcodes (ML Kit 8.x uses 'barcodesScanned' with array)
      this.listenerHandle = await BarcodeScanner.addListener('barcodesScanned', async (event) => {
        if (!this.isScanning || !event.barcodes || event.barcodes.length === 0) return;

        const firstBarcode = event.barcodes[0];
        const rawValue = firstBarcode.rawValue || firstBarcode.displayValue || '';
        const format = String(firstBarcode.format || 'UNKNOWN');

        if (!rawValue) return;

        console.log('[SCANNER RUNTIME] QR detected by ML Kit:', { rawValue, format });

        // Stop scanning and remove transparent overlay immediately
        await this.stop();

        try {
          const parsed = parseScannedBarcode(rawValue, format);
          console.log('[SCANNER RUNTIME] Local parse complete:', parsed);
          this.options.onScanResult(parsed);
        } catch (parseErr: any) {
          console.error('[SCANNER RUNTIME] Error parsing scanned barcode:', parseErr);
          this.options.onError('Failed to parse scanned barcode data.');
        }
      });

      // Start custom scan with rear camera and prioritized product formats
      this.isScanning = true;
      await BarcodeScanner.startScan({
        lensFacing: LensFacing.Back,
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

      return true;
    } catch (err: any) {
      console.error('Failed to start barcode scan:', err);
      await this.stop();
      this.options.onError(err.message || 'Failed to initialize camera scanner.');
      return false;
    }
  }

  /**
   * Toggles flashlight/torch.
   */
  async toggleTorch(): Promise<boolean> {
    if (!this.isScanning) return false;
    try {
      await BarcodeScanner.toggleTorch();
      this.isTorchOn = !this.isTorchOn;
      return this.isTorchOn;
    } catch (err) {
      console.error('Torch not available:', err);
      return false;
    }
  }

  getTorchStatus(): boolean {
    return this.isTorchOn;
  }

  /**
   * Stops scanning and cleans up all listeners and transparent styling.
   */
  async stop(): Promise<void> {
    this.isScanning = false;
    this.isTorchOn = false;

    try {
      document.body.classList.remove('barcode-scanner-active');
      document.documentElement.classList.remove('barcode-scanner-active');
    } catch {}

    try {
      if (this.listenerHandle) {
        await this.listenerHandle.remove();
        this.listenerHandle = null;
      }
    } catch {}

    try {
      await BarcodeScanner.removeAllListeners();
      await BarcodeScanner.stopScan();
    } catch (err) {
      // Ignore cleanup error if already stopped
    }
  }
}
