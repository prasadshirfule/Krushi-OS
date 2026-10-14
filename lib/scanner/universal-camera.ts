import { Capacitor } from '@capacitor/core';
import {
  NativeBarcodeScannerSession,
  EmbeddedScannerBoxRect,
  openCameraSettings as openNativeCameraSettings,
} from './capacitor-scanner';
import {
  WebBarcodeScannerSession,
  isWebCameraSupported,
  isSecureContextActive,
  getAvailableVideoDevices,
  VideoDeviceOption,
} from './web-barcode-scanner';
import { ProductScanResult } from './types';
import { parseScannedBarcode } from './barcode-parser';

export interface UniversalScannerOptions {
  onScanResult: (result: ProductScanResult) => void;
  onError: (error: string) => void;
  onPermissionDenied?: () => void;
  onCamerasFound?: (cameras: VideoDeviceOption[]) => void;
}

export interface UniversalScannerStartParams {
  videoElement?: HTMLVideoElement | null;
  box?: EmbeddedScannerBoxRect;
  deviceId?: string;
  facingMode?: 'environment' | 'user';
}

/**
 * Checks platform camera support and secure context requirements.
 */
export async function checkCameraSupport(): Promise<{
  supported: boolean;
  isNative: boolean;
  isWeb: boolean;
  isSecureContext: boolean;
  errorMessage?: string;
}> {
  const isNative = Capacitor.isNativePlatform();
  const isWeb = !isNative;
  const isSecure = isSecureContextActive();

  if (isNative) {
    return {
      supported: true,
      isNative: true,
      isWeb: false,
      isSecureContext: true,
    };
  }

  if (!isSecure) {
    return {
      supported: false,
      isNative: false,
      isWeb: true,
      isSecureContext: false,
      errorMessage: 'Camera access requires HTTPS or localhost.',
    };
  }

  const supported = isWebCameraSupported();
  return {
    supported,
    isNative: false,
    isWeb: true,
    isSecureContext: true,
    errorMessage: supported ? undefined : 'Camera access is not supported by this browser.',
  };
}

/**
 * Opens device or browser camera permission settings.
 */
export async function openCameraSettings(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await openNativeCameraSettings();
  } else {
    // In browsers, programmatic opening of permission settings is restricted by security models.
    // Display helpful instructions to user.
    if (typeof window !== 'undefined') {
      window.alert('To grant camera permission, click the lock or camera icon in your browser address bar.');
    }
  }
}

/**
 * Universal Unified Camera Barcode & QR Scanner Session
 * Automatically uses Google ML Kit CameraPreview on Android Capacitor
 * and navigator.mediaDevices + BarcodeDetector / ZXing in Desktop & Mobile Browsers.
 */
export class UniversalScannerSession {
  private nativeSession: NativeBarcodeScannerSession | null = null;
  private webSession: WebBarcodeScannerSession | null = null;
  private options: UniversalScannerOptions;
  private isScanning = false;
  private isLocked = false;
  private videoEl: HTMLVideoElement | null = null;

  constructor(options: UniversalScannerOptions) {
    this.options = options;
  }

  async start(params: UniversalScannerStartParams): Promise<boolean> {
    this.stop();
    this.isScanning = true;
    this.isLocked = false;

    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      console.log('[KRUSHI UNIVERSAL SCANNER] Starting NATIVE Capacitor camera session');
      this.nativeSession = new NativeBarcodeScannerSession({
        onScanResult: (result) => {
          if (this.isLocked || !this.isScanning) return;
          this.isLocked = true;
          this.stop();
          this.options.onScanResult(result);
        },
        onError: (err) => {
          this.options.onError(err);
        },
        onPermissionDenied: () => {
          this.options.onPermissionDenied?.();
        },
      });

      return await this.nativeSession.start(params.box);
    } else {
      console.log('[KRUSHI UNIVERSAL SCANNER] Starting WEB browser camera session');
      if (!params.videoElement) {
        this.options.onError('Video element is required for web camera preview.');
        return false;
      }

      this.videoEl = params.videoElement;

      this.webSession = new WebBarcodeScannerSession({
        onScanResult: (res) => {
          if (this.isLocked || !this.isScanning) return;
          this.isLocked = true;
          this.stop();

          // Parse raw decoded value into structured ProductScanResult
          const parsed = parseScannedBarcode(res.rawValue, res.format);
          this.options.onScanResult(parsed);
        },
        onError: (err) => {
          this.options.onError(err);
        },
        onPermissionDenied: () => {
          this.options.onPermissionDenied?.();
        },
        onCamerasFound: (cameras) => {
          this.options.onCamerasFound?.(cameras);
        },
      });

      return await this.webSession.start(params.videoElement, {
        deviceId: params.deviceId,
        facingMode: params.facingMode || 'environment',
      });
    }
  }

  async toggleTorch(): Promise<boolean> {
    if (this.nativeSession) {
      return await this.nativeSession.toggleTorch();
    }
    if (this.webSession) {
      return await this.webSession.toggleTorch();
    }
    return false;
  }

  isTorchSupported(): boolean {
    if (this.webSession) {
      return this.webSession.isTorchSupported();
    }
    return Capacitor.isNativePlatform();
  }

  async switchCamera(deviceId?: string): Promise<boolean> {
    if (this.webSession && this.videoEl) {
      return await this.webSession.switchCamera(deviceId);
    }
    return false;
  }

  stop(): void {
    this.isScanning = false;
    this.isLocked = false;

    if (this.nativeSession) {
      this.nativeSession.stop();
      this.nativeSession = null;
    }
    if (this.webSession) {
      this.webSession.stop();
      this.webSession = null;
    }
    this.videoEl = null;
  }
}

export { getAvailableVideoDevices };
