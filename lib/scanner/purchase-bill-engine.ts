import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { TextRecognition } from '@capacitor-mlkit/text-recognition';
import { Capacitor } from '@capacitor/core';
import {
  parsePurchaseBillQr,
  parsePurchaseBillOcr,
  matchDraftAgainstCatalog,
  PurchaseDraftResult,
} from './purchase-bill-parser';

export interface ProcessBillOptions {
  imagePathOrBase64?: string;
  file?: File;
  catalogProducts?: any[];
  suppliersList?: any[];
  onProgress?: (status: string) => void;
}

/**
 * Converts a File object to a Base64 Data URL
 */
export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Orchestrates the Purchase Bill Scanning and extraction pipeline:
 * 1. Checks for QR / barcodes in the image using ML Kit (e-Invoice QR, GST JSON, key-value)
 * 2. If QR is found with structured data, creates the base purchase draft
 * 3. If no QR or partial QR data, runs on-device Google ML Kit OCR text recognition
 * 4. Merges QR and OCR extraction conservatively
 * 5. Runs catalog matching against existing products and suppliers
 * 6. Returns the structured editable purchase draft
 */
export async function processPurchaseBillImage(
  options: ProcessBillOptions
): Promise<PurchaseDraftResult> {
  const {
    imagePathOrBase64,
    file,
    catalogProducts = [],
    suppliersList = [],
    onProgress,
  } = options;

  let imageUri = imagePathOrBase64;
  if (!imageUri && file) {
    onProgress?.('Loading image...');
    imageUri = await fileToDataUrl(file);
  }

  if (!imageUri) {
    throw new Error('No bill image provided for processing');
  }

  // Ensure file:// scheme for local Android filesystem paths if needed
  const normalizedPath = Capacitor.isNativePlatform() && imageUri.startsWith('/')
    ? `file://${imageUri}`
    : imageUri;

  let detectedQrPayload: string | null = null;
  let ocrRawText: string | null = null;
  let draftResult: PurchaseDraftResult | null = null;

  // ─────────────────────────────────────────────────────────
  // STEP 1: Attempt QR Code Detection
  // ─────────────────────────────────────────────────────────
  onProgress?.('Checking for QR / Barcodes...');
  try {
    if (Capacitor.isNativePlatform()) {
      const barcodeResult = await BarcodeScanner.readBarcodesFromImage({
        path: normalizedPath,
        formats: [
          BarcodeFormat.QrCode,
          BarcodeFormat.DataMatrix,
          BarcodeFormat.Code128,
          BarcodeFormat.Ean13,
        ],
      });

      if (barcodeResult.barcodes && barcodeResult.barcodes.length > 0) {
        // Look for the most informative QR / barcode
        const qrBarcode = barcodeResult.barcodes.find(
          (b) => b.format === 'QR_CODE' || b.format === 'DATA_MATRIX'
        ) || barcodeResult.barcodes[0];

        if (qrBarcode && qrBarcode.rawValue) {
          detectedQrPayload = qrBarcode.rawValue;
        }
      }
    }
  } catch (err) {
    console.warn('[PurchaseBillEngine] QR detection skipped or failed:', err);
  }

  if (detectedQrPayload) {
    onProgress?.('Parsing invoice QR code payload...');
    const qrDraft = parsePurchaseBillQr(detectedQrPayload);
    // If QR contains structured invoice data
    if (
      qrDraft.invoiceNumber ||
      qrDraft.supplier?.name ||
      qrDraft.supplier?.gstin ||
      qrDraft.items.length > 0 ||
      (qrDraft.grandTotal && qrDraft.grandTotal > 0)
    ) {
      draftResult = qrDraft;
    }
  }

  // ─────────────────────────────────────────────────────────
  // STEP 2: OCR / Text Recognition if No QR or Incomplete
  // ─────────────────────────────────────────────────────────
  const needsOcr =
    !draftResult ||
    draftResult.items.length === 0 ||
    !draftResult.invoiceNumber ||
    !draftResult.supplier?.name;

  if (needsOcr) {
    onProgress?.('Reading supplier bill text with OCR...');
    try {
      if (Capacitor.isNativePlatform()) {
        const textResult = await TextRecognition.processImage({
          path: normalizedPath,
        });
        if (textResult && textResult.text) {
          ocrRawText = textResult.text;
        }
      }
    } catch (err) {
      console.warn('[PurchaseBillEngine] Native OCR text recognition failed:', err);
    }

    if (ocrRawText && ocrRawText.trim()) {
      onProgress?.('Extracting purchase items and totals...');
      const ocrDraft = parsePurchaseBillOcr(ocrRawText);

      if (draftResult) {
        // Merge QR (high precision invoice/GST info) with OCR (line items)
        draftResult = {
          source: 'hybrid',
          rawQrPayload: draftResult.rawQrPayload,
          rawOcrText: ocrRawText,
          supplier: draftResult.supplier?.name ? draftResult.supplier : (ocrDraft.supplier || draftResult.supplier),
          invoiceNumber: draftResult.invoiceNumber || ocrDraft.invoiceNumber,
          invoiceDate: draftResult.invoiceDate || ocrDraft.invoiceDate,
          subtotal: draftResult.subtotal || ocrDraft.subtotal,
          cgst: draftResult.cgst || ocrDraft.cgst,
          sgst: draftResult.sgst || ocrDraft.sgst,
          igst: draftResult.igst || ocrDraft.igst,
          totalTax: draftResult.totalTax || ocrDraft.totalTax,
          grandTotal: draftResult.grandTotal || ocrDraft.grandTotal,
          items: draftResult.items.length > 0 ? draftResult.items : ocrDraft.items,
          uncertainFields: Array.from(
            new Set([...draftResult.uncertainFields, ...ocrDraft.uncertainFields])
          ),
        };
      } else {
        draftResult = ocrDraft;
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // STEP 3: Fallback if Neither QR nor OCR returned results
  // ─────────────────────────────────────────────────────────
  if (!draftResult) {
    draftResult = {
      source: 'ocr',
      items: [],
      uncertainFields: ['bill_image_unreadable'],
    };
  }

  // ─────────────────────────────────────────────────────────
  // STEP 4: Conservative Catalog Matching
  // ─────────────────────────────────────────────────────────
  onProgress?.('Matching products and supplier...');
  const matchedDraft = matchDraftAgainstCatalog(
    draftResult,
    catalogProducts,
    suppliersList
  );

  return matchedDraft;
}
