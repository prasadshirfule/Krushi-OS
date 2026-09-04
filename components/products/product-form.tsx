'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema, ProductInput } from '@/lib/validations';
import { createProductAction, updateProductAction, createBrandAction } from '@/actions/products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { PRODUCT_UNITS, GST_RATES, AGRICULTURAL_TYPES } from '@/lib/constants';
import { MOCK_BRANDS } from '@/lib/mock-data';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { 
  Loader2, 
  ArrowLeft, 
  Package, 
  IndianRupee, 
  Boxes, 
  Sparkles, 
  Plus, 
  Building2, 
  Check, 
  Barcode 
} from 'lucide-react';

import { 
  isClientDemoMode, 
  saveDemoProductClient, 
  updateDemoProductClient,
  getDemoCategoriesClient,
  getDemoBrandsClient,
  saveDemoBrandClient
} from '@/lib/client-demo-store';

interface ProductFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
  categories: any[];
  brands: any[];
}

export function ProductForm({ mode, initialData, categories, brands }: ProductFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available categories
  const availableCategories = (categories && categories.length > 0)
    ? categories
    : (isClientDemoMode() ? getDemoCategoriesClient() : []);

  // Brands / Manufacturers state
  const [brandsList, setBrandsList] = useState<any[]>(() => {
    if (brands && brands.length > 0) return brands;
    if (isClientDemoMode()) return getDemoBrandsClient();
    return MOCK_BRANDS;
  });

  // Modal state for Add New Manufacturer
  const [isAddBrandOpen, setIsAddBrandOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandCompany, setNewBrandCompany] = useState('');
  const [isSavingBrand, setIsSavingBrand] = useState(false);

  // Form Setup
  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: initialData?.name || '',
      category_id: initialData?.category_id || (availableCategories[0]?.id || ''),
      brand_id: initialData?.brand_id || '',
      sku: initialData?.sku || '',
      barcode: initialData?.barcode || '',
      description: initialData?.description || '',
      purchase_price: initialData?.purchase_price ?? 0,
      selling_price: initialData?.selling_price ?? 0,
      wholesale_price: initialData?.wholesale_price ?? 0,
      hsn_code: initialData?.hsn_code || '',
      gst_rate: initialData?.gst_rate ?? 18,
      unit: initialData?.unit || 'Bag',
      min_stock: initialData?.min_stock ?? 5,
      opening_stock: initialData?.current_stock ?? 0,
      batch_tracking: initialData?.batch_tracking ?? false,
      expiry_tracking: initialData?.expiry_tracking ?? false,
      batch_number: initialData?.batch_number || (initialData?.batches?.[0]?.batch_number || ''),
      expiry_date: initialData?.expiry_date || (initialData?.batches?.[0]?.expiry_date || ''),
      product_type: initialData?.product_type || 'Fertilizer',
      active_ingredient: initialData?.active_ingredient || '',
      formulation: initialData?.formulation || '',
      crop: initialData?.crop || '',
      target_pest: initialData?.target_pest || '',
      pack_size: initialData?.pack_size || '',
      licence_number: initialData?.licence_number || '',
    },
  });

  const watchBatchTracking = form.watch('batch_tracking');

  // Sync demo brands on mount and listen to events
  useEffect(() => {
    if (isClientDemoMode()) {
      const demoList = getDemoBrandsClient();
      if (demoList && demoList.length > 0) {
        setBrandsList(demoList);
      }
    }

    const handleBrandsUpdated = (e: any) => {
      if (isClientDemoMode()) {
        setBrandsList(getDemoBrandsClient());
      } else if (e.detail) {
        setBrandsList(prev => {
          if (prev.some(b => b.id === e.detail.id)) return prev;
          return [...prev, e.detail].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        });
      }
    };

    window.addEventListener('krushi-brands-updated', handleBrandsUpdated);
    return () => window.removeEventListener('krushi-brands-updated', handleBrandsUpdated);
  }, []);

  // Handle Add New Manufacturer
  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBrandName.trim();
    if (!trimmed) {
      toast.error('Please enter a manufacturer name');
      return;
    }

    setIsSavingBrand(true);
    try {
      let createdBrand: any = null;

      if (isClientDemoMode()) {
        createdBrand = saveDemoBrandClient({
          name: trimmed,
          manufacturer: newBrandCompany.trim() || trimmed,
        });
        try {
          await createBrandAction({
            name: trimmed,
            manufacturer: newBrandCompany.trim() || trimmed,
          });
        } catch (err) {
          console.warn('Server brand fallback in demo mode:', err);
        }
      } else {
        const res = await createBrandAction({
          name: trimmed,
          manufacturer: newBrandCompany.trim() || trimmed,
        });
        if (res.success) {
          createdBrand = res.data;
        } else {
          throw new Error(res.error || 'Failed to create manufacturer');
        }
      }

      if (!createdBrand) {
        createdBrand = { id: `b-${Date.now()}`, name: trimmed };
      }

      setBrandsList(prev => {
        if (prev.some(b => b.id === createdBrand.id)) return prev;
        return [...prev, createdBrand].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      });

      form.setValue('brand_id', createdBrand.id);
      toast.success(`Manufacturer "${trimmed}" added and selected`);
      setNewBrandName('');
      setNewBrandCompany('');
      setIsAddBrandOpen(false);
    } catch (err: any) {
      console.error('Failed to create brand:', err);
      toast.error(err.message || 'Failed to add manufacturer');
    } finally {
      setIsSavingBrand(false);
    }
  };

  // Submit product create / update
  const onSubmit = async (data: ProductInput) => {
    setIsSubmitting(true);
    try {
      if (isClientDemoMode()) {
        if (mode === 'create') {
          saveDemoProductClient(data);
        } else {
          updateDemoProductClient(initialData.id, data);
        }
        try {
          if (mode === 'create') {
            await createProductAction(data);
          } else {
            await updateProductAction(initialData.id, data);
          }
        } catch (e) {
          console.warn('Server action fallback in demo mode:', e);
        }

        toast.success(`Product ${mode === 'create' ? 'created' : 'updated'} successfully!`);
        router.push('/products');
        router.refresh();
        return;
      }

      let result;
      if (mode === 'create') {
        result = await createProductAction(data);
      } else {
        result = await updateProductAction(initialData.id, data);
      }

      if (result.success) {
        toast.success(`Product ${mode === 'create' ? 'created' : 'updated'} successfully!`);
        router.push('/products');
        router.refresh();
      } else {
        toast.error(result.error || `Failed to ${mode} product`);
      }
    } catch (error: any) {
      console.error("Product submit error:", error);
      toast.error(error.message || "An unexpected error occurred while saving product");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-5xl mx-auto pb-24">
        {/* ─── Page Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => router.back()}
              className="h-10 w-10 border-border hover:bg-muted shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {mode === 'create' ? 'Add New Product' : `Edit Product: ${initialData?.name}`}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Simple one-page product entry for agricultural stock, pricing, and tax
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <Button type="button" variant="outline" onClick={() => router.back()} className="px-5 font-semibold">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 shadow-sm"
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><Check className="mr-2 h-4 w-4 stroke-[3]" /> {mode === 'create' ? 'Save Product' : 'Update Product'}</>
              )}
            </Button>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════
            SECTION 1: PRODUCT DETAILS
        ═════════════════════════════════════════════════════════ */}
        <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-foreground">Product Details</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Product name, category, manufacturer, and code identifiers
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 grid gap-6 md:grid-cols-2">
            {/* Product Name (Full Width) */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name" className="text-sm font-semibold text-foreground">
                Product Name <span className="text-destructive font-bold">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. Confidor Insecticide 100ml or DAP Fertilizer 50kg (IFFCO)"
                className="h-11 text-base rounded-lg border-border bg-background"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive font-medium">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category_id" className="text-sm font-semibold text-foreground">
                Category <span className="text-destructive font-bold">*</span>
              </Label>
              <Select
                value={form.watch('category_id')}
                onValueChange={(val) => form.setValue('category_id', val, { shouldValidate: true })}
              >
                <SelectTrigger id="category_id" className="h-11 rounded-lg border-border bg-background text-foreground">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.category_id && (
                <p className="text-xs text-destructive font-medium">{form.formState.errors.category_id.message}</p>
              )}
            </div>

            {/* Manufacturer / Brand with Quick Add */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="brand_id" className="text-sm font-semibold text-foreground">
                  Manufacturer / Brand
                </Label>
                <button
                  type="button"
                  onClick={() => setIsAddBrandOpen(true)}
                  className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 stroke-[3]" /> Add New Manufacturer
                </button>
              </div>
              <Select
                value={form.watch('brand_id') || '__none__'}
                onValueChange={(val) => {
                  if (val === '__add_new__') {
                    setIsAddBrandOpen(true);
                  } else if (val === '__none__') {
                    form.setValue('brand_id', null);
                  } else {
                    form.setValue('brand_id', val);
                  }
                }}
              >
                <SelectTrigger id="brand_id" className="h-11 rounded-lg border-border bg-background text-foreground">
                  <SelectValue placeholder="Select Manufacturer (Optional)" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__none__" className="text-muted-foreground font-normal">
                    -- No Manufacturer / Generic --
                  </SelectItem>
                  <div className="px-2 py-1.5 border-y border-border my-1 bg-muted/20">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAddBrandOpen(true);
                      }}
                      className="w-full text-left text-xs font-bold text-primary hover:underline flex items-center gap-1.5 py-1"
                    >
                      <Plus className="h-3.5 w-3.5 stroke-[3]" /> + Add New Manufacturer
                    </button>
                  </div>
                  {brandsList.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* SKU / Product Code */}
            <div className="space-y-2">
              <Label htmlFor="sku" className="text-sm font-semibold text-foreground">
                SKU / Product Code
              </Label>
              <Input
                id="sku"
                placeholder="e.g. FERT-DAP-50"
                className="h-11 rounded-lg border-border bg-background font-mono text-sm"
                {...form.register('sku')}
              />
            </div>

            {/* Barcode */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="barcode" className="text-sm font-semibold text-foreground">
                  Barcode
                </Label>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Barcode className="h-3 w-3" /> Quick scan supported
                </span>
              </div>
              <Input
                id="barcode"
                placeholder="Scan or enter barcode number"
                className="h-11 rounded-lg border-border bg-background font-mono text-sm"
                {...form.register('barcode')}
              />
            </div>

            {/* Description (Full Width) */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description" className="text-sm font-semibold text-foreground">
                Description / Notes
              </Label>
              <Textarea
                id="description"
                placeholder="Product description, recommended usage, handling warnings..."
                rows={3}
                className="rounded-lg border-border bg-background resize-none"
                {...form.register('description')}
              />
            </div>
          </CardContent>
        </Card>

        {/* ═════════════════════════════════════════════════════════
            SECTION 2: PRICING & TAX
        ═════════════════════════════════════════════════════════ */}
        <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <IndianRupee className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-foreground">Pricing & Tax</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Purchase cost, retail selling price, MRP, and GST rate
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Purchase Price */}
            <div className="space-y-2">
              <Label htmlFor="purchase_price" className="text-sm font-semibold text-foreground">
                Purchase Cost (₹)
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">₹</span>
                <Input
                  id="purchase_price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="pl-8 h-11 text-base rounded-lg border-border bg-background"
                  {...form.register('purchase_price')}
                />
              </div>
              {form.formState.errors.purchase_price && (
                <p className="text-xs text-destructive font-medium">{form.formState.errors.purchase_price.message}</p>
              )}
            </div>

            {/* Selling Price (Required) */}
            <div className="space-y-2">
              <Label htmlFor="selling_price" className="text-sm font-semibold text-foreground">
                Selling Price (₹) <span className="text-destructive font-bold">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary font-bold text-base">₹</span>
                <Input
                  id="selling_price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="pl-8 h-11 text-base font-bold text-primary rounded-lg border-primary/40 bg-primary/5 focus-visible:border-primary"
                  {...form.register('selling_price')}
                />
              </div>
              {form.formState.errors.selling_price && (
                <p className="text-xs text-destructive font-medium">{form.formState.errors.selling_price.message}</p>
              )}
            </div>

            {/* MRP / Wholesale Price */}
            <div className="space-y-2">
              <Label htmlFor="wholesale_price" className="text-sm font-semibold text-foreground">
                MRP / Max Retail Price (₹)
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">₹</span>
                <Input
                  id="wholesale_price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="pl-8 h-11 text-base rounded-lg border-border bg-background"
                  {...form.register('wholesale_price')}
                />
              </div>
            </div>

            {/* GST Rate */}
            <div className="space-y-2">
              <Label htmlFor="gst_rate" className="text-sm font-semibold text-foreground">
                GST Rate (%)
              </Label>
              <Select
                value={String(form.watch('gst_rate'))}
                onValueChange={(val) => form.setValue('gst_rate', Number(val))}
              >
                <SelectTrigger id="gst_rate" className="h-11 rounded-lg border-border bg-background text-foreground">
                  <SelectValue placeholder="Select GST Rate" />
                </SelectTrigger>
                <SelectContent>
                  {GST_RATES.map((rate) => (
                    <SelectItem key={rate} value={String(rate)}>{rate}% GST</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* HSN Code */}
            <div className="space-y-2">
              <Label htmlFor="hsn_code" className="text-sm font-semibold text-foreground">
                HSN Code
              </Label>
              <Input
                id="hsn_code"
                placeholder="e.g. 3808 (Pesticide) / 3102 (Fertilizer)"
                className="h-11 rounded-lg border-border bg-background font-mono text-sm"
                {...form.register('hsn_code')}
              />
            </div>
          </CardContent>
        </Card>

        {/* ═════════════════════════════════════════════════════════
            SECTION 3: INVENTORY & STOCK
        ═════════════════════════════════════════════════════════ */}
        <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-foreground">Inventory & Stock</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Unit of measurement, stock reorder alerts, and optional batch tracking
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Unit of Measurement */}
              <div className="space-y-2">
                <Label htmlFor="unit" className="text-sm font-semibold text-foreground">
                  Unit of Measurement <span className="text-destructive font-bold">*</span>
                </Label>
                <Select
                  value={form.watch('unit')}
                  onValueChange={(val) => form.setValue('unit', val, { shouldValidate: true })}
                >
                  <SelectTrigger id="unit" className="h-11 rounded-lg border-border bg-background text-foreground">
                    <SelectValue placeholder="Select Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_UNITS.map((u: any) => {
                      const val = typeof u === 'string' ? u : u.value;
                      const lbl = typeof u === 'string' ? u : u.label;
                      return <SelectItem key={val} value={val}>{lbl}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                {form.formState.errors.unit && (
                  <p className="text-xs text-destructive font-medium">{form.formState.errors.unit.message}</p>
                )}
              </div>

              {/* Minimum Stock Level */}
              <div className="space-y-2">
                <Label htmlFor="min_stock" className="text-sm font-semibold text-foreground">
                  Minimum Stock Alert Level
                </Label>
                <Input
                  id="min_stock"
                  type="number"
                  min="0"
                  placeholder="e.g. 5"
                  className="h-11 rounded-lg border-border bg-background"
                  {...form.register('min_stock')}
                />
                <p className="text-[11px] text-muted-foreground">Alerts when stock is at or below this amount</p>
              </div>

              {/* Opening Stock (Create Mode) */}
              {mode === 'create' && (
                <div className="space-y-2">
                  <Label htmlFor="opening_stock" className="text-sm font-semibold text-foreground">
                    Opening Stock Quantity
                  </Label>
                  <Input
                    id="opening_stock"
                    type="number"
                    min="0"
                    placeholder="e.g. 50"
                    className="h-11 rounded-lg border-border bg-background"
                    {...form.register('opening_stock')}
                  />
                  <p className="text-[11px] text-muted-foreground">Initial stock available in shop</p>
                </div>
              )}
            </div>

            {/* Batch & Expiry Tracking Box */}
            <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-foreground">Enable Batch & Expiry Tracking</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Recommended for pesticides, seeds, and agrochemicals requiring batch tracking and expiry monitoring
                  </p>
                </div>
                <Switch
                  checked={Boolean(watchBatchTracking)}
                  onCheckedChange={(checked) => {
                    form.setValue('batch_tracking', checked);
                    form.setValue('expiry_tracking', checked);
                  }}
                />
              </div>

              {watchBatchTracking && (
                <div className="grid gap-4 sm:grid-cols-2 pt-3 border-t border-border/60">
                  <div className="space-y-2">
                    <Label htmlFor="batch_number" className="text-xs font-semibold text-foreground">
                      Batch Number {mode === 'create' ? '(Optional)' : ''}
                    </Label>
                    <Input
                      id="batch_number"
                      placeholder="e.g. BATCH-2026-01"
                      className="h-10 rounded-lg border-border bg-background font-mono text-sm"
                      {...form.register('batch_number')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiry_date" className="text-xs font-semibold text-foreground">
                      Expiry Date {mode === 'create' ? '(Optional)' : ''}
                    </Label>
                    <Input
                      id="expiry_date"
                      type="date"
                      className="h-10 rounded-lg border-border bg-background text-sm"
                      {...form.register('expiry_date')}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ═════════════════════════════════════════════════════════
            SECTION 4: AGRICULTURAL INFORMATION
        ═════════════════════════════════════════════════════════ */}
        <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-foreground">Agricultural Information</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Crop suitability, active ingredients, dosage recommendations, and licence details
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 grid gap-6 sm:grid-cols-2">
            {/* Product Type */}
            <div className="space-y-2">
              <Label htmlFor="product_type" className="text-sm font-semibold text-foreground">
                Product Type
              </Label>
              <Select
                value={form.watch('product_type') || 'Fertilizer'}
                onValueChange={(val) => form.setValue('product_type', val)}
              >
                <SelectTrigger id="product_type" className="h-11 rounded-lg border-border bg-background text-foreground">
                  <SelectValue placeholder="Select Product Type" />
                </SelectTrigger>
                <SelectContent>
                  {AGRICULTURAL_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Crops */}
            <div className="space-y-2">
              <Label htmlFor="crop" className="text-sm font-semibold text-foreground">
                Crop / Usage (Target Crops)
              </Label>
              <Input
                id="crop"
                placeholder="e.g. Cotton, Soybean, Wheat, Rice, Sugarcane"
                className="h-11 rounded-lg border-border bg-background"
                {...form.register('crop')}
              />
            </div>

            {/* Dosage & Target Pest */}
            <div className="space-y-2">
              <Label htmlFor="target_pest" className="text-sm font-semibold text-foreground">
                Dosage / Target Pest / Instructions
              </Label>
              <Input
                id="target_pest"
                placeholder="e.g. 2ml per Litre of water / Stem Borer, Aphids"
                className="h-11 rounded-lg border-border bg-background"
                {...form.register('target_pest')}
              />
            </div>

            {/* Active Ingredient */}
            <div className="space-y-2">
              <Label htmlFor="active_ingredient" className="text-sm font-semibold text-foreground">
                Active Ingredient / Technical Name
              </Label>
              <Input
                id="active_ingredient"
                placeholder="e.g. Chlorpyrifos 20% EC or Imidacloprid 17.8% SL"
                className="h-11 rounded-lg border-border bg-background"
                {...form.register('active_ingredient')}
              />
            </div>

            {/* Formulation Type */}
            <div className="space-y-2">
              <Label htmlFor="formulation" className="text-sm font-semibold text-foreground">
                Formulation Type
              </Label>
              <Input
                id="formulation"
                placeholder="e.g. EC, WP, SL, GR, SC, Granules"
                className="h-11 rounded-lg border-border bg-background"
                {...form.register('formulation')}
              />
            </div>

            {/* Pack Size */}
            <div className="space-y-2">
              <Label htmlFor="pack_size" className="text-sm font-semibold text-foreground">
                Pack Size
              </Label>
              <Input
                id="pack_size"
                placeholder="e.g. 100ml, 500ml, 1 Kg, 50 Kg Bag"
                className="h-11 rounded-lg border-border bg-background"
                {...form.register('pack_size')}
              />
            </div>

            {/* CIB Registration / Licence Number (Full Width) */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="licence_number" className="text-sm font-semibold text-foreground">
                CIB Registration / Licence Number
              </Label>
              <Input
                id="licence_number"
                placeholder="e.g. CIR-12345/2025/Fertilizer or CIB-89012"
                className="h-11 rounded-lg border-border bg-background font-mono text-sm"
                {...form.register('licence_number')}
              />
            </div>
          </CardContent>
        </Card>

        {/* ═════════════════════════════════════════════════════════
            STICKY BOTTOM ACTION BAR
        ═════════════════════════════════════════════════════════ */}
        <div className="sticky bottom-0 z-20 bg-background/95 backdrop-blur border-t border-border p-4 rounded-xl shadow-lg flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => router.back()}
            className="px-6 font-semibold border-border hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 h-12 text-base shadow-md transition-all active:scale-95"
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving Product...</>
            ) : (
              <><Check className="mr-2 h-5 w-5 stroke-[3]" /> {mode === 'create' ? 'SAVE PRODUCT' : 'UPDATE PRODUCT'}</>
            )}
          </Button>
        </div>
      </form>

      {/* ═════════════════════════════════════════════════════════
          MODAL: ADD NEW MANUFACTURER / BRAND
      ═════════════════════════════════════════════════════════ */}
      <Dialog open={isAddBrandOpen} onOpenChange={setIsAddBrandOpen}>
        <DialogContent className="sm:max-w-md border-border bg-card text-card-foreground">
          <form onSubmit={handleCreateBrand}>
            <DialogHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Building2 className="h-4 w-4" />
                </div>
                <DialogTitle className="text-lg font-bold">Add New Manufacturer</DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Add an agricultural brand or company name. It will immediately appear in your manufacturer list.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newBrandName" className="text-sm font-semibold">
                  Manufacturer / Brand Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="newBrandName"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="e.g. Krushi Chemicals, Tata Rallis, Kaveri"
                  autoFocus
                  required
                  className="h-11 rounded-lg border-border bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newBrandCompany" className="text-sm font-semibold">
                  Company / Organization (Optional)
                </Label>
                <Input
                  id="newBrandCompany"
                  value={newBrandCompany}
                  onChange={(e) => setNewBrandCompany(e.target.value)}
                  placeholder="e.g. Krushi Agro Chemicals Pvt Ltd"
                  className="h-11 rounded-lg border-border bg-background"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddBrandOpen(false)}
                disabled={isSavingBrand}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingBrand || !newBrandName.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {isSavingBrand ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...</>
                ) : (
                  'Add Manufacturer'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
