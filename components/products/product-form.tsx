'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  productSchema, 
  ProductInput, 
  formatDDMMYYYYtoDB, 
  formatToDDMMYYYY,
  parseProductSize,
  formatProductPackDisplay
} from '@/lib/validations';
import { createProductAction, updateProductAction, createBrandAction, createCategoryAction } from '@/actions/products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { PRODUCT_SIZE_UNITS, GST_RATES } from '@/lib/constants';
import { MOCK_BRANDS, MOCK_CATEGORIES } from '@/lib/mock-data';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { 
  Loader2, 
  ArrowLeft, 
  Package, 
  IndianRupee, 
  Boxes, 
  Plus, 
  Building2, 
  Check, 
  Calendar,
  Grid3X3,
  Scan,
  CheckCircle2,
  Trash2,
  QrCode,
  Barcode,
  Link2
} from 'lucide-react';
import { LinkProductBarcodeModal } from '@/components/scanner/link-product-barcode-modal';

import { 
  isClientDemoMode, 
  saveDemoProductClient, 
  updateDemoProductClient,
  getDemoCategoriesClient,
  saveDemoCategoryClient,
  getDemoBrandsClient,
  saveDemoBrandClient
} from '@/lib/client-demo-store';

import { useLanguage } from '@/lib/i18n';

interface ProductFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
  categories: any[];
  brands: any[];
}

export interface LinkedIdentifierItem {
  id?: string;
  identifier_type: 'barcode' | 'gtin' | 'qr' | 'other';
  raw_value: string;
  normalized_value?: string | null;
  is_primary: boolean;
}

export function ProductForm({ mode, initialData, categories, brands }: ProductFormProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Categories state
  const [categoriesList, setCategoriesList] = useState<any[]>(() => {
    if (categories && Array.isArray(categories) && categories.length > 0) return categories;
    if (isClientDemoMode()) return getDemoCategoriesClient();
    return Array.isArray(categories) ? categories : [];
  });

  // Modal state for Add New Category
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Brands / Manufacturers state
  const [brandsList, setBrandsList] = useState<any[]>(() => {
    if (brands && Array.isArray(brands) && brands.length > 0) return brands;
    if (isClientDemoMode()) return getDemoBrandsClient();
    return Array.isArray(brands) ? brands : [];
  });

  // Modal state for Add New Manufacturer
  const [isAddBrandOpen, setIsAddBrandOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandCompany, setNewBrandCompany] = useState('');
  const [isSavingBrand, setIsSavingBrand] = useState(false);

  // Linked QR / Barcode Identifiers State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [linkedIdentifiers, setLinkedIdentifiers] = useState<LinkedIdentifierItem[]>(() => {
    if (initialData?.identifiers && Array.isArray(initialData.identifiers) && initialData.identifiers.length > 0) {
      return initialData.identifiers.map((item: any) => ({
        id: item.id,
        identifier_type: item.identifier_type || 'barcode',
        raw_value: item.raw_value,
        normalized_value: item.normalized_value || null,
        is_primary: Boolean(item.is_primary),
      }));
    }
    if (initialData?.barcode && String(initialData.barcode).trim()) {
      return [{
        identifier_type: 'barcode',
        raw_value: String(initialData.barcode).trim(),
        normalized_value: String(initialData.barcode).trim(),
        is_primary: true,
      }];
    }
    return [];
  });

  // Link identifier handler (no autofill, pure registration)
  const handleLinkIdentifier = (ident: {
    raw_value: string;
    normalized_value?: string | null;
    identifier_type: 'barcode' | 'gtin' | 'qr' | 'other';
    is_primary?: boolean;
  }) => {
    const rawTrimmed = ident.raw_value.trim();
    setLinkedIdentifiers((prev) => {
      const exists = prev.some((item) => item.raw_value.trim() === rawTrimmed);
      if (exists) {
        toast.info('This QR/Barcode is already linked to this product');
        return prev;
      }
      const isFirst = prev.length === 0;
      const next: LinkedIdentifierItem[] = [
        ...prev,
        {
          identifier_type: ident.identifier_type,
          raw_value: rawTrimmed,
          normalized_value: ident.normalized_value?.trim() || null,
          is_primary: isFirst,
        },
      ];

      // Also set primary barcode field if currently blank for backward compatibility
      if (!form.getValues('barcode')) {
        form.setValue('barcode', ident.normalized_value || rawTrimmed);
      }

      return next;
    });
    toast.success('QR / Barcode linked ✓');
  };

  const handleRemoveIdentifier = (indexToRemove: number) => {
    setLinkedIdentifiers((prev) => {
      const next = prev.filter((_, idx) => idx !== indexToRemove);
      if (next.length > 0 && !next.some((i) => i.is_primary)) {
        next[0].is_primary = true;
      }
      return next;
    });
    toast.info('Identifier unlinked');
  };

  // Parse existing product size safely
  const parsedInitial = parseProductSize(initialData?.pack_size, initialData?.unit);
  const initialSizeValue = mode === 'create'
    ? ('' as any)
    : (initialData?.product_size_value !== undefined && initialData?.product_size_value !== null
      ? (initialData.product_size_value === '' ? null : Number(initialData.product_size_value))
      : parsedInitial.sizeValue);
  const initialSizeUnit = initialData?.product_size_unit || parsedInitial.sizeUnit || 'KG';

  const initialBatch = initialData?.batches?.[0];
  const initialBatchNumber = initialData?.batch_number || initialBatch?.batch_number || '';
  const rawInitialExpiry = initialData?.expiry_date || initialBatch?.expiry_date || initialBatch?.exp_date || '';
  const initialExpiryFormatted = formatToDDMMYYYY(rawInitialExpiry);
  const initialStock = mode === 'create'
    ? ('' as any)
    : (initialData?.current_stock ?? initialData?.stock_quantity ?? initialData?.opening_stock ?? initialBatch?.quantity_available ?? 0);
  const initialMinStock = mode === 'create'
    ? 5
    : (initialData?.min_stock !== undefined && initialData?.min_stock !== null ? Number(initialData.min_stock) : 5);

  // Form Setup: Empty default category for safety
  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: initialData?.name || '',
      category_id: initialData?.category_id || '',
      brand_id: initialData?.brand_id || '',
      sku: initialData?.sku || '',
      barcode: initialData?.barcode || '',
      purchase_price: initialData?.purchase_price !== undefined && initialData?.purchase_price !== null ? Number(initialData.purchase_price) : (mode === 'edit' ? 0 : (undefined as unknown as number)),
      selling_price: initialData?.selling_price !== undefined && initialData?.selling_price !== null && Number(initialData.selling_price) > 0 ? Number(initialData.selling_price) : (mode === 'edit' ? Number(initialData?.selling_price || 0) : (undefined as unknown as number)),
      wholesale_price: initialData?.wholesale_price ?? initialData?.mrp ?? null,
      hsn_code: initialData?.hsn_code || '',
      gst_rate: initialData?.gst_rate ?? 18,
      unit: initialData?.unit || 'Piece',
      product_size_value: initialSizeValue,
      product_size_unit: initialSizeUnit,
      pack_size: initialData?.pack_size || (initialSizeValue ? `${initialSizeValue} ${initialSizeUnit}` : ''),
      min_stock: initialMinStock,
      opening_stock: initialStock,
      batch_tracking: true,
      expiry_tracking: true,
      batch_number: initialBatchNumber,
      expiry_date: initialExpiryFormatted,
      product_type: initialData?.product_type || '',
      active_ingredient: initialData?.active_ingredient || '',
      formulation: initialData?.formulation || '',
      crop: initialData?.crop || '',
      target_pest: initialData?.target_pest || '',
      licence_number: initialData?.licence_number || '',
      identifiers: [],
    },
  });

  // Handle formatted typing for Expiry Date (DD/MM/YYYY)
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    const prevVal = form.getValues('expiry_date') || '';
    
    // Allow user to backspace freely
    if (inputVal.length < prevVal.length) {
      form.setValue('expiry_date', inputVal, { shouldValidate: false });
      return;
    }

    // Extract digits and automatically format with slashes
    const digits = inputVal.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 2 && digits.length <= 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    }
    form.setValue('expiry_date', formatted, { shouldValidate: true });
  };

  // Sync demo categories and brands on mount and listen to events
  useEffect(() => {
    if (isClientDemoMode()) {
      const demoCats = getDemoCategoriesClient();
      if (demoCats && demoCats.length > 0) {
        setCategoriesList(demoCats);
      }
      const demoBrands = getDemoBrandsClient();
      if (demoBrands && demoBrands.length > 0) {
        setBrandsList(demoBrands);
      }
    }

    const handleCategoriesUpdated = (e: any) => {
      if (isClientDemoMode()) {
        setCategoriesList(getDemoCategoriesClient());
      } else if (e.detail) {
        setCategoriesList(prev => {
          if (prev.some(c => c.id === e.detail.id)) return prev;
          return [...prev, e.detail].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        });
      }
    };

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

    window.addEventListener('krushi-categories-updated', handleCategoriesUpdated);
    window.addEventListener('krushi-brands-updated', handleBrandsUpdated);
    return () => {
      window.removeEventListener('krushi-categories-updated', handleCategoriesUpdated);
      window.removeEventListener('krushi-brands-updated', handleBrandsUpdated);
    };
  }, []);

  // Handle Add New Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim().toUpperCase();
    if (!trimmed) {
      toast.error('Please enter a category name');
      return;
    }

    setIsSavingCategory(true);
    try {
      let createdCat: any = null;

      if (isClientDemoMode()) {
        createdCat = saveDemoCategoryClient({
          name: trimmed,
          description: newCategoryDescription.trim(),
        });
        try {
          await createCategoryAction({
            name: trimmed,
            description: newCategoryDescription.trim(),
          });
        } catch (err) {
          console.warn('Server category fallback in demo mode:', err);
        }
      } else {
        const res = await createCategoryAction({
          name: trimmed,
          description: newCategoryDescription.trim(),
        });
        if (res.success && res.data) {
          createdCat = res.data;
        } else {
          throw new Error(!res.success ? res.error : 'Failed to create category');
        }
      }

      if (!createdCat || !createdCat.id) {
        throw new Error('Category could not be created');
      }

      setCategoriesList(prev => {
        if (prev.some(c => c.id === createdCat.id)) return prev;
        return [...prev, createdCat].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      });

      form.setValue('category_id', createdCat.id);
      toast.success(`Category "${trimmed}" added and selected`);
      setNewCategoryName('');
      setNewCategoryDescription('');
      setIsAddCategoryOpen(false);
    } catch (err: any) {
      console.error('Failed to create category:', err);
      toast.error(err.message || 'Failed to add category');
    } finally {
      setIsSavingCategory(false);
    }
  };

  // Handle Add New Manufacturer
  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBrandName.trim().toUpperCase();
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
          manufacturer: newBrandCompany.trim().toUpperCase() || trimmed,
        });
        try {
          await createBrandAction({
            name: trimmed,
            manufacturer: newBrandCompany.trim().toUpperCase() || trimmed,
          });
        } catch (err) {
          console.warn('Server brand fallback in demo mode:', err);
        }
      } else {
        const res = await createBrandAction({
          name: trimmed,
          manufacturer: newBrandCompany.trim().toUpperCase() || trimmed,
        });
        if (res.success && res.data) {
          createdBrand = res.data;
        } else {
          throw new Error(!res.success ? res.error : 'Failed to create manufacturer');
        }
      }

      if (!createdBrand || !createdBrand.id) {
        throw new Error('Manufacturer could not be created');
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
    if (!data.category_id || !data.category_id.trim() || data.category_id === '__none__') {
      toast.error('Please select a category before saving the product.');
      return;
    }

    setIsSubmitting(true);
    try {
      const rawBatch = (data.batch_number || '').trim();
      const rawExpStr = (data.expiry_date || '').trim();
      const dbExpiry = rawExpStr ? (formatDDMMYYYYtoDB(rawExpStr) || rawExpStr) : null;
      const hasBatch = Boolean(rawBatch);
      const hasExpiry = Boolean(dbExpiry);

      const sizeVal = data.product_size_value !== undefined && data.product_size_value !== null && data.product_size_value !== ('' as any)
        ? Number(data.product_size_value)
        : null;
      const sizeUnit = data.product_size_unit || (sizeVal ? 'KG' : null);
      const packSize = sizeVal ? `${sizeVal} ${sizeUnit}` : (data.pack_size || '');
      const normalizedName = (data.name || '').trim().toUpperCase();

      const primaryBarcode = data.barcode || (linkedIdentifiers.length > 0 ? (linkedIdentifiers[0].normalized_value || linkedIdentifiers[0].raw_value) : '');

      const formattedData: ProductInput = {
        ...data,
        name: normalizedName,
        batch_number: hasBatch ? rawBatch : null,
        expiry_date: dbExpiry,
        batch_tracking: hasBatch,
        expiry_tracking: hasExpiry,
        product_size_value: sizeVal,
        product_size_unit: sizeUnit,
        pack_size: packSize,
        unit: data.unit || initialData?.unit || 'Piece',
        sku: data.sku || `SKU-${Date.now().toString().slice(-4)}`,
        barcode: primaryBarcode,
        description: data.description || '',
        hsn_code: data.hsn_code || '',
        identifiers: linkedIdentifiers,
      };

      if (isClientDemoMode()) {
        if (mode === 'create') {
          saveDemoProductClient(formattedData);
        } else {
          updateDemoProductClient(initialData.id, formattedData);
        }
        try {
          if (mode === 'create') {
            await createProductAction(formattedData);
          } else {
            await updateProductAction(initialData.id, formattedData);
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
        result = await createProductAction(formattedData);
      } else {
        result = await updateProductAction(initialData.id, formattedData);
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-4xl mx-auto pb-24">
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
                Manual product entry + QR/Barcode identifier linking for instant billing lookup
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
                <><Check className="mr-2 h-4 w-4 stroke-[3]" /> {mode === 'create' ? 'SAVE PRODUCT' : 'UPDATE PRODUCT'}</>
              )}
            </Button>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════
            SECTION 1: PRODUCT DETAILS
        ═════════════════════════════════════════════════════════ */}
        <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">{t('products.productDetails', 'PRODUCT DETAILS')}</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    {t('products.productDetailsDesc', 'Product information, category, size, batch, and expiry')}
                  </CardDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsScannerOpen(true)}
                className="h-9 px-4 rounded-lg border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary font-bold gap-2 text-xs shadow-sm self-start sm:self-auto shrink-0 transition-all active:scale-95"
              >
                <Scan className="h-4 w-4 stroke-[2.5]" />
                <span>Link QR / Barcode</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            {/* 1. Product Name (Clean Full Width) */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-foreground flex items-center">
                {t('products.productName', 'Product Name')} <span className="text-destructive font-bold ml-0.5">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. UREA, DAP, CONFIDOR, COTTON SEEDS, EVICENT"
                className="h-11 text-base rounded-lg border-border bg-background uppercase font-bold"
                {...form.register('name')}
                onChange={(e) => {
                  form.setValue('name', e.target.value.toUpperCase(), { shouldValidate: true });
                }}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive font-medium">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* 2. Category, Manufacturer, HSN Code */}
            <div className="grid gap-5 grid-cols-1 md:grid-cols-3 items-start">
              {/* Category with Quick Add */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="category_id" className="text-sm font-semibold text-foreground flex items-center">
                    {t('products.category', 'Category')} <span className="text-destructive font-bold ml-0.5">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={() => setIsAddCategoryOpen(true)}
                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 stroke-[3]" /> {t('products.addNewCategory', '+ Add New Category')}
                  </button>
                </div>
                <Select
                  value={form.watch('category_id') || ''}
                  onValueChange={(val) => {
                    if (val === '__add_new__') {
                      setIsAddCategoryOpen(true);
                    } else {
                      form.setValue('category_id', val, { shouldValidate: true });
                    }
                  }}
                >
                  <SelectTrigger id="category_id" className="h-11 rounded-lg border-border bg-background text-foreground">
                    <SelectValue placeholder={t('products.selectCategory', 'Select Category')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" disabled className="text-muted-foreground font-semibold">
                      {t('products.selectCategory', 'Select Category')}
                    </SelectItem>
                    {categoriesList.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id} className="font-medium">
                        {cat.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__add_new__" className="text-primary font-bold border-t border-border mt-1">
                      + Add New Category
                    </SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.category_id && (
                  <p className="text-xs text-destructive font-medium">{form.formState.errors.category_id.message}</p>
                )}
              </div>

              {/* Manufacturer / Brand with Quick Add */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="brand_id" className="text-sm font-semibold text-foreground flex items-center">
                    {t('products.brand', 'Manufacturer')}
                  </Label>
                  <button
                    type="button"
                    onClick={() => setIsAddBrandOpen(true)}
                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 stroke-[3]" /> + Add New
                  </button>
                </div>
                <Select
                  value={form.watch('brand_id') || ''}
                  onValueChange={(val) => {
                    if (val === '__add_new__') {
                      setIsAddBrandOpen(true);
                    } else if (val === '__none__') {
                      form.setValue('brand_id', null as any);
                    } else {
                      form.setValue('brand_id', val);
                    }
                  }}
                >
                  <SelectTrigger id="brand_id" className="h-11 rounded-lg border-border bg-background text-foreground">
                    <SelectValue placeholder="Select Manufacturer (Optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-muted-foreground">
                      None / Not Specified
                    </SelectItem>
                    {brandsList.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id} className="font-medium">
                        {brand.name} {brand.manufacturer && brand.manufacturer !== brand.name ? `(${brand.manufacturer})` : ''}
                      </SelectItem>
                    ))}
                    <SelectItem value="__add_new__" className="text-primary font-bold border-t border-border mt-1">
                      + Add New Manufacturer
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* HSN Code */}
              <div className="space-y-2">
                <Label htmlFor="hsn_code" className="text-sm font-semibold text-foreground flex items-center">
                  {t('products.hsnCode', 'HSN Code')}
                </Label>
                <Input
                  id="hsn_code"
                  placeholder="e.g. 31021000"
                  className="h-11 text-sm rounded-lg border-border bg-background font-mono"
                  {...form.register('hsn_code')}
                />
              </div>
            </div>

            {/* 3. Linked Product QR / Barcodes Container */}
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-primary/20 text-primary flex items-center justify-center">
                    <Link2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Linked Product QR / Barcodes</h4>
                    <p className="text-xs text-muted-foreground">
                      Saved identifiers are used for instant exact product lookup during Billing
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsScannerOpen(true)}
                  className="h-8 text-xs font-bold gap-1.5 border-primary/40 text-primary hover:bg-primary/20 bg-background"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add QR / Barcode</span>
                </Button>
              </div>

              {linkedIdentifiers.length === 0 ? (
                <div className="p-3 text-center rounded-lg border border-dashed border-border bg-background/60 text-xs text-muted-foreground">
                  No QR/Barcode linked yet. Click <strong>&quot;Add QR / Barcode&quot;</strong> to scan and register one or more identifiers.
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  {linkedIdentifiers.map((ident, index) => {
                    const isQr = ident.identifier_type === 'qr' || ident.raw_value.startsWith('http');
                    const truncatedVal = ident.raw_value.length > 38 
                      ? `${ident.raw_value.slice(0, 20)}...${ident.raw_value.slice(-14)}` 
                      : ident.raw_value;

                    return (
                      <div
                        key={`${ident.raw_value}-${index}`}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-background text-xs shadow-xs"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <span className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            isQr 
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' 
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          }`}>
                            {isQr ? <QrCode className="h-3 w-3" /> : <Barcode className="h-3 w-3" />}
                            {ident.identifier_type}
                          </span>
                          <span className="font-mono text-foreground break-all truncate font-semibold">
                            {truncatedVal}
                          </span>
                          {ident.is_primary && (
                            <span className="text-[10px] bg-muted px-1.5 py-0.2 rounded text-muted-foreground font-semibold">
                              Primary
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveIdentifier(index)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          title="Unlink identifier"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Product Size and Physical Packaging */}
            <div className="grid gap-5 grid-cols-1 md:grid-cols-2 items-start">
              {/* Product Size (Numeric Value + Measurement Unit) */}
              <div className="space-y-2">
                <Label htmlFor="product_size_value" className="text-sm font-semibold text-foreground flex items-center">
                  Product Size <span className="text-destructive font-bold ml-0.5">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="product_size_value"
                    type="number"
                    step="any"
                    min="0.001"
                    placeholder="e.g. 45, 100, 500, 1"
                    className="h-11 text-base font-bold rounded-lg border-border bg-background flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={form.watch('product_size_value') !== undefined && form.watch('product_size_value') !== null ? String(form.watch('product_size_value')) : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      form.setValue('product_size_value', val === '' ? ('' as any) : Number(val), { shouldValidate: true });
                      const currentUnit = form.getValues('product_size_unit') || 'KG';
                      if (val) {
                        form.setValue('pack_size', `${val} ${currentUnit}`, { shouldValidate: true });
                      }
                    }}
                  />
                  <Select
                    value={form.watch('product_size_unit') || 'KG'}
                    onValueChange={(val) => {
                      form.setValue('product_size_unit', val, { shouldValidate: true });
                      const currentVal = form.getValues('product_size_value');
                      if (currentVal !== undefined && currentVal !== null && String(currentVal) !== '') {
                        form.setValue('pack_size', `${currentVal} ${val}`, { shouldValidate: true });
                      }
                    }}
                  >
                    <SelectTrigger className="w-[140px] h-11 rounded-lg border-border bg-background text-foreground font-bold shrink-0">
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_SIZE_UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value} className="font-semibold">
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.formState.errors.product_size_value && (
                  <p className="text-xs text-destructive font-medium">{form.formState.errors.product_size_value.message}</p>
                )}
                <p className="text-[11px] text-muted-foreground">e.g. 45 KG, 100 ML, 1 LTR, 500 GM</p>
              </div>

              {/* Physical Packaging Unit */}
              <div className="space-y-2">
                <Label htmlFor="unit" className="text-sm font-semibold text-foreground flex items-center">
                  Packaging Type <span className="text-destructive font-bold ml-0.5">*</span>
                </Label>
                <Select
                  value={form.watch('unit') || 'Piece'}
                  onValueChange={(val) => form.setValue('unit', val, { shouldValidate: true })}
                >
                  <SelectTrigger id="unit" className="h-11 rounded-lg border-border bg-background text-foreground">
                    <SelectValue placeholder="Select Packaging" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bag">Bag (पोते / थैला)</SelectItem>
                    <SelectItem value="Bottle">Bottle (बाटली / बोतल)</SelectItem>
                    <SelectItem value="Packet">Packet (पॉकेट / पैकेट)</SelectItem>
                    <SelectItem value="Box">Box (खोका / डिब्बा)</SelectItem>
                    <SelectItem value="Can">Can (कॅन)</SelectItem>
                    <SelectItem value="Drum">Drum (ड्रम)</SelectItem>
                    <SelectItem value="Container">Container (कंटेनर)</SelectItem>
                    <SelectItem value="Piece">Piece (नग / प्रति वस्तु)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Type of packaging container sold</p>
              </div>
            </div>

            {/* 5. Batch & Expiry Row */}
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 items-start">
              {/* Batch Number */}
              <div className="space-y-2">
                <Label htmlFor="batch_number" className="text-sm font-semibold text-foreground flex items-center">
                  {t('products.batchNumber', 'Batch No')}
                </Label>
                <Input
                  id="batch_number"
                  placeholder="e.g. BAT-2025-01 (Auto-assigned if empty)"
                  className="h-11 text-sm rounded-lg border-border bg-background font-mono"
                  {...form.register('batch_number')}
                />
              </div>

              {/* Expiry Date (DD/MM/YYYY) */}
              <div className="space-y-2">
                <Label htmlFor="expiry_date" className="text-sm font-semibold text-foreground flex items-center">
                  {t('products.expiryDate', 'Expiry Date')} <span className="text-xs text-muted-foreground font-normal ml-1">(DD/MM/YYYY)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="expiry_date"
                    placeholder="DD/MM/YYYY"
                    maxLength={10}
                    className="h-11 text-sm rounded-lg border-border bg-background font-mono pl-3 pr-8"
                    value={form.watch('expiry_date') || ''}
                    onChange={handleExpiryChange}
                  />
                  <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
                {form.formState.errors.expiry_date && (
                  <p className="text-xs text-destructive font-medium">{form.formState.errors.expiry_date.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═════════════════════════════════════════════════════════
            SECTION 2: PRICING & TAX (Strictly 4 Clean Fields)
        ═════════════════════════════════════════════════════════ */}
        <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <IndianRupee className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-foreground">{t('products.pricingTax', 'PRICING & TAX')}</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  {t('products.pricingTaxDesc', 'Purchase price, selling price, MRP, and GST rates')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-start">
            {/* 1. Purchase Price */}
            <div className="space-y-2">
              <Label htmlFor="purchase_price" className="text-sm font-semibold text-foreground flex items-center">
                {t('products.purchasePrice', 'Purchase Price')} <span className="text-destructive font-bold ml-0.5">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">₹</span>
                <Input
                  id="purchase_price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="pl-8 h-11 text-base rounded-lg border-border bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  {...form.register('purchase_price')}
                />
              </div>
              {form.formState.errors.purchase_price && (
                <p className="text-xs text-destructive font-medium">{form.formState.errors.purchase_price.message}</p>
              )}
            </div>

            {/* 2. Selling Price (Inc. GST) */}
            <div className="space-y-2">
              <Label htmlFor="selling_price" className="text-sm font-semibold text-foreground flex items-center truncate" title="Selling Price (Including GST)">
                {t('products.sellingPriceIncGst', 'Selling Price (Inc. GST)')} <span className="text-destructive font-bold ml-0.5">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold text-sm">₹</span>
                <Input
                  id="selling_price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  className="pl-8 h-11 text-base font-bold text-primary rounded-lg border-primary/40 bg-primary/5 focus-visible:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  {...form.register('selling_price')}
                />
              </div>
              {form.formState.errors.selling_price && (
                <p className="text-xs text-destructive font-medium">{form.formState.errors.selling_price.message}</p>
              )}
            </div>

            {/* 3. MRP */}
            <div className="space-y-2">
              <Label htmlFor="wholesale_price" className="text-sm font-semibold text-foreground">
                {t('products.mrp', 'MRP')}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">₹</span>
                <Input
                  id="wholesale_price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="pl-8 h-11 text-base rounded-lg border-border bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  {...form.register('wholesale_price')}
                />
              </div>
            </div>

            {/* 4. GST */}
            <div className="space-y-2">
              <Label htmlFor="gst_rate" className="text-sm font-semibold text-foreground flex items-center">
                {t('products.gstRate', 'GST')}
              </Label>
              <Select
                value={String(form.watch('gst_rate'))}
                onValueChange={(val) => form.setValue('gst_rate', Number(val))}
              >
                <SelectTrigger id="gst_rate" className="h-11 rounded-lg border-border bg-background text-foreground text-sm">
                  <SelectValue placeholder="Select GST" />
                </SelectTrigger>
                <SelectContent>
                  {GST_RATES.map((rate) => (
                    <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ═════════════════════════════════════════════════════════
            SECTION 3: STOCK & INVENTORY
        ═════════════════════════════════════════════════════════ */}
        <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-foreground">{t('products.stockInventory', 'STOCK & INVENTORY')}</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  {t('products.stockInventoryDesc', 'Stock quantities and minimum stock alert levels')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 grid gap-6 sm:grid-cols-2">
            {/* Quantity in Stock */}
            <div className="space-y-2">
              <Label htmlFor="opening_stock" className="text-sm font-semibold text-foreground flex items-center">
                {t('products.quantityInStock', 'Quantity in Stock')} <span className="text-destructive font-bold ml-0.5">*</span>
              </Label>
              <div className="flex rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-primary focus-within:border-primary overflow-hidden">
                <Input
                  id="opening_stock"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="e.g. 10"
                  className="h-11 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none text-base font-bold text-foreground px-3.5 flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  {...form.register('opening_stock')}
                />
                <div className="px-4 py-2.5 bg-muted/40 border-l border-border text-sm font-bold text-muted-foreground flex items-center justify-center min-w-[80px]">
                  Pieces
                </div>
              </div>
              {form.formState.errors.opening_stock && (
                <p className="text-xs text-destructive font-medium">{form.formState.errors.opening_stock.message}</p>
              )}
              <p className="text-[11px] text-muted-foreground">Number of sellable items/packages in stock</p>
            </div>

            {/* Minimum Stock Level */}
            <div className="space-y-2">
              <Label htmlFor="min_stock" className="text-sm font-semibold text-foreground">
                {t('products.minStockAlert', 'Minimum Stock Level Alert')} <span className="text-destructive font-bold">*</span>
              </Label>
              <div className="flex rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-primary overflow-hidden">
                <Input
                  id="min_stock"
                  type="number"
                  min="0"
                  placeholder="e.g. 5"
                  className="h-11 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none text-base px-3.5 flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  {...form.register('min_stock')}
                />
                <div className="px-4 py-2.5 bg-muted/40 border-l border-border text-sm font-bold text-muted-foreground flex items-center justify-center min-w-[80px]">
                  Pieces
                </div>
              </div>
              {form.formState.errors.min_stock && (
                <p className="text-xs text-destructive font-medium">{form.formState.errors.min_stock.message}</p>
              )}
              <p className="text-[11px] text-muted-foreground">Alerts when stock reaches or falls below this count</p>
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
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 h-12 text-base shadow-md transition-all active:scale-95"
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t('common.saving', 'Saving Product...')}</>
            ) : (
              <><Check className="mr-2 h-5 w-5 stroke-[3]" /> {mode === 'create' ? t('products.createProduct', 'SAVE PRODUCT') : t('products.updateProduct', 'UPDATE PRODUCT')}</>
            )}
          </Button>
        </div>
      </form>

      {/* ═════════════════════════════════════════════════════════
          MODAL: LINK PRODUCT QR / BARCODE
      ═════════════════════════════════════════════════════════ */}
      <LinkProductBarcodeModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onLinkIdentifier={handleLinkIdentifier}
      />

      {/* ═════════════════════════════════════════════════════════
          MODAL: ADD NEW CATEGORY
      ═════════════════════════════════════════════════════════ */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="sm:max-w-md border-border bg-card text-card-foreground">
          <form onSubmit={handleCreateCategory}>
            <DialogHeader className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Grid3X3 className="h-4 w-4" />
                </div>
                <DialogTitle className="text-lg font-bold">Add New Category</DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Add a product category (e.g. Plant Growth Regulators, Bio-Fertilizers).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new_cat_name" className="text-sm font-semibold">
                  Category Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new_cat_name"
                  placeholder="e.g. PLANT GROWTH REGULATORS"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value.toUpperCase())}
                  className="h-10 text-sm uppercase"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_cat_desc" className="text-sm font-semibold">
                  Description (Optional)
                </Label>
                <Input
                  id="new_cat_desc"
                  placeholder="e.g. Products used to regulate plant growth"
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddCategoryOpen(false);
                  setNewCategoryName('');
                  setNewCategoryDescription('');
                }}
                disabled={isSavingCategory}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingCategory || !newCategoryName.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
              >
                {isSavingCategory ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  'Add Category'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                <Label htmlFor="new_brand_name" className="text-sm font-semibold">
                  Manufacturer Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new_brand_name"
                  placeholder="e.g. COROMANDEL, DHANUKA, SUMITOMO"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value.toUpperCase())}
                  className="h-10 text-sm uppercase"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_brand_company" className="text-sm font-semibold">
                  Parent Company / Description (Optional)
                </Label>
                <Input
                  id="new_brand_company"
                  placeholder="e.g. COROMANDEL INTERNATIONAL LTD"
                  value={newBrandCompany}
                  onChange={(e) => setNewBrandCompany(e.target.value.toUpperCase())}
                  className="h-10 text-sm uppercase"
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
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
              >
                {isSavingBrand ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
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
