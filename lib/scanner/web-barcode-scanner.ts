import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

export interface WebScannerScanResult {
  rawValue: string;
  format: string;
}

export interface WebScannerOptions {
  onScanResult: (result: WebScannerScanResult) => void;
  onError: (error: string) => void;
  onPermissionDenied?: () => void;
  onCamerasFound?: (cameras: { deviceId: string; label: string }[]) => void;
}

export interface VideoDeviceOption {
  deviceId: string;
  label: string;
}

/**
 * Checks whether camera media access is available in the browser.
 */
export function isWebCameraSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    navigator &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

/**
 * Checks whether the current window context is secure (HTTPS or localhost).
 * Web browsers block camera access on plain HTTP (except localhost).
 */
export function isSecureContextActive(): boolean {
  if (typeof window === 'undefined') return false;
  // Localhost or 127.0.0.1 is considered secure by browsers
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.localhost');
  return Boolean(window.isSecureContext || isLocalhost);
}

/**
 * Enumerates all video input devices (cameras) available on the host device.
 */
export async function getAvailableVideoDevices(): Promise<VideoDeviceOption[]> {
  if (!isWebCameraSupported()) return [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((d) => d.kind === 'videoinput');
    return videoDevices.map((d, index) => ({
      deviceId: d.deviceId,
      label: d.label || `Camera ${index + 1}`,
    }));
  } catch (err) {
    console.warn('[KRUSHI WEB SCANNER] Failed to enumerate devices:', err);
    return [];
  }
}

/**
 * Comprehensive Web Barcode & QR Code Scanner Session
 * Works on Desktop Webcams, Laptop Cameras, and Mobile Browsers (iOS Safari, Android Chrome).
 */
export class WebBarcodeScannerSession {
  private videoEl: HTMLVideoElement | null = null;
  private mediaStream: MediaStream | null = null;
  private reader: BrowserMultiFormatReader | null = null;
  private options: WebScannerOptions;
  private isScanning = false;
  private isLocked = false;
  private isTorchOn = false;
  private activeDeviceId?: string;
  private activeFacingMode: 'environment' | 'user' = 'environment';
  private frameIntervalId: number | null = null;

  constructor(options: WebScannerOptions) {
    this.options = options;
  }

  /**
   * Starts the camera and barcode reader on the provided HTMLVideoElement.
   */
  async start(
    videoEl: HTMLVideoElement,
    preferences?: {
      deviceId?: string;
      facingMode?: 'environment' | 'user';
    }
  ): Promise<boolean> {
    if (!isWebCameraSupported()) {
      this.options.onError('Camera access is not supported by this browser.');
      return false;
    }

    if (!isSecureContextActive()) {
      this.options.onError(
        'Camera access requires a secure HTTPS connection. Please ensure you are running on HTTPS or localhost.'
      );
      return false;
    }

    this.stop(); // Stop any previous session
    this.videoEl = videoEl;
    this.isLocked = false;
    this.isScanning = true;
    this.activeDeviceId = preferences?.deviceId;
    this.activeFacingMode = preferences?.facingMode || 'environment';

    try {
      // 1. Build optimal camera constraints
      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };

      if (this.activeDeviceId) {
        videoConstraints.deviceId = { exact: this.activeDeviceId };
      } else {
        // Mobile browsers: default to rear camera (environment)
        videoConstraints.facingMode = { ideal: this.activeFacingMode };
      }

      console.log('[KRUSHI WEB SCANNER] Requesting camera stream with constraints:', videoConstraints);

      // 2. Request camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      this.mediaStream = stream;
      videoEl.srcObject = stream;
      videoEl.setAttribute('playsinline', 'true'); // Critical for iOS Safari
      videoEl.setAttribute('muted', 'true');
      await videoEl.play();

      // 3. Enumerate available cameras once stream permission is granted
      getAvailableVideoDevices().then((cameras) => {
        if (this.options.onCamerasFound && cameras.length > 0) {
          this.options.onCamerasFound(cameras);
        }
      });

      // 4. Start Decoding loop (Native BarcodeDetector if available + @zxing/browser fallback)
      this.startDecodingPipeline(videoEl);

      return true;
    } catch (err: any) {
      console.error('[KRUSHI WEB SCANNER] Camera start failed:', err);
      this.stop();

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        if (this.options.onPermissionDenied) {
          this.options.onPermissionDenied();
        } else {
          this.options.onError('Camera permission was denied. Please allow camera access in your browser settings.');
        }
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        this.options.onError('No camera was found on this device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        this.options.onError('Camera is currently in use by another application.');
      } else {
        this.options.onError(err.message || 'Failed to start camera preview.');
      }
      return false;
    }
  }

  /**
   * Hardware-accelerated decoding with automatic fallback
   */
  private startDecodingPipeline(videoEl: HTMLVideoElement) {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.AZTEC,
      BarcodeFormat.PDF_417,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    this.reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 120,
    });

    // Attempt native hardware BarcodeDetector first if supported
    const hasNativeDetector =
      typeof window !== 'undefined' && 'BarcodeDetector' in window && typeof (window as any).BarcodeDetector === 'function';

    if (hasNativeDetector) {
      try {
        const supportedNativeFormats = [
          'qr_code',
          'ean_13',
          'ean_8',
          'upc_a',
          'upc_e',
          'code_128',
          'code_39',
          'code_93',
          'data_matrix',
          'itf',
          'aztec',
        ];
        const detector = new (window as any).BarcodeDetector({
          formats: supportedNativeFormats,
        });

        const nativeLoop = async () => {
          if (!this.isScanning || this.isLocked || !this.videoEl) return;
          try {
            if (this.videoEl.readyState >= 2) {
              const barcodes = await detector.detect(this.videoEl);
              if (barcodes && barcodes.length > 0 && !this.isLocked && this.isScanning) {
                const first = barcodes[0];
                const rawValue = (first.rawValue || '').trim();
                const format = (first.format || 'UNKNOWN').toUpperCase();

                if (rawValue) {
                  this.isLocked = true;
                  this.options.onScanResult({ rawValue, format });
                  return;
                }
              }
            }
          } catch {
            // Native detect frame error, will continue to next frame
          }

          if (this.isScanning && !this.isLocked) {
            this.frameIntervalId = window.setTimeout(nativeLoop, 100);
          }
        };

        this.frameIntervalId = window.setTimeout(nativeLoop, 150);
        return;
      } catch (detectorErr) {
        console.warn('[KRUSHI WEB SCANNER] Native BarcodeDetector init failed, using ZXing:', detectorErr);
      }
    }

    // ZXing Browser Decoder
    try {
      this.reader.decodeFromVideoElement(videoEl, (result, error) => {
        if (!this.isScanning || this.isLocked) return;

        if (result) {
          const rawValue = (result.getText() || '').trim();
          const format = result.getBarcodeFormat() ? BarcodeFormat[result.getBarcodeFormat()] : 'UNKNOWN';

          if (rawValue) {
            this.isLocked = true;
            this.options.onScanResult({ rawValue, format });
          }
        }
      });
    } catch (zxingErr: any) {
      console.warn('[KRUSHI WEB SCANNER] ZXing decode error:', zxingErr);
    }
  }

  /**
   * Toggles camera torch/flashlight if supported by the camera hardware.
   */
  async toggleTorch(): Promise<boolean> {
    if (!this.mediaStream) return false;
    const track = this.mediaStream.getVideoTracks()[0];
    if (!track) return false;

    try {
      const capabilities = (track.getCapabilities && track.getCapabilities()) as any;
      if (capabilities && 'torch' in capabilities) {
        const nextState = !this.isTorchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as any],
        });
        this.isTorchOn = nextState;
        return this.isTorchOn;
      }
      return false;
    } catch (err) {
      console.warn('[KRUSHI WEB SCANNER] Torch toggle error:', err);
      return false;
    }
  }

  isTorchSupported(): boolean {
    if (!this.mediaStream) return false;
    const track = this.mediaStream.getVideoTracks()[0];
    if (!track) return false;
    try {
      const capabilities = (track.getCapabilities && track.getCapabilities()) as any;
      return Boolean(capabilities && 'torch' in capabilities);
    } catch {
      return false;
    }
  }

  getTorchStatus(): boolean {
    return this.isTorchOn;
  }

  /**
   * Switch between front and rear cameras (or select a specific deviceId).
   */
  async switchCamera(deviceId?: string): Promise<boolean> {
    if (!this.videoEl) return false;

    let targetDeviceId = deviceId;
    let targetFacing: 'environment' | 'user' = this.activeFacingMode;

    if (!targetDeviceId) {
      // Toggle facing mode if no deviceId given
      targetFacing = this.activeFacingMode === 'environment' ? 'user' : 'environment';
    }

    return await this.start(this.videoEl, {
      deviceId: targetDeviceId,
      facingMode: targetFacing,
    });
  }

  /**
   * Stops all active camera tracks, clears timers, and resets video element.
   */
  stop(): void {
    this.isScanning = false;
    this.isLocked = false;
    this.isTorchOn = false;

    if (this.frameIntervalId !== null) {
      clearTimeout(this.frameIntervalId);
      this.frameIntervalId = null;
    }

    if (this.reader) {
      try {
        // Stop ZXing internal loop
        (this.reader as any).stopContinuousDecode?.();
      } catch {}
      this.reader = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      this.mediaStream = null;
    }

    if (this.videoEl) {
      try {
        this.videoEl.pause();
        this.videoEl.srcObject = null;
      } catch {}
      this.videoEl = null;
    }
  }
}
