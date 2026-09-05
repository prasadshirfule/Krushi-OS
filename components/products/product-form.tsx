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
  Grid3X3
} from 'lucide-react';

import { 
  isClientDemoMode, 
  saveDemoProductClient, 
  updateDemoProductClient,
  getDemoCategoriesClient,
  saveDemoCategoryClient,
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

  // Categories state
  const [categoriesList, setCategoriesList] = useState<any[]>(() => {
    if (categories && categories.length > 0) return categories;
    if (isClientDemoMode()) return getDemoCategoriesClient();
    return MOCK_CATEGORIES;
  });

  // Modal state for Add New Category
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

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

  // Parse existing product size safely
  const parsedInitial = parseProductSize(initialData?.pack_size, initialData?.unit);
  const initialSizeValue = initialData?.product_size_value !== undefined && initialData?.product_size_value !== null
    ? (initialData.product_size_value === '' ? null : Number(initialData.product_size_value))
    : parsedInitial.sizeValue;
  const initialSizeUnit = initialData?.product_size_unit || parsedInitial.sizeUnit || 'KG';

  const initialBatch = initialData?.batches?.[0];
  const initialBatchNumber = initialData?.batch_number || initialBatch?.batch_number || '';
  const rawInitialExpiry = initialData?.expiry_date || initialBatch?.expiry_date || initialBatch?.exp_date || '';
  const initialExpiryFormatted = formatToDDMMYYYY(rawInitialExpiry);
  const initialStock = initialData?.current_stock ?? initialData?.stock_quantity ?? initialData?.opening_stock ?? initialBatch?.quantity_available ?? (mode === 'create' ? 10 : 0);

  // Form Setup
  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: initialData?.name || '',
      category_id: initialData?.category_id || (categoriesList[0]?.id || ''),
      brand_id: initialData?.brand_id || '',
      sku: initialData?.sku || '',
      barcode: initialData?.barcode || '',
      description: initialData?.description || '',
      purchase_price: initialData?.purchase_price ?? 0,
      selling_price: initialData?.selling_price ?? 0,
      wholesale_price: initialData?.wholesale_price ?? initialData?.mrp ?? initialData?.selling_price ?? 0,
      hsn_code: initialData?.hsn_code || '',
      gst_rate: initialData?.gst_rate ?? 18,
      unit: initialData?.unit || 'Piece',
      product_size_value: initialSizeValue,
      product_size_unit: initialSizeUnit,
      pack_size: initialData?.pack_size || (initialSizeValue ? `${initialSizeValue} ${initialSizeUnit}` : ''),
      min_stock: initialData?.min_stock ?? 5,
      opening_stock: Number(initialStock),
      batch_tracking: true,
      expiry_tracking: true,
      batch_number: initialBatchNumber,
      expiry_date: initialExpiryFormatted,
      product_type: initialData?.product_type || 'Fertilizer',
      active_ingredient: initialData?.active_ingredient || '',
      formulation: initialData?.formulation || '',
      crop: initialData?.crop || '',
      target_pest: initialData?.target_pest || '',
      licence_number: initialData?.licence_number || '',
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
    const trimmed = newCategoryName.trim();
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
        if (res.success) {
          createdCat = res.data;
        } else {
          throw new Error(res.error || 'Failed to create category');
        }
      }

      if (!createdCat) {
        createdCat = { id: `cat-${Date.now()}`, name: trimmed, description: newCategoryDescription.trim() };
      }

      setCategoriesList(prev => {
        if (prev.some(c => c.id === createdCat.id)) return prev;
        return [...prev, createdCat].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      });

      form.setValue('category_id', createdCat.id, { shouldValidate: true });
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
      const dbExpiry = formatDDMMYYYYtoDB(data.expiry_date) || data.expiry_date;
      const sizeVal = data.product_size_value !== undefined && data.product_size_value !== null && data.product_size_value !== ('' as any)
        ? Number(data.product_size_value)
        : null;
      const sizeUnit = data.product_size_unit || (sizeVal ? 'KG' : null);
      const packSize = sizeVal ? `${sizeVal} ${sizeUnit}` : (data.pack_size || '');

      const formattedData: ProductInput = {
        ...data,
        expiry_date: dbExpiry,
        batch_tracking: true,
        expiry_tracking: true,
        product_size_value: sizeVal,
        product_size_unit: sizeUnit,
        pack_size: packSize,
        unit: data.unit || initialData?.unit || 'Piece',
        sku: data.sku || `SKU-${Date.now().toString().slice(-4)}`,
        barcode: data.barcode || '',
        description: data.description || '',
        hsn_code: data.hsn_code || '',
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
                Simple shopkeeper form: Product → Price → Batch → Expiry → Quantity (Pieces) & Product Size
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
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-foreground">PRODUCT DETAILS</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Product name, category, and manufacturer
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
                placeholder="e.g. Urea, DAP, Confidor, Cotton Seeds, Liquid Fertilizer"
                className="h-11 text-base rounded-lg border-border bg-background"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive font-medium">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* Category with Quick Add */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="category_id" className="text-sm font-semibold text-foreground">
                  Category <span className="text-destructive font-bold">*</span>
                </Label>
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(true)}
                  className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 stroke-[3]" /> Add New Category
                </button>
              </div>
              <Select
                value={form.watch('category_id')}
                onValueChange={(val) => {
                  if (val === '__add_new__') {
                    setIsAddCategoryOpen(true);
                  } else {
                    form.setValue('category_id', val, { shouldValidate: true });
                  }
                }}
              >
                <SelectTrigger id="category_id" className="h-11 rounded-lg border-border bg-background text-foreground">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {categoriesList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                  <div className="px-2 py-1.5 border-t border-border mt-1 bg-muted/20">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAddCategoryOpen(true);
                      }}
                      className="w-full text-left text-xs font-bold text-primary hover:underline flex items-center gap-1.5 py-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 stroke-[3]" /> + Add New Category
                    </button>
                  </div>
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
                  Manufacturer
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
                  <SelectValue placeholder="Select Manufacturer" />
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

            {/* HSN Code */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="hsn_code" className="text-sm font-semibold text-foreground">
                HSN Code
              </Label>
              <Input
                id="hsn_code"
                placeholder="e.g. 3105"
                className="h-11 text-base rounded-lg border-border bg-background"
                {...form.register('hsn_code')}
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
                <CardTitle className="text-lg font-bold text-foreground">PRICING & TAX</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Purchase price, retail selling price per piece, MRP, and GST
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Purchase Price */}
            <div className="space-y-2">
              <Label htmlFor="purchase_price" className="text-sm font-semibold text-foreground">
                Purchase Price <span className="text-destructive font-bold">*</span>
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

            {/* Selling Price */}
            <div className="space-y-2">
              <Label htmlFor="selling_price" className="text-sm font-semibold text-foreground">
                Selling Price <span className="text-destructive font-bold">*</span>
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

            {/* MRP */}
            <div className="space-y-2">
              <Label htmlFor="wholesale_price" className="text-sm font-semibold text-foreground">
                MRP
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

            {/* GST */}
            <div className="space-y-2">
              <Label htmlFor="gst_rate" className="text-sm font-semibold text-foreground">
                GST
              </Label>
              <Select
                value={String(form.watch('gst_rate'))}
                onValueChange={(val) => form.setValue('gst_rate', Number(val))}
              >
                <SelectTrigger id="gst_rate" className="h-11 rounded-lg border-border bg-background text-foreground">
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
            SECTION 3: STOCK & BATCH (Quantity in Pieces, Product Size, Packaging)
        ═════════════════════════════════════════════════════════ */}
        <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-foreground">STOCK & BATCH</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Batch details, stock quantity (pieces), packaging type, and product size contained in one piece
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 grid gap-6 sm:grid-cols-2">
            {/* Batch Number */}
            <div className="space-y-2">
              <Label htmlFor="batch_number" className="text-sm font-semibold text-foreground">
                Batch Number <span className="text-destructive font-bold">*</span>
              </Label>
              <Input
                id="batch_number"
                placeholder="e.g. UREA-2026-01"
                className="h-11 text-base rounded-lg border-border bg-background font-mono"
                {...form.register('batch_number')}
              />
              {form.formState.errors.batch_number && (
                <p className="text-xs text-destructive font-medium">{form.formState.errors.batch_number.message}</p>
              )}
            </div>

            {/* Expiry Date */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="expiry_date" className="text-sm font-semibold text-foreground">
                  Expiry Date <span className="text-destructive font-bold">*</span>
                </Label>
                <span className="text-xs text-muted-foreground font-mono font-medium">DD/MM/YYYY</span>
              </div>
              <div className="relative">
                <Input
                  id="expiry_date"
                  placeholder="DD/MM/YYYY"
                  maxLength={10}
                  className="h-11 text-base rounded-lg border-border bg-background font-mono pl-3.5 pr-10"
                  value={form.watch('expiry_date') || ''}
                  onChange={handleExpiryChange}
                />
                <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              {form.formState.errors.expiry_date ? (
                <p className="text-xs text-destructive font-medium">{form.formState.errors.expiry_date.message}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">Expected format: DD/MM/YYYY (e.g. 04/09/2027)</p>
              )}
            </div>

            {/* Quantity in Pieces */}
            <div className="space-y-2">
              <Label htmlFor="opening_stock" className="text-sm font-semibold text-foreground">
                Quantity <span className="text-destructive font-bold">*</span>
              </Label>
              <div className="flex rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-primary focus-within:border-primary overflow-hidden">
                <Input
                  id="opening_stock"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="10"
                  className="h-11 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none text-base font-bold text-foreground px-3.5 flex-1"
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

            {/* Product Size (Manual Number + Unit Dropdown) */}
            <div className="space-y-2">
              <Label htmlFor="product_size_value" className="text-sm font-semibold text-foreground">
                Product Size
              </Label>
              <div className="flex rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-primary focus-within:border-primary overflow-hidden">
                <Input
                  id="product_size_value"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="e.g. 45"
                  className="h-11 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none text-base font-bold text-foreground px-3.5 flex-1"
                  value={form.watch('product_size_value') ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : Number(e.target.value);
                    form.setValue('product_size_value', val);
                  }}
                />
                <div className="w-[150px] sm:w-[170px] border-l border-border bg-muted/30">
                  <Select
                    value={form.watch('product_size_unit') || 'KG'}
                    onValueChange={(val) => form.setValue('product_size_unit', val)}
                  >
                    <SelectTrigger className="h-11 border-0 focus:ring-0 rounded-none bg-transparent font-bold text-foreground">
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {PRODUCT_SIZE_UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Weight or volume contained in one piece (e.g. 45 KG, 100 ML)</p>
            </div>

            {/* Minimum Stock Level */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="min_stock" className="text-sm font-semibold text-foreground">
                Minimum Stock Level
              </Label>
              <div className="flex max-w-sm rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-primary overflow-hidden">
                <Input
                  id="min_stock"
                  type="number"
                  min="0"
                  placeholder="5"
                  className="h-11 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none text-base px-3.5 flex-1"
                  {...form.register('min_stock')}
                />
                <div className="px-4 py-2.5 bg-muted/40 border-l border-border text-sm font-bold text-muted-foreground flex items-center justify-center min-w-[80px]">
                  Pieces
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Alerts when stock is at or below this number of pieces</p>
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
                  placeholder="e.g. Plant Growth Regulators"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="h-10 text-sm"
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
                  placeholder="e.g. Coromandel, Dhanuka, Sumitomo"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  className="h-10 text-sm"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_brand_company" className="text-sm font-semibold">
                  Parent Company / Description (Optional)
                </Label>
                <Input
                  id="new_brand_company"
                  placeholder="e.g. Coromandel International Ltd"
                  value={newBrandCompany}
                  onChange={(e) => setNewBrandCompany(e.target.value)}
                  className="h-10 text-sm"
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
