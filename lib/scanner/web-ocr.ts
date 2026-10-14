import { Capacitor } from '@capacitor/core';
import { TextRecognition } from '@capacitor-mlkit/text-recognition';
import { parseProductLabelOcr } from './ocr-parser';
import { parseScannedBarcode } from './barcode-parser';
import { mergeProductScanResults } from './source-merger';
import { ProductScanResult } from './types';

export interface PackagingScanResult {
  productName?: string;
  manufacturer?: string;
  brand?: string;
  batchNumber?: string;
  manufacturingDate?: string; // ISO format: YYYY-MM-DD
  bestBeforeDate?: string; // DD/MM/YYYY
  bestBeforeDateDB?: string; // ISO format: YYYY-MM-DD
  expiryDate?: string; // DD/MM/YYYY
  expiryDateDB?: string; // ISO format: YYYY-MM-DD
  mrp?: number;
  barcode?: string;
  gtin?: string;
  packSize?: string;
  sizeValue?: number;
  sizeUnit?: string;
  composition?: string;
  formulation?: string;
  confidence: Record<string, number>;
  rawOcrText?: string;
  rawBarcode?: string;
  barcodeFormat?: string;
  sources: Record<string, string>;
}

export type OcrProgressCallback = (progress: number, status: string) => void;

/**
 * Preprocesses an image on an offscreen HTMLCanvasElement:
 * Rescales to max 1600px, converts to high-contrast grayscale to maximize OCR accuracy on packaging.
 */
export async function preprocessImageForOcr(
  imageSource: string | File | Blob | HTMLImageElement | HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    let img: HTMLImageElement;

    const process = (image: HTMLImageElement) => {
      try {
        const naturalWidth = image.naturalWidth || image.width || 800;
        const naturalHeight = image.naturalHeight || image.height || 600;

        // Limit maximum dimensions for fast yet high-accuracy OCR
        const maxDim = 1600;
        let scale = 1;
        if (naturalWidth > maxDim || naturalHeight > maxDim) {
          scale = maxDim / Math.max(naturalWidth, naturalHeight);
        }

        const targetW = Math.round(naturalWidth * scale);
        const targetH = Math.round(naturalHeight * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          return reject(new Error('Failed to get 2D canvas context'));
        }

        // Draw scaled image
        ctx.drawImage(image, 0, 0, targetW, targetH);

        // Apply gentle contrast enhancement
        try {
          const imgData = ctx.getImageData(0, 0, targetW, targetH);
          const data = imgData.data;

          for (let i = 0; i < data.length; i += 4) {
            // Standard luminance calculation
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            // Simple S-curve contrast stretch
            const boosted = gray > 130 ? Math.min(255, gray * 1.15) : Math.max(0, gray * 0.85);
            data[i] = boosted;
            data[i + 1] = boosted;
            data[i + 2] = boosted;
          }

          ctx.putImageData(imgData, 0, 0);
        } catch {
          // Cross-origin image or canvas taint fallback
        }

        resolve(canvas);
      } catch (err) {
        reject(err);
      }
    };

    if (imageSource instanceof HTMLCanvasElement) {
      return resolve(imageSource);
    }

    if (imageSource instanceof HTMLImageElement) {
      if (imageSource.complete) {
        return process(imageSource);
      }
      imageSource.onload = () => process(imageSource);
      imageSource.onerror = (err) => reject(err);
      return;
    }

    img = new Image();
    img.crossOrigin = 'anonymous';

    if (typeof imageSource === 'string') {
      img.src = imageSource;
      img.onload = () => process(img);
      img.onerror = (err) => reject(new Error('Failed to load image from URL: ' + String(err)));
    } else {
      const url = URL.createObjectURL(imageSource);
      img.src = url;
      img.onload = () => {
        process(img);
        URL.revokeObjectURL(url);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image blob: ' + String(err)));
      };
    }
  });
}

/**
 * Attempts to decode any barcode or QR code on an image canvas or URL
 */
export async function decodeBarcodeFromImage(
  canvasOrUrl: HTMLCanvasElement | string
): Promise<ProductScanResult | null> {
  try {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const { BarcodeFormat, DecodeHintType } = await import('@zxing/library');

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints);

    let res: any = null;
    if (typeof canvasOrUrl === 'string') {
      res = await reader.decodeFromImageUrl(canvasOrUrl);
    } else {
      res = await reader.decodeFromCanvas(canvasOrUrl);
    }

    if (res) {
      const rawValue = (res.getText() || '').trim();
      const format = res.getBarcodeFormat() ? BarcodeFormat[res.getBarcodeFormat()] : 'UNKNOWN';
      if (rawValue) {
        return parseScannedBarcode(rawValue, format);
      }
    }
    return null;
  } catch {
    // Normal when no barcode is present on label
    return null;
  }
}

/**
 * High-Level Packaging Scanning Pipeline:
 * 1. Checks for 2D/1D codes (GS1 QR, Barcode, etc.).
 * 2. Runs OCR on printed text (Batch No, MFD, EXP, MRP, Product Name, Manufacturer).
 * 3. Safely merges findings into a cohesive, validated review payload.
 */
export async function recognizePackagingDetails(
  imageSource: string | File | Blob | HTMLImageElement | HTMLCanvasElement,
  onProgress?: OcrProgressCallback
): Promise<PackagingScanResult> {
  onProgress?.(10, 'Preprocessing image...');
  let processedCanvas: HTMLCanvasElement | null = null;
  try {
    processedCanvas = await preprocessImageForOcr(imageSource);
  } catch (err) {
    console.warn('[KRUSHI PACKAGING OCR] Canvas preprocess error, using raw image:', err);
  }

  // 1. Attempt Barcode / QR decode from packaging image
  onProgress?.(25, 'Scanning for QR & Barcodes on label...');
  let barcodeResult: ProductScanResult | null = null;
  if (processedCanvas) {
    barcodeResult = await decodeBarcodeFromImage(processedCanvas);
  } else if (typeof imageSource === 'string') {
    barcodeResult = await decodeBarcodeFromImage(imageSource);
  }

  // 2. Perform OCR
  onProgress?.(40, 'Reading printed label text (OCR)...');
  let rawOcrText = '';

  // Capacitor Android ML Kit path
  if (Capacitor.isNativePlatform() && typeof imageSource === 'string') {
    try {
      const mlkitRes = await TextRecognition.processImage({ path: imageSource });
      rawOcrText = mlkitRes.text || '';
    } catch (mlErr) {
      console.warn('[KRUSHI PACKAGING OCR] Capacitor ML Kit text recognition error:', mlErr);
    }
  }

  // Web Browser / Tesseract.js fallback
  if (!rawOcrText.trim()) {
    try {
      const { recognize } = await import('tesseract.js');
      const input = processedCanvas || imageSource;
      const tesseractResult = await recognize(input, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            const mapped = Math.round(40 + m.progress * 45);
            onProgress?.(mapped, `Reading label text (${Math.round(m.progress * 100)}%)...`);
          }
        },
      });
      rawOcrText = tesseractResult?.data?.text || '';
    } catch (ocrErr: any) {
      console.error('[KRUSHI PACKAGING OCR] Tesseract OCR error:', ocrErr);
    }
  }

  onProgress?.(90, 'Parsing agricultural batch & expiry details...');

  // 3. Parse OCR Text
  const ocrResult = parseProductLabelOcr(rawOcrText);

  // 4. Merge Barcode/QR findings and OCR findings with strict priority
  const scanSources: ProductScanResult[] = [];
  if (barcodeResult) scanSources.push(barcodeResult);
  if (ocrResult && ocrResult.detectedFields && ocrResult.detectedFields.length > 0) {
    scanSources.push(ocrResult);
  }

  const merged = scanSources.length > 0 ? mergeProductScanResults(scanSources) : ocrResult;

  onProgress?.(100, 'Processing complete ✓');

  const conf = merged.confidence || {};
  const sources = (merged.fieldSources as Record<string, string>) || {};

  return {
    productName: merged.productName || undefined,
    manufacturer: merged.manufacturer || undefined,
    brand: merged.brand || merged.manufacturer || undefined,
    batchNumber: merged.batchNumber || undefined,
    manufacturingDate: merged.manufacturingDate || undefined,
    bestBeforeDate: merged.bestBeforeDate || undefined,
    bestBeforeDateDB: merged.bestBeforeDateDB || undefined,
    expiryDate: merged.expiryDate || undefined,
    expiryDateDB: merged.expiryDateDB || undefined,
    mrp: merged.mrp !== undefined && merged.mrp !== null ? Number(merged.mrp) : undefined,
    barcode: merged.barcode || barcodeResult?.barcode || undefined,
    gtin: merged.gtin || barcodeResult?.gtin || undefined,
    packSize: merged.packSize || undefined,
    sizeValue: merged.sizeValue !== undefined ? Number(merged.sizeValue) : undefined,
    sizeUnit: merged.sizeUnit || undefined,
    composition: merged.composition || undefined,
    formulation: merged.formulation || undefined,
    confidence: conf,
    rawOcrText: rawOcrText.trim() || undefined,
    rawBarcode: barcodeResult?.rawValue || undefined,
    barcodeFormat: barcodeResult?.format || undefined,
    sources,
  };
}
