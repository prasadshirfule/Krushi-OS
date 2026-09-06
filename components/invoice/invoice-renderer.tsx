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
            * {
              box-sizing: border-box !important;
            }
            body {
              font-family: Arial, Helvetica, sans-serif !important;
              background-color: #ffffff !important;
              color: #000000 !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              overflow: hidden !important;
            }
            .invoice-page {
              width: 210mm !important;
              height: 148mm !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              margin: 0 !important;
              padding: 0 !important;
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
          ${invoiceHtml}
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
 * Universal PDF downloader that respects format dimensions
 */
export async function downloadInvoicePDF(
  elementId: string,
  filename: string = 'invoice.pdf',
  format: InvoicePrintFormat = 'A5'
) {
  const element = document.getElementById(elementId);
  if (!element) return;

  try {
    const html2canvasModule = await import('html2canvas');
    const html2canvas = html2canvasModule.default || html2canvasModule;
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

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
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(filename);
    } else {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a5',
      });
      // Center 204x142 inside 210x148
      pdf.addImage(imgData, 'JPEG', 3, 3, 204, (204 * canvas.height) / canvas.width);
      pdf.save(filename);
    }
  } catch (err) {
    console.error('Error generating PDF from DOM:', err);
  }
}
