import React from 'react';
import { ReferenceTaxInvoice, InvoiceProps, downloadInvoiceAsPDF as downloadA5PDF } from './reference-tax-invoice';
import { ThermalReceiptInvoice } from './thermal-receipt-invoice';

export type InvoicePrintFormat = 'A5' | 'THERMAL_80MM';

export interface InvoiceRendererProps extends InvoiceProps {
  format?: InvoicePrintFormat;
}

export function InvoiceRenderer({
  format = 'A5',
  sale,
  shopDetails,
  customItems,
}: InvoiceRendererProps) {
  if (format === 'THERMAL_80MM') {
    return <ThermalReceiptInvoice sale={sale} shopDetails={shopDetails} customItems={customItems} />;
  }

  return <ReferenceTaxInvoice sale={sale} shopDetails={shopDetails} customItems={customItems} />;
}

/**
 * Universal print handler that respects paper size dimensions
 */
export function printInvoiceDirectly(elementId: string, format: InvoicePrintFormat = 'A5') {
  if (typeof window === 'undefined') return;

  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id "${elementId}" not found for printing.`);
    return;
  }

  const invoiceHtml = element.outerHTML;
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();

  if (format === 'THERMAL_80MM') {
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Thermal POS Receipt</title>
          <style>
            @page {
              size: 80mm auto !important;
              margin: 0 !important;
            }
            * {
              box-sizing: border-box !important;
            }
            body {
              font-family: Arial, Helvetica, "Courier New", monospace !important;
              background-color: #ffffff !important;
              color: #000000 !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 80mm !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .thermal-receipt-page {
              width: 78mm !important;
              max-width: 78mm !important;
              margin: 0 auto !important;
              padding: 2mm !important;
              background-color: #ffffff !important;
            }
            #printable-thermal-receipt,
            .thermal-receipt {
              width: 100% !important;
              margin: 0 !important;
              background-color: #ffffff !important;
            }
          </style>
        </head>
        <body>
          ${invoiceHtml}
        </body>
      </html>
    `);
  } else {
    // A5 Landscape
    const a5Html = element.classList.contains('invoice-page')
      ? invoiceHtml
      : `<div class="invoice-page" style="width: 210mm; height: 148mm; margin: 0; padding: 3mm; box-sizing: border-box; display: flex; align-items: center; justify-content: center; background-color: #ffffff;">${invoiceHtml}</div>`;

    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Tax Invoice A5</title>
          <style>
            @page {
              size: A5 landscape !important;
              margin: 0 !important;
            }
            *, *::before, *::after {
              box-sizing: border-box !important;
            }
            html, body {
              font-family: Arial, Helvetica, sans-serif !important;
              background-color: #ffffff !important;
              color: #000000 !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 210mm !important;
              height: 148mm !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              overflow: hidden !important;
            }
            .invoice-page {
              width: 210mm !important;
              height: 148mm !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              margin: 0 !important;
              padding: 3mm !important;
              box-sizing: border-box !important;
              background-color: #ffffff !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            #printable-tax-invoice,
            .invoice {
              width: 204mm !important;
              height: 142mm !important;
              margin: 0 auto !important;
              position: relative !important;
              box-sizing: border-box !important;
              background-color: #ffffff !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          </style>
        </head>
        <body>
          ${a5Html}
        </body>
      </html>
    `);
  }

  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 2000);
  }, 350);
}

/**
 * Universal PDF downloader that respects format dimensions and exact visual invoice structure.
 *
 * KEY FIX: The clone is rendered at its NATURAL height (no forced 142mm) and with
 * overflow:visible on all descendants so that html2canvas captures the COMPLETE
 * invoice content without any clipping.  The captured canvas is then placed into
 * the A5-landscape PDF using aspect-ratio-preserving fit so the invoice is never
 * distorted or cropped.
 */
export async function downloadInvoicePDF(
  elementId: string,
  filename: string = 'invoice.pdf',
  format: InvoicePrintFormat = 'A5',
  _saleData?: any,
  _shopDetails?: any
) {
  if (typeof window === 'undefined') return;

  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id "${elementId}" not found for PDF download.`);
    return;
  }

  // Target the actual inner invoice container instead of the outer margin wrapper (.invoice-page)
  const targetElement = (
    element.querySelector('.invoice') ||
    element.querySelector('#printable-tax-invoice') ||
    element.querySelector('.thermal-receipt') ||
    element
  ) as HTMLElement;

  try {
    const html2canvasModule = await import('html2canvas');
    const html2canvas = html2canvasModule.default || html2canvasModule;

    // Create a temporary off-screen staging container.
    // CRITICAL: use overflow:visible and do NOT set a fixed height so that the
    // invoice content is never clipped during raster capture.
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0px';
    container.style.left = '0px';
    container.style.zIndex = '-99999';
    container.style.opacity = '1';
    container.style.pointerEvents = 'none';
    container.style.backgroundColor = '#ffffff';
    container.style.transform = 'none';
    container.style.margin = '0';
    container.style.padding = '0';
    container.style.boxSizing = 'border-box';
    container.style.overflow = 'visible';

    if (format === 'THERMAL_80MM') {
      container.style.width = '78mm';
    } else {
      container.style.width = '204mm';
      // Height is intentionally NOT set — natural content height prevents clipping
    }

    const clone = targetElement.cloneNode(true) as HTMLElement;
    clone.style.transform = 'none';
    clone.style.margin = '0';
    clone.style.visibility = 'visible';
    clone.style.opacity = '1';
    clone.style.display = 'block';
    if (format !== 'THERMAL_80MM') {
      clone.style.width = '204mm';
      // Height is intentionally NOT forced to 142mm — let the invoice render
      // at its natural content height so that footer/terms/address are never clipped
      clone.style.height = 'auto';
      clone.style.minHeight = '142mm';
      clone.style.boxSizing = 'border-box';
      clone.style.overflow = 'visible';
    }

    container.appendChild(clone);
    document.body.appendChild(container);

    // Override overflow:hidden on ALL descendant elements inside the clone.
    // The original invoice uses overflow:hidden to constrain the on-screen layout,
    // but for the PDF capture we need every section's content to be fully visible.
    const allDescendants = clone.querySelectorAll('*') as NodeListOf<HTMLElement>;
    allDescendants.forEach((el) => {
      const cs = window.getComputedStyle(el);
      if (cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflowY === 'hidden') {
        el.style.overflow = 'visible';
      }
    });

    // Wait for fonts and images to finish loading before capture
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await new Promise((r) => setTimeout(r, 120));

    const canvas = await html2canvas(clone, {
      scale: 3, // 300 DPI high resolution
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      windowWidth: 1200,
    });

    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const { jsPDF } = await import('jspdf');

    if (format === 'THERMAL_80MM') {
      const pdfWidth = 80;
      const pdfHeight = (pdfWidth * canvas.height) / canvas.width;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, Math.max(pdfHeight, 100)],
      });
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(filename);
    } else {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a5',
      });

      // A5 landscape page: 210 × 148 mm
      // Target printable area with ~3mm margin: 204 × 142 mm
      const targetW = 204;
      const targetH = 142;

      // Aspect-ratio-preserving fit: scale the captured canvas to fit within
      // the target area without distortion or independent X/Y stretching
      const canvasAspect = canvas.width / canvas.height;
      const targetAspect = targetW / targetH;

      let drawW: number;
      let drawH: number;

      if (canvasAspect >= targetAspect) {
        // Canvas is wider (or same) relative to target — constrain by width
        drawW = targetW;
        drawH = targetW / canvasAspect;
      } else {
        // Canvas is taller relative to target — constrain by height
        drawH = targetH;
        drawW = targetH * canvasAspect;
      }

      // Center the image within the 210 × 148 mm page
      const offsetX = (210 - drawW) / 2;
      const offsetY = (148 - drawH) / 2;

      pdf.addImage(imgData, 'JPEG', offsetX, offsetY, drawW, drawH, undefined, 'FAST');
      pdf.save(filename);
    }
  } catch (err) {
    console.error('Error generating PDF from DOM:', err);
  }
}
