'use client';

import React, { useState, useEffect, useCallback, useId } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  ArrowLeft, Plus, Trash2, Search, Package, Building2, Calendar, 
  Receipt, CreditCard, AlertCircle, Check, Loader2, Sparkles, Layers
} from 'lucide-react';
import Link from 'next/link';
import { formatCurrency, generateId } from '@/lib/utils';
import { getSuppliersAction } from '@/actions/suppliers';
import { searchProductsAction } from '@/actions/products';
import { getBatchesAction } from '@/actions/inventory';
import { completePurchaseAction } from '@/actions/purchases';
import { isClientDemoMode, getDemoProductsClient } from '@/lib/client-demo-store';

interface PurchaseItemRow {
  rowId: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  batchId?: string;
  batchNumber: string;
  isNewBatch: boolean;
  manufacturingDate: string;
  expiryDate: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  gstRate: number;
  existingBatches: any[];
}

export default function NewPurchasePage() {
  const router = useRouter();

  // Suppliers state
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Catalog products for search
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [activeProductSearchRow, setActiveProductSearchRow] = useState<string | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // Items in purchase
  const [items, setItems] = useState<PurchaseItemRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load suppliers and initial products
  const loadInitialData = useCallback(async () => {
    try {
      if (isClientDemoMode()) {
        setSuppliers([
          { id: 'supp-1', name: 'Mahyco Seeds Ltd', phone: '9876543210' },
          { id: 'supp-2', name: 'Bayer CropScience', phone: '9822334455' },
          { id: 'supp-3', name: 'UPL Agro Ltd', phone: '9890123456' },
        ]);
        const demoProds = getDemoProductsClient();
        setCatalogProducts(demoProds);
        return;
      }

      const [suppRes, prodRes] = await Promise.all([
        getSuppliersAction({ limit: 100 }),
        searchProductsAction('')
      ]);

      if (suppRes.success && suppRes.data?.suppliers) {
        setSuppliers(suppRes.data.suppliers);
      }
      if (prodRes.success && Array.isArray(prodRes.data)) {
        setCatalogProducts(prodRes.data);
      }
    } catch (err) {
      console.error('Failed to load initial purchase data:', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Add an empty purchase line
  const handleAddItem = () => {
    const newRow: PurchaseItemRow = {
      rowId: generateId(),
      productId: '',
      productName: '',
      sku: '',
      unit: 'Piece',
      batchId: undefined,
      batchNumber: '',
      isNewBatch: true,
      manufacturingDate: '',
      expiryDate: '',
      quantity: 1,
      purchasePrice: 0,
      sellingPrice: 0,
      gstRate: 0,
      existingBatches: [],
    };
    setItems(prev => [...prev, newRow]);
  };

  // Ensure at least one item on start
  useEffect(() => {
    if (items.length === 0) {
      handleAddItem();
    }
  }, [items.length]);

  const handleRemoveItem = (rowId: string) => {
    if (items.length > 1) {
      setItems(prev => prev.filter(i => i.rowId !== rowId));
    } else {
      // Clear the single row
      setItems([{
        rowId: generateId(),
        productId: '',
        productName: '',
        sku: '',
        unit: 'Piece',
        batchId: undefined,
        batchNumber: '',
        isNewBatch: true,
        manufacturingDate: '',
        expiryDate: '',
        quantity: 1,
        purchasePrice: 0,
        sellingPrice: 0,
        gstRate: 0,
        existingBatches: [],
      }]);
    }
  };

  // Select an existing product for a row
  const handleSelectProduct = async (rowId: string, product: any) => {
    let batches: any[] = product.batches || [];
    if (!batches.length && product.id) {
      try {
        const batchRes = await getBatchesAction(product.id);
        if (batchRes.success && Array.isArray(batchRes.data)) {
          batches = batchRes.data;
        }
      } catch (err) {
        console.warn('Failed to fetch batches for product:', err);
      }
    }

    setItems(prev => prev.map(item => {
      if (item.rowId !== rowId) return item;

      // Check if product has any existing batches
      const hasBatches = batches && batches.length > 0;
      const firstBatch = hasBatches ? batches[0] : null;

      return {
        ...item,
        productId: product.id,
        productName: product.name,
        sku: product.sku || '',
        unit: product.unit || 'Piece',
        batchId: firstBatch ? firstBatch.id : undefined,
        batchNumber: firstBatch ? (firstBatch.batch_number || '') : '',
        isNewBatch: !hasBatches,
        manufacturingDate: firstBatch?.manufacturing_date ? firstBatch.manufacturing_date.split('T')[0] : '',
        expiryDate: firstBatch?.expiry_date ? firstBatch.expiry_date.split('T')[0] : '',
        purchasePrice: Number(product.purchase_price || firstBatch?.purchase_price || 0),
        sellingPrice: Number(product.selling_price || firstBatch?.selling_price || 0),
        gstRate: Number(product.gst_rate || 0),
        existingBatches: batches,
      };
    }));

    setActiveProductSearchRow(null);
    setProductSearchQuery('');
  };

  // Handle batch selection for a row (existing batch vs new batch)
  const handleBatchChange = (rowId: string, value: string) => {
    setItems(prev => prev.map(item => {
      if (item.rowId !== rowId) return item;

      if (value === '__NEW__') {
        return {
          ...item,
          batchId: undefined,
          batchNumber: '',
          isNewBatch: true,
          expiryDate: '',
          manufacturingDate: '',
        };
      }

      // Existing batch selected
      const selectedBatch = item.existingBatches.find(b => b.id === value || b.batch_number === value);
      if (selectedBatch) {
        return {
          ...item,
          batchId: selectedBatch.id,
          batchNumber: selectedBatch.batch_number || '',
          isNewBatch: false,
          expiryDate: selectedBatch.expiry_date ? selectedBatch.expiry_date.split('T')[0] : item.expiryDate,
          manufacturingDate: selectedBatch.manufacturing_date ? selectedBatch.manufacturing_date.split('T')[0] : item.manufacturingDate,
          purchasePrice: Number(selectedBatch.purchase_price ?? item.purchasePrice),
          sellingPrice: Number(selectedBatch.selling_price ?? item.sellingPrice),
        };
      }

      return item;
    }));
  };

  // Update specific field on row
  const handleUpdateItemField = (rowId: string, field: keyof PurchaseItemRow, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.rowId !== rowId) return item;
      return { ...item, [field]: value };
    }));
  };

  // Financial calculations
  const subtotal = items.reduce((acc, item) => {
    const q = Number(item.quantity) || 0;
    const p = Number(item.purchasePrice) || 0;
    return acc + (q * p);
  }, 0);

  const totalTax = items.reduce((acc, item) => {
    const q = Number(item.quantity) || 0;
    const p = Number(item.purchasePrice) || 0;
    const gst = Number(item.gstRate) || 0;
    return acc + (q * p * (gst / 100));
  }, 0);

  const grandTotal = subtotal + totalTax;

  // Selected supplier details
  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSupplierId) {
      toast.error('Please select a supplier for this purchase');
      return;
    }

    const invalidItems = items.filter(i => !i.productId || (Number(i.quantity) || 0) < 1 || (Number(i.purchasePrice) || 0) < 0);
    if (invalidItems.length > 0) {
      toast.error('Please select a valid product, quantity, and rate for all items');
      return;
    }

    // Validate batch info if batch tracking / entered
    for (const it of items) {
      if (it.batchNumber && !it.expiryDate) {
        toast.error(`Please provide an expiry date for batch "${it.batchNumber}"`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = `purch-${Date.now()}-${generateId()}`;

      const payload = {
        supplier_id: selectedSupplierId,
        invoice_number: invoiceNumber.trim() || undefined,
        purchase_date: new Date(purchaseDate),
        notes: notes.trim() || undefined,
        paid_amount: paidAmount === '' ? 0 : Number(paidAmount),
        payment_method: paymentMethod,
        idempotency_key: idempotencyKey,
        items: items.map(it => {
          const qty = Number(it.quantity) || 1;
          const price = Number(it.purchasePrice) || 0;
          const gst = Number(it.gstRate) || 0;
          const itSub = qty * price;
          const itTax = Math.round((itSub * (gst / 100)) * 100) / 100;

          return {
            product_id: it.productId,
            product_name: it.productName,
            batch_id: it.batchId || undefined,
            batch_number: it.batchNumber?.trim() || undefined,
            manufacturing_date: it.manufacturingDate ? new Date(it.manufacturingDate) : undefined,
            expiry_date: it.expiryDate ? new Date(it.expiryDate) : undefined,
            quantity: qty,
            purchase_price: price,
            selling_price: it.sellingPrice > 0 ? Number(it.sellingPrice) : undefined,
            gst_rate: gst,
            gst_amount: itTax,
            total_amount: itSub + itTax,
          };
        }),
      };

      const res = await completePurchaseAction(payload);
      if (res.success) {
        toast.success(res.data?.duplicate ? 'Purchase already recorded (idempotent)' : 'Purchase confirmed & stock updated immediately!');
        const createdId = res.data?.purchase_id || res.data?.id;
        if (createdId) {
          router.push(`/purchases/${createdId}`);
        } else {
          router.push('/purchases');
        }
      } else {
        toast.error(res.error || 'Failed to record purchase');
      }
    } catch (err: any) {
      console.error('Submit purchase error:', err);
      toast.error(err.message || 'Error recording purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-3 sm:p-6 min-w-0">
      {/* ─── Top Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/purchases">
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">New Purchase</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Inward supplier invoice & automatic inventory batch replenishment</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ─── Card 1: Supplier & Bill Meta ─── */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Supplier & Invoice Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Supplier Selector */}
            <div className="space-y-1.5 sm:col-span-1">
              <label className="text-xs font-semibold text-foreground">Supplier *</label>
              <select
                value={selectedSupplierId}
                onChange={e => setSelectedSupplierId(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">-- Select Supplier --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.company ? `(${s.company})` : ''}
                  </option>
                ))}
              </select>
              {selectedSupplier && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  GSTIN: {selectedSupplier.gst_number || 'N/A'} • Outstanding: {formatCurrency(selectedSupplier.outstanding || 0)}
                </p>
              )}
            </div>

            {/* Invoice Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Supplier Bill / Invoice #</label>
              <div className="relative">
                <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-98231"
                  className="pl-9 h-10 text-sm font-mono uppercase"
                />
              </div>
            </div>

            {/* Purchase Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Purchase Date *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                  required
                  className="pl-9 h-10 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Card 2: Purchase Line Items ─── */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> Purchase Items ({items.length})
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="text-primary hover:bg-primary/10 border-primary/30 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Product
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => {
              const lineSubtotal = (Number(item.quantity) || 0) * (Number(item.purchasePrice) || 0);
              const lineTax = lineSubtotal * ((Number(item.gstRate) || 0) / 100);
              const lineTotal = lineSubtotal + lineTax;
              const isSearchActive = activeProductSearchRow === item.rowId;

              return (
                <div 
                  key={item.rowId} 
                  className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3 transition-all hover:border-border"
                >
                  {/* Top Bar of Item Row: Index, Product Name, and Remove */}
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      {item.productId ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm sm:text-base">{item.productName}</span>
                          {item.sku && (
                            <Badge variant="outline" className="font-mono text-[10px]">{item.sku}</Badge>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setActiveProductSearchRow(isSearchActive ? null : item.rowId);
                              setProductSearchQuery('');
                            }}
                            className="h-6 px-2 text-xs text-primary hover:underline"
                          >
                            Change Product
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm font-semibold text-muted-foreground italic">
                          Click to select a product from catalog
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(item.rowId)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      title="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Product Search Picker Drawer / Dropdown */}
                  {(!item.productId || isSearchActive) && (
                    <div className="bg-card border border-primary/40 rounded-xl p-3 shadow-md space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={productSearchQuery}
                          onChange={e => setProductSearchQuery(e.target.value)}
                          placeholder="Search product name, SKU, or barcode..."
                          className="pl-9 h-9 text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-border/40 text-sm">
                        {catalogProducts
                          .filter(p => {
                            if (!productSearchQuery.trim()) return true;
                            const q = productSearchQuery.toLowerCase();
                            return (
                              p.name.toLowerCase().includes(q) ||
                              (p.sku && p.sku.toLowerCase().includes(q)) ||
                              (p.barcode && p.barcode.includes(q))
                            );
                          })
                          .slice(0, 10)
                          .map(prod => (
                            <div
                              key={prod.id}
                              onClick={() => handleSelectProduct(item.rowId, prod)}
                              className="py-2 px-2.5 hover:bg-primary/10 cursor-pointer flex items-center justify-between rounded-md transition-colors"
                            >
                              <div>
                                <p className="font-semibold text-foreground">{prod.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Unit: {prod.unit || 'Piece'} • Stock: {prod.current_stock ?? prod.stock_quantity ?? 0} • Latest Rate: {formatCurrency(prod.purchase_price || 0)}
                                </p>
                              </div>
                              <Badge variant="secondary" className="text-xs">Select</Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Fields: Batch, Expiry, Manufacturing Date, Qty, Rate, MRP, GST */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                    {/* Batch Selection */}
                    <div className="space-y-1 col-span-2 sm:col-span-1 md:col-span-2">
                      <label className="font-semibold text-foreground flex items-center gap-1">
                        <Layers className="h-3 w-3 text-primary" /> Batch
                      </label>
                      {item.existingBatches && item.existingBatches.length > 0 ? (
                        <div className="space-y-1.5">
                          <select
                            value={item.isNewBatch ? '__NEW__' : (item.batchId || item.batchNumber)}
                            onChange={e => handleBatchChange(item.rowId, e.target.value)}
                            className="w-full h-8 px-2 rounded-md border border-border bg-background text-foreground text-xs font-mono"
                          >
                            {item.existingBatches.map(b => (
                              <option key={b.id} value={b.id}>
                                Existing: {b.batch_number} (Avail: {b.quantity_available ?? 0}{b.expiry_date ? `, Exp: ${b.expiry_date.split('T')[0]}` : ''})
                              </option>
                            ))}
                            <option value="__NEW__">+ Create New Batch</option>
                          </select>
                          {item.isNewBatch && (
                            <Input
                              value={item.batchNumber}
                              onChange={e => handleUpdateItemField(item.rowId, 'batchNumber', e.target.value.toUpperCase())}
                              placeholder="New Batch #"
                              className="h-8 text-xs font-mono uppercase"
                            />
                          )}
                        </div>
                      ) : (
                        <Input
                          value={item.batchNumber}
                          onChange={e => handleUpdateItemField(item.rowId, 'batchNumber', e.target.value.toUpperCase())}
                          placeholder="e.g. B2026-01"
                          className="h-8 text-xs font-mono uppercase"
                        />
                      )}
                    </div>

                    {/* Expiry Date */}
                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">Expiry Date *</label>
                      <Input
                        type="date"
                        value={item.expiryDate}
                        onChange={e => handleUpdateItemField(item.rowId, 'expiryDate', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* Quantity */}
                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">Inward Qty *</label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => handleUpdateItemField(item.rowId, 'quantity', Math.max(1, Number(e.target.value) || 1))}
                        className="h-8 text-xs font-bold font-mono"
                      />
                    </div>

                    {/* Purchase Price */}
                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">Purchase Rate (₹) *</label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={item.purchasePrice}
                        onChange={e => handleUpdateItemField(item.rowId, 'purchasePrice', Math.max(0, Number(e.target.value) || 0))}
                        className="h-8 text-xs font-bold font-mono"
                      />
                    </div>

                    {/* Selling Price / MRP */}
                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">Retail MRP (₹)</label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={item.sellingPrice || ''}
                        onChange={e => handleUpdateItemField(item.rowId, 'sellingPrice', Math.max(0, Number(e.target.value) || 0))}
                        placeholder="MRP"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Line Total Calculation Footer */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40 text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span>GST: <strong>{item.gstRate}%</strong></span>
                      <span>Tax: <strong>{formatCurrency(lineTax)}</strong></span>
                    </div>
                    <div>
                      Line Total: <strong className="text-foreground text-sm">{formatCurrency(lineTotal)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ─── Card 3: Summary & Payment ─── */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> Invoice Summary & Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-border">
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Subtotal (Pre-Tax)</span>
                <span className="text-lg font-bold text-foreground">{formatCurrency(subtotal)}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Total GST</span>
                <span className="text-lg font-bold text-foreground">{formatCurrency(totalTax)}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Grand Total Payable</span>
                <span className="text-2xl font-extrabold text-primary">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Paid Upfront (₹)</label>
                <Input
                  type="number"
                  min="0"
                  max={grandTotal}
                  step="any"
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                  placeholder="0.00 (Leave 0 for full credit)"
                  className="h-10 text-sm font-mono font-bold"
                />
                <p className="text-[11px] text-muted-foreground">
                  Remaining balance ({formatCurrency(Math.max(0, grandTotal - (Number(paidAmount) || 0)))}) will be added to supplier ledger.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="BANK_TRANSFER">Bank Transfer / NEFT / RTGS</option>
                  <option value="UPI">UPI / QR</option>
                  <option value="CASH">Cash</option>
                  <option value="CREDIT">Credit (Full Khata)</option>
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Inward Notes (Optional)</label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Transportation details, lorry receipt #, goods condition, remarks..."
                  rows={2}
                  className="text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Submit Actions ─── */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <Link href="/purchases">
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </Link>
          <Button 
            type="submit" 
            disabled={isSubmitting || items.length === 0}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm min-w-36"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Recording...
              </>
            ) : (
              'Confirm Purchase'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
