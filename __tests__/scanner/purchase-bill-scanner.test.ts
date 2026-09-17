import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parsePurchaseBillQr,
  parsePurchaseBillOcr,
  matchDraftAgainstCatalog,
  PurchaseDraftResult,
} from '../../lib/scanner/purchase-bill-parser';

describe('Purchase Bill Scanner Tests', () => {
  // ─── A & B: QR Payload Detection & Structured Parsing ───
  describe('QR Payload Parsing', () => {
    it('parses GST e-Invoice JSON payload accurately', () => {
      const jsonPayload = JSON.stringify({
        SellerGstin: '27ABCDE1234F1Z5',
        BuyerGstin: '27XYZAB9876C1Z2',
        DocNo: 'INV/2026/0942',
        DocDate: '2026-09-15',
        TotInvVal: 45000,
        ItemList: [
          {
            PrdDesc: 'Urea 46% Nitrogen',
            HsnCd: '31021000',
            Qty: 20,
            Unit: 'BAGS',
            UnitPrice: 1100,
            TotAmt: 22000,
            GstRt: 5,
            Batch: 'UR-9921',
            ExpDate: '2028-06-30',
          },
          {
            PrdDesc: 'DAP 50kg Fertilizer',
            HsnCd: '31052000',
            Qty: 15,
            Unit: 'BAGS',
            UnitPrice: 1350,
            TotAmt: 20250,
            GstRt: 5,
            Batch: 'DAP-4402',
            ExpDate: '2028-12-31',
          },
        ],
      });

      const draft = parsePurchaseBillQr(jsonPayload);

      assert.strictEqual(draft.source, 'qr');
      assert.strictEqual(draft.supplier?.gstin, '27ABCDE1234F1Z5');
      assert.strictEqual(draft.invoiceNumber, 'INV/2026/0942');
      assert.strictEqual(draft.invoiceDate, '2026-09-15');
      assert.strictEqual(draft.grandTotal, 45000);
      assert.strictEqual(draft.items.length, 2);

      assert.strictEqual(draft.items[0].rawName, 'Urea 46% Nitrogen');
      assert.strictEqual(draft.items[0].quantity, 20);
      assert.strictEqual(draft.items[0].purchasePrice, 1100);
      assert.strictEqual(draft.items[0].gstRate, 5);
      assert.strictEqual(draft.items[0].batchNumber, 'UR-9921');
      assert.strictEqual(draft.items[0].expiryDate, '2028-06-30');

      assert.strictEqual(draft.items[1].rawName, 'DAP 50kg Fertilizer');
      assert.strictEqual(draft.items[1].quantity, 15);
      assert.strictEqual(draft.items[1].purchasePrice, 1350);
    });

    it('parses pipe-separated / key-value e-invoice QR format', () => {
      const kvPayload = `SellerGstin:27AABCM1234A1ZP,DocNo:INV-8834,DocTyp:INV,DocDt:12/09/2026,TotInvVal:15400,ItemCnt:1,MainHsn:380891,Irn:abcd1234efgh5678`;

      const draft = parsePurchaseBillQr(kvPayload);

      assert.strictEqual(draft.source, 'qr');
      assert.strictEqual(draft.supplier?.gstin, '27AABCM1234A1ZP');
      assert.strictEqual(draft.invoiceNumber, 'INV-8834');
      assert.strictEqual(draft.invoiceDate, '2026-09-12');
      assert.strictEqual(draft.grandTotal, 15400);
    });

    it('handles URLs in QR payloads gracefully without failing', () => {
      const urlPayload = 'https://einvoice.gst.gov.in/v1/invoice?irn=a1b2c3d4e5&inv=TAX-9012&date=2026-08-20&tot=32000&seller=27AAACU1234F1ZQ';

      const draft = parsePurchaseBillQr(urlPayload);

      assert.strictEqual(draft.source, 'qr');
      assert.strictEqual(draft.invoiceNumber, 'TAX-9012');
      assert.strictEqual(draft.grandTotal, 32000);
      assert.strictEqual(draft.supplier?.gstin, '27AAACU1234F1ZQ');
    });
  });

  // ─── C, D, E, F, G, H, I, J: OCR Structured Field Extraction ───
  describe('OCR Structured Field Extraction', () => {
    it('extracts supplier, invoice, date, totals and line items from printed bill OCR text', () => {
      const ocrText = `
TAX INVOICE
MAHALAXMI AGRO CHEMICALS & SEEDS
Shop No 14, APMC Market Yard, Pune - 411037
GSTIN: 27AABCM5678K1Z3
Phone: 9822012345

Invoice No: INV-4491
Date: 14/09/2026

Sr.  Item Description             HSN       Qty    Rate    GST%   Amount
-----------------------------------------------------------------------
1.   Chlorpyrifos 20% EC 1Ltr     380891    10     450     18%    4500.00
     Batch: CP-882 Expiry: 08/2028
2.   Roundup Glyphosate 41% 500ml 380893    20     320     18%    6400.00
     Batch: RG-102 Expiry: 12/2027

Subtotal: Rs. 10900.00
CGST 9%: Rs. 981.00
SGST 9%: Rs. 981.00
Grand Total: Rs. 12862.00
`;

      const draft = parsePurchaseBillOcr(ocrText);

      assert.strictEqual(draft.source, 'ocr');
      assert.strictEqual(draft.supplier?.name, 'MAHALAXMI AGRO CHEMICALS & SEEDS');
      assert.strictEqual(draft.supplier?.gstin, '27AABCM5678K1Z3');
      assert.strictEqual(draft.invoiceNumber, 'INV-4491');
      assert.strictEqual(draft.invoiceDate, '2026-09-14');

      assert.strictEqual(draft.subtotal, 10900);
      assert.strictEqual(draft.cgst, 981);
      assert.strictEqual(draft.sgst, 981);
      assert.strictEqual(draft.grandTotal, 12862);

      assert.strictEqual(draft.items.length, 2);
      assert.strictEqual(draft.items[0].rawName, 'Chlorpyrifos 20% EC 1Ltr');
      assert.strictEqual(draft.items[0].quantity, 10);
      assert.strictEqual(draft.items[0].purchasePrice, 450);
      assert.strictEqual(draft.items[0].gstRate, 18);
      assert.strictEqual(draft.items[0].batchNumber, 'CP-882');
      assert.strictEqual(draft.items[0].expiryDate, '2028-08-01');

      assert.strictEqual(draft.items[1].rawName, 'Roundup Glyphosate 41% 500ml');
      assert.strictEqual(draft.items[1].quantity, 20);
      assert.strictEqual(draft.items[1].purchasePrice, 320);
      assert.strictEqual(draft.items[1].batchNumber, 'RG-102');
      assert.strictEqual(draft.items[1].expiryDate, '2027-12-01');
    });

    it('extracts table rows formatted with tab or pipe delimiters', () => {
      const ocrText = `
SUPPLIER: KHEDUT SEEDS CORPORATION
GSTIN: 24AAACK9922P1Z0
BILL NO: 9022
DATE: 2026-09-10

ITEM | QTY | RATE | GST
Cotton Seeds Hybrid BG-II | 50 | 850 | 5%
Bajra Pioneer Seeds 1.5kg | 30 | 420 | 5%

TOTAL: 55100
`;

      const draft = parsePurchaseBillOcr(ocrText);

      assert.strictEqual(draft.supplier?.name, 'KHEDUT SEEDS CORPORATION');
      assert.strictEqual(draft.invoiceNumber, '9022');
      assert.strictEqual(draft.invoiceDate, '2026-09-10');
      assert.strictEqual(draft.items.length, 2);
      assert.strictEqual(draft.items[0].rawName, 'Cotton Seeds Hybrid BG-II');
      assert.strictEqual(draft.items[0].quantity, 50);
      assert.strictEqual(draft.items[0].purchasePrice, 850);
      assert.strictEqual(draft.items[1].rawName, 'Bajra Pioneer Seeds 1.5kg');
      assert.strictEqual(draft.items[1].quantity, 30);
      assert.strictEqual(draft.items[1].purchasePrice, 420);
    });
  });

  // ─── K: Conservative Catalog Matching ───
  describe('Conservative Catalog Matching', () => {
    const mockProducts = [
      { id: 'p1', name: 'Urea 46% Fertilizer', sku: 'FERT-001', unit: 'BAGS', gst_rate: 5, selling_price: 1200 },
      { id: 'p2', name: 'Chlorpyrifos 20% EC 1Ltr', sku: 'PEST-002', unit: 'Bottle', gst_rate: 18, selling_price: 550 },
      { id: 'p3', name: 'DAP 50kg', sku: 'FERT-003', unit: 'BAGS', gst_rate: 5, selling_price: 1450 },
    ];

    const mockSuppliers = [
      { id: 's1', name: 'Mahalaxmi Agro Chemicals & Seeds', gstin: '27AABCM5678K1Z3' },
      { id: 's2', name: 'National Fertilizers Ltd', gstin: '07AAACN1234F1ZQ' },
    ];

    it('matches exact and high-confidence product names, but marks ambiguous ones as unmatched', () => {
      const rawDraft: PurchaseDraftResult = {
        source: 'ocr',
        supplier: { name: 'Mahalaxmi Agro Chemicals & Seeds', isMatched: false },
        items: [
          { rawName: 'Chlorpyrifos 20% EC 1Ltr', isMatched: false, unit: 'Bottle', quantity: 10, purchasePrice: 450, gstRate: 18 },
          { rawName: 'Random Unknown Fungicide XYZ 250gm', isMatched: false, unit: 'Box', quantity: 5, purchasePrice: 200, gstRate: 12 },
        ],
        uncertainFields: [],
      };

      const matchedDraft = matchDraftAgainstCatalog(rawDraft, mockProducts, mockSuppliers);

      // Supplier matched
      assert.strictEqual(matchedDraft.supplier?.isMatched, true);
      assert.strictEqual(matchedDraft.supplier?.id, 's1');

      // First item matched
      assert.strictEqual(matchedDraft.items[0].isMatched, true);
      assert.strictEqual(matchedDraft.items[0].matchedProductId, 'p2');
      assert.strictEqual(matchedDraft.items[0].matchedProductName, 'Chlorpyrifos 20% EC 1Ltr');

      // Second item not matched
      assert.strictEqual(matchedDraft.items[1].isMatched, false);
      assert.strictEqual(matchedDraft.items[1].matchedProductId, undefined);
    });

    it('matches supplier by GSTIN if name differs slightly', () => {
      const rawDraft: PurchaseDraftResult = {
        source: 'qr',
        supplier: { name: 'Mahalaxmi Traders', gstin: '27AABCM5678K1Z3', isMatched: false },
        items: [],
        uncertainFields: [],
      };

      const matchedDraft = matchDraftAgainstCatalog(rawDraft, mockProducts, mockSuppliers);
      assert.strictEqual(matchedDraft.supplier?.isMatched, true);
      assert.strictEqual(matchedDraft.supplier?.id, 's1');
    });
  });

  // ─── L & M: Editable Draft & No Auto-Save Invariant ───
  describe('Editable Draft Generation & Invariants', () => {
    it('produces an editable structure with all numeric & string fields modifiable', () => {
      const draft = parsePurchaseBillOcr('Invoice No: 123 Date: 01/09/2026 Total: 5000');

      assert.ok(typeof draft === 'object');
      assert.ok(Array.isArray(draft.items));
      assert.strictEqual(draft.invoiceNumber, '123');

      // Modifying draft fields does not throw
      draft.invoiceNumber = '123-MODIFIED';
      draft.items.push({
        rawName: 'Manually Added Item',
        isMatched: false,
        unit: 'Piece',
        quantity: 1,
        purchasePrice: 100,
        gstRate: 18,
      });

      assert.strictEqual(draft.invoiceNumber, '123-MODIFIED');
      assert.strictEqual(draft.items.length, 1);
    });
  });

  // ─── N, O, P, Q: Fallback, Incomplete Data & Malformed Handling ───
  describe('Robust Error Handling & Fallbacks', () => {
    it('handles empty or malformed strings gracefully without crashing', () => {
      const draftEmpty = parsePurchaseBillOcr('');
      assert.strictEqual(draftEmpty.source, 'ocr');
      assert.strictEqual(draftEmpty.items.length, 0);

      const draftGarbage = parsePurchaseBillQr('???###%%%!!!');
      assert.strictEqual(draftGarbage.source, 'qr');
      assert.strictEqual(draftGarbage.items.length, 0);
    });

    it('handles QR payload with only partial data safely', () => {
      const partialQr = 'DocNo:INV-5544';
      const draft = parsePurchaseBillQr(partialQr);

      assert.strictEqual(draft.invoiceNumber, 'INV-5544');
      assert.strictEqual(draft.items.length, 0);
      assert.ok(draft.uncertainFields.includes('supplier_not_found'));
    });
  });
});
