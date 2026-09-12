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
 * Universal PDF downloader that captures the exact working invoice layout via html2canvas.
 *
 * KEY DESIGN: The capture clones the FULL .invoice-page wrapper (210×148mm) — not just
 * the inner .invoice element — because .invoice-page provides the flex-centering context,
 * 3mm padding, and A5-page geometry that the working View/Print invoice relies on.
 * Stripping this parent alters the clone's internal layout.
 *
 * The clone is placed off-screen (large negative left) so it is rendered by the browser
 * but never visible.  The captured 210×148mm raster fills the entire A5-landscape PDF
 * at (0, 0) — producing an identical result to View/Print.
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

  try {
    const html2canvasModule = await import('html2canvas');
    const html2canvas = html2canvasModule.default || html2canvasModule;

    // ── Determine capture target ──
    // For A5: capture the full .invoice-page wrapper (210×148mm) which provides the
    // flex-centering parent context, 3mm padding, and the complete .invoice child.
    // The element can be:
    //   - a wrapper containing .invoice-page  (bill-success-dialog: #bill-success-invoice)
    //   - the .invoice element itself          (sale-detail-view: #printable-tax-invoice)
    //   - the .invoice-page itself             (unlikely but handled)
    // Use closest() (walks UP) and querySelector() (walks DOWN) to find .invoice-page.
    let captureTarget: HTMLElement;

    if (format === 'THERMAL_80MM') {
      captureTarget = (
        element.querySelector('.thermal-receipt') ||
        element.closest('.thermal-receipt-page') ||
        element.querySelector('.thermal-receipt-page') ||
        element
      ) as HTMLElement;
    } else {
      captureTarget = (
        element.querySelector('.invoice') ||
        element.querySelector('#printable-tax-invoice') ||
        (element.classList?.contains('invoice') ? element : null) ||
        element.closest('.invoice') ||
        element.querySelector('.invoice-page') ||
        element.closest('.invoice-page') ||
        element
      ) as HTMLElement;
    }

    // ── Staging container ──
    // Positioned off-screen so the clone is rendered by the browser engine.
    const isThermal = format === 'THERMAL_80MM';
    const isFullPage = captureTarget.classList?.contains('invoice-page');
    const targetWidthMm = isThermal ? 80 : (isFullPage ? 210 : 204);
    const targetHeightMm = isThermal ? null : (isFullPage ? 148 : 142);

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0px';
    container.style.left = '-10000px';
    container.style.pointerEvents = 'none';
    container.style.backgroundColor = '#ffffff';
    container.style.margin = '0';
    container.style.padding = '0';
    container.style.boxSizing = 'border-box';
    container.style.overflow = 'hidden';
    container.style.width = `${targetWidthMm}mm`;
    if (targetHeightMm) {
      container.style.height = `${targetHeightMm}mm`;
    }

    // ── Clone the capture target ──
    // Preserve inline styling and remove outer margin so content starts immediately at (0, 0)
    const clone = captureTarget.cloneNode(true) as HTMLElement;
    clone.style.margin = '0';
    clone.style.visibility = 'visible';
    clone.style.opacity = '1';
    clone.style.transform = 'none';
    if (!isThermal && !isFullPage) {
      clone.style.display = 'block';
      clone.style.width = '204mm';
      clone.style.height = '142mm';
      clone.style.boxSizing = 'border-box';
    }

    container.appendChild(clone);
    document.body.appendChild(container);

    // Wait for web fonts and images to finish loading before capture
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await new Promise((r) => setTimeout(r, 100));

    const canvas = await html2canvas(clone, {
      scale: 3, // 300 DPI high-resolution capture
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
    });

    // Remove the staging container immediately after capture
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
      if (!isFullPage) {
        // Place the 204mm × 142mm invoice at (3, 3) to center it on the 210mm × 148mm A5 page
        pdf.addImage(imgData, 'JPEG', 3, 3, 204, 142, undefined, 'FAST');
      } else {
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 148, undefined, 'FAST');
      }
      pdf.save(filename);
    }
  } catch (err) {
    console.error('Error generating PDF from DOM:', err);
  }
}
