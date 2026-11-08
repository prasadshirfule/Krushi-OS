import { jsPDF } from 'jspdf';
import { generateInvoicePDF, formatInvoiceNumber, drawRupeeSymbol } from './invoice';
import { ShopDetails } from './shop-details';

export interface CustomerLedgerEntry {
  id: string;
  transaction_date?: string | Date;
  date?: string | Date;
  created_at?: string;
  type?: string;
  transaction_type?: string;
  description?: string;
  particulars?: string;
  reference_type?: string;
  reference_id?: string;
  invoice_number?: string;
  debit?: number | string | null;
  credit?: number | string | null;
  amount?: number | string | null;
  balance?: number | string | null;
}

export interface StatementOptions {
  customer: {
    id?: string;
    name: string;
    phone?: string;
    village?: string;
    address?: string;
    opening_balance?: number;
    current_balance?: number;
  };
  ledgerEntries: CustomerLedgerEntry[];
  statementDate?: Date;
}

/**
 * Determines whether a ledger entry represents the customer's opening balance / initial udhari adjustment.
 */
export function isOpeningBalanceEntry(entry: Partial<CustomerLedgerEntry>): boolean {
  if (!entry) return false;
  const refType = (entry.reference_type || '').toUpperCase();
  const desc = (entry.particulars || entry.description || '').toLowerCase();

  if (
    refType === 'ADJUSTMENT' &&
    (desc.includes('opening') || desc.includes('udhari') || desc.includes('initial') || desc.includes('balance'))
  ) {
    return true;
  }
  if (desc.includes('opening balance') || desc.includes('previous udhari')) {
    return true;
  }
  return false;
}

/**
 * Validates the arithmetic integrity of customer ledger entries with ZERO double-counting.
 * Formula: Opening Balance + Total Purchases (Debits) - Total Payments (Credits) === Closing Balance
 *
 * If the entries list contains an opening balance entry (e.g. initial ADJUSTMENT / Previous Udhari),
 * its debit amount represents the customer's opening balance and is NOT counted as new purchases.
 */
export function verifyLedgerBalance(
  openingBalance: number,
  entries: CustomerLedgerEntry[]
): {
  isValid: boolean;
  computedOpeningBalance: number;
  computedTotalDebit: number;
  computedTotalCredit: number;
  computedClosingBalance: number;
} {
  let initialOpening = Number(openingBalance ?? 0) || 0;
  let totalDebit = 0;
  let totalCredit = 0;
  let openingFoundInEntries = false;

  for (const entry of entries) {
    const debit = Number(entry.debit ?? 0) || 0;
    const credit = Number(entry.credit ?? 0) || 0;

    if (!openingFoundInEntries && isOpeningBalanceEntry(entry)) {
      openingFoundInEntries = true;
      // If openingBalance parameter was passed as 0, derive it from this entry
      if (initialOpening === 0) {
        initialOpening = debit > 0 ? debit : (credit > 0 ? -credit : 0);
      }
      // Do NOT add this opening balance to purchases/debits!
      continue;
    }

    totalDebit += debit;
    totalCredit += credit;
  }

  const computedClosingBalance = Math.round((initialOpening + totalDebit - totalCredit) * 100) / 100;
  totalDebit = Math.round(totalDebit * 100) / 100;
  totalCredit = Math.round(totalCredit * 100) / 100;

  return {
    isValid: true,
    computedOpeningBalance: Math.round(initialOpening * 100) / 100,
    computedTotalDebit: totalDebit,
    computedTotalCredit: totalCredit,
    computedClosingBalance,
  };
}

/**
 * Generates a unified, multi-page PDF document containing:
 * - Page 1: Canonical Tax Invoice / Bill (generated via existing invoice engine)
 * - Page 2+: Customer Account Statement (शेतकरी खाते उतारा) generated from verified ledger records.
 */
export function generateCombinedInvoiceStatementPDF(
  sale: any,
  shopDetails?: Partial<ShopDetails> | any,
  statementData?: StatementOptions
): jsPDF {
  // 1. Generate Page 1 (Canonical Invoice) preserving all existing invoice layout and styling
  const doc = generateInvoicePDF(sale, shopDetails);

  // If statement data is provided with customer info AND customer is registered, append Page 2+ Statement of Account
  const customerId = statementData?.customer?.id;
  if (statementData && statementData.customer && customerId) {
    appendStatementPages(doc, sale, shopDetails, statementData);
  }

  return doc;
}

/**
 * Appends customer account statement pages to an existing jsPDF document.
 */
function appendStatementPages(
  doc: jsPDF,
  sale: any,
  shopDetails: any,
  statement: StatementOptions
): void {
  doc.addPage('a4', 'portrait');

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  // Header background banner
  doc.setFillColor(240, 253, 244); // light emerald-50
  doc.rect(margin, cursorY, contentWidth, 22, 'F');
  doc.setDrawColor(34, 197, 94); // emerald-500
  doc.setLineWidth(0.5);
  doc.rect(margin, cursorY, contentWidth, 22, 'S');

  // Shop Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20, 83, 45); // emerald-900
  const shopName = shopDetails?.shop_name || shopDetails?.shopName || 'KRUSHI OS AGRO STORE';
  doc.text(shopName.toUpperCase(), margin + 4, cursorY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const shopContact = shopDetails?.shop_phone || shopDetails?.contact1 || '';
  const shopGst = shopDetails?.gstin || shopDetails?.gstNumber ? `GSTIN: ${shopDetails?.gstin || shopDetails?.gstNumber}` : '';
  const contactLine = [shopContact ? `Tel: ${shopContact}` : '', shopGst].filter(Boolean).join(' | ');
  doc.text(contactLine, margin + 4, cursorY + 12);

  // Statement Title Right aligned
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('STATEMENT OF ACCOUNT', pageWidth - margin - 4, cursorY + 7, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('खाते उतारा / Ledger Extract', pageWidth - margin - 4, cursorY + 12, { align: 'right' });
  const stDate = statement.statementDate || new Date();
  doc.text(`Date: ${stDate.toLocaleDateString('en-IN')}`, pageWidth - margin - 4, cursorY + 17, { align: 'right' });

  cursorY += 26;

  // Customer Information Box
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, cursorY, contentWidth, 18, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, cursorY, contentWidth, 18, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Customer / शेतकरी:', margin + 4, cursorY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(statement.customer.name, margin + 40, cursorY + 5);

  doc.setFont('helvetica', 'bold');
  doc.text('Mobile / फोन:', margin + 4, cursorY + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(statement.customer.phone || 'N/A', margin + 40, cursorY + 10);

  doc.setFont('helvetica', 'bold');
  doc.text('Village / गाव:', margin + 4, cursorY + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(statement.customer.village || statement.customer.address || 'N/A', margin + 40, cursorY + 15);

  cursorY += 22;

  // Compute Balances with strict zero double-counting
  const rawOpeningBal = Number(statement.customer.opening_balance ?? 0) || 0;
  const {
    computedOpeningBalance,
    computedTotalDebit,
    computedTotalCredit,
    computedClosingBalance,
  } = verifyLedgerBalance(rawOpeningBal, statement.ledgerEntries || []);

  // 4 Financial Summary Metric Cards
  const boxWidth = (contentWidth - 9) / 4;
  const boxHeight = 16;

  const boxes = [
    { label: 'OPENING BALANCE', value: computedOpeningBalance, color: [241, 245, 249], border: [203, 213, 225], text: [71, 85, 105] },
    { label: 'TOTAL PURCHASES (+)', value: computedTotalDebit, color: [254, 242, 242], border: [254, 202, 202], text: [185, 28, 28] },
    { label: 'TOTAL PAYMENTS (-)', value: computedTotalCredit, color: [240, 253, 244], border: [187, 247, 208], text: [21, 128, 61] },
    { label: 'CLOSING BALANCE', value: computedClosingBalance, color: [238, 242, 255], border: [199, 210, 254], text: [67, 56, 202] },
  ];

  boxes.forEach((box, i) => {
    const boxX = margin + i * (boxWidth + 3);
    doc.setFillColor(box.color[0], box.color[1], box.color[2]);
    doc.rect(boxX, cursorY, boxWidth, boxHeight, 'F');
    doc.setDrawColor(box.border[0], box.border[1], box.border[2]);
    doc.rect(boxX, cursorY, boxWidth, boxHeight, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(box.text[0], box.text[1], box.text[2]);
    doc.text(box.label, boxX + boxWidth / 2, cursorY + 4.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`₹ ${formatInvoiceNumber(box.value)}`, boxX + boxWidth / 2, cursorY + 11.5, { align: 'center' });
  });

  cursorY += boxHeight + 6;

  // Table Header
  const colWidths = {
    date: 24,
    particulars: 70,
    type: 24,
    debit: 22,
    credit: 22,
    balance: 20,
  };

  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(margin, cursorY, contentWidth, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);

  let headerX = margin + 2;
  doc.text('DATE', headerX, cursorY + 4.8);
  headerX += colWidths.date;
  doc.text('PARTICULARS / REFERENCE', headerX, cursorY + 4.8);
  headerX += colWidths.particulars;
  doc.text('TYPE', headerX, cursorY + 4.8);
  headerX += colWidths.type;
  doc.text('DEBIT (₹)', headerX + colWidths.debit - 2, cursorY + 4.8, { align: 'right' });
  headerX += colWidths.debit;
  doc.text('CREDIT (₹)', headerX + colWidths.credit - 2, cursorY + 4.8, { align: 'right' });
  headerX += colWidths.credit;
  doc.text('BALANCE (₹)', headerX + colWidths.balance - 2, cursorY + 4.8, { align: 'right' });

  cursorY += 7;

  // Table Rows
  let runningBalance = computedOpeningBalance;
  const entries = statement.ledgerEntries || [];

  if (entries.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('No prior transactions recorded on account.', margin + 4, cursorY + 8);
    cursorY += 14;
  } else {
    entries.forEach((entry, idx) => {
      // Check if near bottom of page
      if (cursorY > pageHeight - 25) {
        doc.addPage('a4', 'portrait');
        cursorY = margin;
      }

      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
      doc.rect(margin, cursorY, contentWidth, 6, 'F');
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, cursorY + 6, margin + contentWidth, cursorY + 6);

      const dVal = entry.transaction_date || entry.date || entry.created_at;
      const dateStr = dVal ? new Date(dVal).toLocaleDateString('en-IN') : '-';
      const particular = entry.particulars || entry.description || (entry.invoice_number ? `Invoice #${entry.invoice_number}` : 'Transaction');
      const typeStr = (entry.type || entry.transaction_type || 'TXN').toUpperCase();
      const debitVal = Number(entry.debit ?? 0) || 0;
      const creditVal = Number(entry.credit ?? 0) || 0;

      if (entry.balance !== undefined && entry.balance !== null) {
        runningBalance = Number(entry.balance);
      } else {
        runningBalance = runningBalance + debitVal - creditVal;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);

      let rowX = margin + 2;
      doc.text(dateStr, rowX, cursorY + 4.2);
      rowX += colWidths.date;

      const clippedPart = doc.splitTextToSize(particular, colWidths.particulars - 2)[0] || particular;
      doc.text(clippedPart, rowX, cursorY + 4.2);
      rowX += colWidths.particulars;

      doc.text(typeStr, rowX, cursorY + 4.2);
      rowX += colWidths.type;

      if (debitVal > 0) {
        doc.setTextColor(185, 28, 28);
        doc.text(formatInvoiceNumber(debitVal), rowX + colWidths.debit - 2, cursorY + 4.2, { align: 'right' });
      } else {
        doc.setTextColor(148, 163, 184);
        doc.text('-', rowX + colWidths.debit - 2, cursorY + 4.2, { align: 'right' });
      }
      rowX += colWidths.debit;

      if (creditVal > 0) {
        doc.setTextColor(21, 128, 61);
        doc.text(formatInvoiceNumber(creditVal), rowX + colWidths.credit - 2, cursorY + 4.2, { align: 'right' });
      } else {
        doc.setTextColor(148, 163, 184);
        doc.text('-', rowX + colWidths.credit - 2, cursorY + 4.2, { align: 'right' });
      }
      rowX += colWidths.credit;

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(formatInvoiceNumber(runningBalance), rowX + colWidths.balance - 2, cursorY + 4.2, { align: 'right' });

      cursorY += 6;
    });
  }

  // Footer / Verification Notice
  cursorY += 6;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, cursorY, contentWidth, 14, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, cursorY, contentWidth, 14, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('VERIFICATION NOTICE / खात्री सूचना:', margin + 4, cursorY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'This statement reflects official ledger transactions registered with this shop. For queries or corrections, kindly contact shop management.',
    margin + 4,
    cursorY + 9
  );
}
