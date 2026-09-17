import { TextRecognition } from '@capacitor-mlkit/text-recognition';
import { CameraPreview, CameraPreviewOptions } from '@capacitor-community/camera-preview';
import { Capacitor } from '@capacitor/core';
import { parseProductLabelOcr } from './ocr-parser';
import { ProductScanResult } from './types';

export interface OcrCaptureResult {
  success: boolean;
  rawText?: string;
  parsedResult?: ProductScanResult;
  imageUri?: string;
  error?: string;
}

let isCameraPreviewActive = false;

/**
 * Checks whether native camera and ML Kit Text Recognition are supported.
 */
export async function isNativeOcrSupported(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  return true;
}

/**
 * Starts the embedded live camera preview inside the KRUSHI OS scanner modal.
 * Uses toBack: true on Android so HTML controls (viewfinder, capture button, flashlight)
 * sit cleanly on top of the live rear camera feed.
 */
export async function startEmbeddedOcrCamera(options?: {
  parentId?: string;
  className?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (isCameraPreviewActive) {
      await stopEmbeddedOcrCamera();
    }

    if (Capacitor.isNativePlatform()) {
      // Make HTML/body background transparent for the Camera SurfaceView
      document.documentElement.classList.add('barcode-scanner-active');
      document.body.classList.add('barcode-scanner-active');

      const cameraPreviewOptions: CameraPreviewOptions = {
        position: 'rear',
        toBack: true,
        storeToFile: true,
        enableOpacity: true,
        disableAudio: true,
      };

      await CameraPreview.start(cameraPreviewOptions);
      isCameraPreviewActive = true;
      return { success: true };
    } else {
      // Web / desktop browser fallback
      const cameraPreviewOptions: CameraPreviewOptions = {
        position: 'rear',
        parent: options?.parentId || 'ocr-embedded-preview-container',
        className: options?.className || 'w-full h-full object-cover',
        toBack: false,
        disableAudio: true,
      };

      await CameraPreview.start(cameraPreviewOptions);
      isCameraPreviewActive = true;
      return { success: true };
    }
  } catch (err: any) {
    console.error('Failed to start embedded OCR camera preview:', err);
    cleanupOcrTransparency();
    isCameraPreviewActive = false;
    return {
      success: false,
      error: err?.message || 'Could not open camera preview. Please check camera permissions.',
    };
  }
}

/**
 * Stops and releases the embedded camera preview.
 */
export async function stopEmbeddedOcrCamera(): Promise<void> {
  try {
    if (isCameraPreviewActive) {
      await CameraPreview.stop();
      isCameraPreviewActive = false;
    }
  } catch (err) {
    console.warn('Error stopping camera preview:', err);
  } finally {
    isCameraPreviewActive = false;
    cleanupOcrTransparency();
  }
}

/**
 * Toggles flashlight/torch on the active embedded camera preview.
 */
export async function toggleEmbeddedOcrTorch(currentState: boolean): Promise<boolean> {
  try {
    const nextMode = currentState ? 'off' : 'torch';
    await CameraPreview.setFlashMode({ flashMode: nextMode });
    return !currentState;
  } catch (err) {
    console.warn('Flashlight toggle failed:', err);
    return currentState;
  }
}

/**
 * Captures a frame/photo from the embedded camera preview,
 * immediately stops the camera, and processes it via Google ML Kit Text Recognition.
 */
export async function captureAndRecognizeEmbeddedOcr(): Promise<OcrCaptureResult> {
  try {
    if (!isCameraPreviewActive) {
      return {
        success: false,
        error: 'Camera is not currently active.',
      };
    }

    // 1. Capture high-resolution photo from the live camera preview
    const captureResult = await CameraPreview.capture({ quality: 90 });
    
    // Stop camera immediately after capture to return to normal UI
    await stopEmbeddedOcrCamera();

    if (!captureResult || !captureResult.value) {
      return {
        success: false,
        error: 'No image data was captured from the camera.',
      };
    }

    const imagePathOrBase64 = captureResult.value;

    // 2. Run Google ML Kit on-device Text Recognition
    let rawText = '';

    if (Capacitor.isNativePlatform()) {
      // On Android with storeToFile: true, imagePathOrBase64 is the file path
      const imagePath = imagePathOrBase64.startsWith('file://')
        ? imagePathOrBase64
        : imagePathOrBase64.startsWith('/')
        ? `file://${imagePathOrBase64}`
        : imagePathOrBase64;

      const ocrResult = await TextRecognition.processImage({
        path: imagePath,
      });
      rawText = ocrResult.text || '';
    } else {
      // Desktop web fallback
      return {
        success: false,
        error: 'On-device Google ML Kit OCR is available in the KRUSHI OS Android app. Please use manual label entry on web.',
      };
    }

    if (!rawText.trim()) {
      return {
        success: false,
        imageUri: imagePathOrBase64,
        error: 'No readable text was recognized on the package label. Please ensure good lighting and try again.',
      };
    }

    // 3. Parse recognized text into structured product fields
    const parsed = parseProductLabelOcr(rawText);

    return {
      success: true,
      rawText,
      parsedResult: parsed,
      imageUri: imagePathOrBase64,
    };
  } catch (err: any) {
    await stopEmbeddedOcrCamera();
    console.error('Embedded OCR Capture failed:', err);
    return {
      success: false,
      error: err?.message || 'Failed to capture and recognize product label.',
    };
  }
}

function cleanupOcrTransparency() {
  try {
    document.documentElement.classList.remove('barcode-scanner-active');
    document.body.classList.remove('barcode-scanner-active');
  } catch {}
}
