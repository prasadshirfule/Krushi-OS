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
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { ProductBarcodeScannerModal } from '@/components/scanner/product-barcode-scanner';
import { ProductScanResult, FieldConflict } from '@/lib/scanner/types';

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

  // Scanner state & autofill tracking
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [autofilledFields, setAutofilledFields] = useState<Set<string>>(new Set());
  const [conflicts, setConflicts] = useState<FieldConflict[]>([]);
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);

  // Handle auto-filling product form with conflict detection
  const handleApplyScanResult = (result: ProductScanResult) => {
    const newAutofilled = new Set(autofilledFields);
    const newConflicts: FieldConflict[] = [];

    const checkAndFill = (
      fieldName: keyof ProductInput,
      label: string,
      detectedVal: any
    ) => {
      if (detectedVal === undefined || detectedVal === null || detectedVal === '') return;
      
      const currentVal = form.getValues(fieldName);
      const isCurrentEmpty = 
        currentVal === undefined || 
        currentVal === null || 
        currentVal === '' || 
        currentVal === '__none__' ||
        (fieldName === 'purchase_price' && Number(currentVal) === 0 && mode === 'create') ||
        (fieldName === 'selling_price' && Number(currentVal) === 0 && mode === 'create');

      if (isCurrentEmpty) {
        form.setValue(fieldName, detectedVal, { shouldValidate: true });
        newAutofilled.add(fieldName);
      } else {
        const normalizedCurrent = String(currentVal).trim().toUpperCase();
        const normalizedDetected = String(detectedVal).trim().toUpperCase();

        if (normalizedCurrent !== normalizedDetected) {
          newConflicts.push({
            fieldName: fieldName as any,
            label,
            currentValue: currentVal,
            detectedValue: detectedVal,
          });
        }
      }
    };

    // 1. Barcode / GTIN
    if (result.barcode || result.gtin) {
      checkAndFill('barcode', 'Barcode / GTIN', result.barcode || result.gtin);
    }

    // 2. SKU
    if (result.sku) {
      checkAndFill('sku', 'SKU', result.sku);
    }

    // 3. Product Name
    if (result.productName) {
      checkAndFill('name', 'Product Name', result.productName.toUpperCase());
    }

    // 4. Category
    if (result.categoryId) {
      const matchCat = categoriesList.find(c => c.id === result.categoryId);
      if (matchCat) {
        checkAndFill('category_id', 'Category', matchCat.id);
      }
    } else if (result.category) {
      const matchCat = categoriesList.find(c => 
        c.name.toLowerCase() === result.category?.toLowerCase() ||
        result.category?.toLowerCase().includes(c.name.toLowerCase())
      );
      if (matchCat) {
        checkAndFill('category_id', 'Category', matchCat.id);
      }
    }

    // 5. Manufacturer / Brand
    if (result.manufacturer || result.brand) {
      const brandSearch = result.brand || result.manufacturer;
      const matchBrand = brandsList.find(b => 
        (b.name && b.name.toLowerCase() === brandSearch?.toLowerCase()) ||
        (b.manufacturer && b.manufacturer.toLowerCase() === brandSearch?.toLowerCase()) ||
        (result.manufacturer && b.manufacturer && b.manufacturer.toLowerCase() === result.manufacturer.toLowerCase())
      );
      if (matchBrand) {
        checkAndFill('brand_id', 'Manufacturer / Brand', matchBrand.id);
      }
    }

    // 6. HSN Code
    if (result.hsnCode) {
      checkAndFill('hsn_code', 'HSN Code', result.hsnCode);
    }

    // 7. GST Rate
    if (result.gstRate !== undefined) {
      checkAndFill('gst_rate', 'GST Rate', Number(result.gstRate));
    }

    // 8. Product Size
    if (result.sizeValue !== undefined && result.sizeValue !== null && Number(result.sizeValue) > 0) {
      checkAndFill('product_size_value', 'Product Size Value', Number(result.sizeValue));
      if (result.sizeUnit) {
        form.setValue('product_size_unit', result.sizeUnit);
        newAutofilled.add('product_size_unit');
      }
      const unit = result.sizeUnit || form.getValues('product_size_unit') || 'KG';
      form.setValue('pack_size', `${result.sizeValue} ${unit}`, { shouldValidate: true });
    } else if (result.packSize) {
      form.setValue('pack_size', result.packSize, { shouldValidate: true });
      newAutofilled.add('pack_size');
    }

    // 9. Batch Number
    if (result.batchNumber) {
      checkAndFill('batch_number', 'Batch No', result.batchNumber);
    }

    // 10. Manufacturing Date
    if (result.manufacturingDate) {
      checkAndFill('mfd_date', 'Mfg Date', result.manufacturingDate);
    }

    // 11. Expiry Date
    if (result.expiryDate) {
      checkAndFill('expiry_date', 'Expiry Date', result.expiryDate);
    }

    // 12. Active Ingredients & Composition
    if (result.activeIngredients && result.activeIngredients.length > 0) {
      checkAndFill('active_ingredient', 'Active Ingredient', result.activeIngredients.join(', '));
    } else if (result.composition) {
      checkAndFill('active_ingredient', 'Composition', result.composition);
    }

    // 13. Formulation
    if (result.formulation) {
      checkAndFill('formulation', 'Formulation', result.formulation);
    }

    // 14. Licence / Registration Number
    if (result.manufacturingLicenceNumber || result.registrationNumber) {
      checkAndFill('licence_number', 'Licence / Reg No', result.manufacturingLicenceNumber || result.registrationNumber);
    }

    // 15. Description
    if (result.productDescription) {
      checkAndFill('description', 'Description', result.productDescription);
    }

    // 16. Pricing & Stock (only if explicitly encoded in recognized structured data)
    if (result.purchasePrice !== undefined && Number(result.purchasePrice) > 0) {
      checkAndFill('purchase_price', 'Purchase Price', Number(result.purchasePrice));
    }
    if (result.sellingPrice !== undefined && Number(result.sellingPrice) > 0) {
      checkAndFill('selling_price', 'Selling Price', Number(result.sellingPrice));
    }
    if (result.quantity !== undefined && Number(result.quantity) > 0) {
      checkAndFill('opening_stock', 'Quantity in Stock', Number(result.quantity));
    }

    setAutofilledFields(newAutofilled);

    if (newConflicts.length > 0) {
      setConflicts(newConflicts);
      setIsConflictDialogOpen(true);
      toast.info(`${newConflicts.length} field conflict(s) detected. Please review.`);
    } else {
      toast.success('Product fields auto-filled from scanner. Please review before saving.');
    }
  };

  const handleResolveConflict = (conflictField: string, useDetected: boolean) => {
    const conflict = conflicts.find(c => c.fieldName === conflictField);
    if (!conflict) return;

    if (useDetected) {
      form.setValue(conflict.fieldName as any, conflict.detectedValue, { shouldValidate: true });
      setAutofilledFields(prev => new Set(prev).add(conflict.fieldName));
      toast.success(`Applied detected ${conflict.label}`);
    } else {
      toast.info(`Kept current ${conflict.label}`);
    }

    const remaining = conflicts.filter(c => c.fieldName !== conflictField);
    setConflicts(remaining);
    if (remaining.length === 0) {
      setIsConflictDialogOpen(false);
    }
  };

  const handleResolveAllConflicts = (useAllDetected: boolean) => {
    if (useAllDetected) {
      const nextAutofill = new Set(autofilledFields);
      conflicts.forEach(c => {
        form.setValue(c.fieldName as any, c.detectedValue, { shouldValidate: true });
        nextAutofill.add(c.fieldName);
      });
      setAutofilledFields(nextAutofill);
      toast.success('Applied all detected values');
    } else {
      toast.info('Kept all current values');
    }
    setConflicts([]);
    setIsConflictDialogOpen(false);
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

  // Form Setup
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
    const trimmed = newBrandName.trim().toUpperCase();
    if (!trimmed) {
      toast.error('Please enter a manufacturer name');
      return;
    }

    setIsSavingBrand(true);
    try {
      let createdBrand: any = null;
      const mfgName = newBrandCompany.trim().toUpperCase() || trimmed;

      if (isClientDemoMode()) {
        createdBrand = saveDemoBrandClient({
          name: trimmed,
          manufacturer: mfgName,
        });
        try {
          await createBrandAction({
            name: trimmed,
            manufacturer: mfgName,
          });
        } catch (err) {
          console.warn('Server brand fallback in demo mode:', err);
        }
      } else {
        const res = await createBrandAction({
          name: trimmed,
          manufacturer: mfgName,
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
                <span>Scan Barcode / QR</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            {/* 1. Product Name (Clean Full Width) */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-foreground flex items-center">
                {t('products.productName', 'Product Name')} <span className="text-destructive font-bold ml-0.5">*</span>
                {autofilledFields.has('name') && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-2">
                    <Check className="h-3 w-3 stroke-[3]" /> Detected
                  </span>
                )}
              </Label>
              <Input
                id="name"
                placeholder="e.g. UREA, DAP, CONFIDOR, COTTON SEEDS, LIQUID FERTILIZER"
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

            {/* Barcode & SKU Row */}
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 items-start pt-1">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="barcode" className="text-sm font-semibold text-foreground flex items-center">
                    Barcode / GTIN
                    {autofilledFields.has('barcode') && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-2">
                        <Check className="h-3 w-3 stroke-[3]" /> Detected
                      </span>
                    )}
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="barcode"
                    placeholder="e.g. 8901234567890"
                    className="h-11 text-sm rounded-lg border-border bg-background font-mono flex-1"
                    {...form.register('barcode')}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsScannerOpen(true)}
                    className="h-11 px-3 border-border hover:bg-muted shrink-0 text-xs font-semibold gap-1"
                  >
                    <Scan className="h-3.5 w-3.5 text-primary" /> Scan
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku" className="text-sm font-semibold text-foreground">
                  SKU (Item Code)
                </Label>
                <Input
                  id="sku"
                  placeholder="e.g. SKU-1029 (auto-generated if blank)"
                  className="h-11 text-sm rounded-lg border-border bg-background font-mono"
                  {...form.register('sku')}
                />
              </div>
            </div>

            {/* 2. Category, Manufacturer, HSN Code */}
            <div className="grid gap-5 grid-cols-1 md:grid-cols-3 items-start">
              {/* Category with Quick Add */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="category_id" className="text-sm font-semibold text-foreground flex items-center">
                    {t('products.category', 'Category')} <span className="text-destructive font-bold ml-0.5">*</span>
                    {autofilledFields.has('category_id') && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-2">
                        <Check className="h-3 w-3 stroke-[3]" /> Detected
                      </span>
                    )}
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
                  <SelectContent className="max-h-72">
                    {categoriesList.length === 0 ? (
                      <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                        {t('products.noCategories', 'No categories found for your shop yet.')}
                      </div>
                    ) : (
                      categoriesList.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))
                    )}
                    <div className="px-2 py-1.5 border-t border-border mt-1 bg-muted/20">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsAddCategoryOpen(true);
                        }}
                        className="w-full text-left text-xs font-bold text-primary hover:underline flex items-center gap-1.5 py-1 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5 stroke-[3]" /> {t('products.addNewCategory', '+ Add New Category')}
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
                  <Label htmlFor="brand_id" className="text-sm font-semibold text-foreground flex items-center">
                    {t('products.manufacturer', 'Manufacturer')}
                    {autofilledFields.has('brand_id') && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-2">
                        <Check className="h-3 w-3 stroke-[3]" /> Detected
                      </span>
                    )}
                  </Label>
                  <button
                    type="button"
                    onClick={() => setIsAddBrandOpen(true)}
                    className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 stroke-[3]" /> {t('products.addNewManufacturer', '+ Add New Manufacturer')}
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
                    <SelectValue placeholder={t('products.selectManufacturer', 'Select Manufacturer')} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__none__" className="text-muted-foreground font-normal">
                      {t('products.genericBrand', '-- No Manufacturer / Generic --')}
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
                        <Plus className="h-3.5 w-3.5 stroke-[3]" /> {t('products.addNewManufacturer', '+ Add New Manufacturer')}
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
              <div className="space-y-2">
                <Label htmlFor="hsn_code" className="text-sm font-semibold text-foreground flex items-center">
                  {t('products.hsnCode', 'HSN Code')}
                  {autofilledFields.has('hsn_code') && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-2">
                      <Check className="h-3 w-3 stroke-[3]" /> Detected
                    </span>
                  )}
                </Label>
                <Input
                  id="hsn_code"
                  placeholder="e.g. 3105"
                  className="h-11 text-base rounded-lg border-border bg-background"
                  {...form.register('hsn_code')}
                />
              </div>
            </div>

            {/* 3. Product Size, Batch No, Exp Date (Clean 3-col Grid) */}
            <div className="grid gap-5 grid-cols-1 md:grid-cols-3 items-start pt-1">
              {/* Product Size (Mandatory with *) */}
              <div className="space-y-2">
                <Label htmlFor="product_size_value" className="text-sm font-semibold text-foreground flex items-center">
                  {t('products.productSize', 'Product Size')} <span className="text-destructive font-bold ml-0.5">*</span>
                  {autofilledFields.has('product_size_value') && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-2">
                      <Check className="h-3 w-3 stroke-[3]" /> Detected
                    </span>
                  )}
                </Label>
                <div className="relative flex items-stretch rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all overflow-hidden h-11">
                  <Input
                    id="product_size_value"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 1"
                    className="h-full border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none text-sm font-semibold text-foreground px-3 flex-1 min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={form.watch('product_size_value') ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : Number(e.target.value);
                      form.setValue('product_size_value', val as any, { shouldValidate: true });
                      const unit = form.getValues('product_size_unit') || 'KG';
                      form.setValue('pack_size', val ? `${val} ${unit}` : '', { shouldValidate: true });
                    }}
                  />
                  <div className="h-full shrink-0 border-l border-border bg-muted/20 flex items-center">
                    <Select
                      value={form.watch('product_size_unit') || 'KG'}
                      onValueChange={(val) => {
                        form.setValue('product_size_unit', val);
                        const currentVal = form.getValues('product_size_value');
                        if (currentVal) {
                          form.setValue('pack_size', `${currentVal} ${val}`, { shouldValidate: true });
                        }
                      }}
                    >
                      <SelectTrigger className="h-full w-[80px] border-0 rounded-none bg-transparent hover:bg-muted/40 focus:ring-0 focus:ring-offset-0 px-2 text-xs font-semibold text-foreground shadow-none justify-between">
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {PRODUCT_SIZE_UNITS.map((u) => (
                          <SelectItem key={u.value} value={u.value} className="text-xs font-medium">
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {form.formState.errors.product_size_value && (
                  <p className="text-xs text-destructive font-medium">{form.formState.errors.product_size_value.message}</p>
                )}
              </div>

              {/* Batch No */}
              <div className="space-y-2">
                <Label htmlFor="batch_number" className="text-sm font-semibold text-foreground flex items-center">
                  {t('products.batchNo', 'Batch No')}
                  {autofilledFields.has('batch_number') && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-2">
                      <Check className="h-3 w-3 stroke-[3]" /> Detected
                    </span>
                  )}
                </Label>
                <Input
                  id="batch_number"
                  placeholder="e.g. B-101"
                  className="h-11 text-sm rounded-lg border-border bg-background font-mono"
                  {...form.register('batch_number')}
                />
                {form.formState.errors.batch_number && (
                  <p className="text-xs text-destructive font-medium">{form.formState.errors.batch_number.message}</p>
                )}
              </div>

              {/* Exp Date */}
              <div className="space-y-2">
                <Label htmlFor="expiry_date" className="text-sm font-semibold text-foreground flex items-center">
                  {t('products.expDate', 'Exp Date')}
                  {autofilledFields.has('expiry_date') && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-2">
                      <Check className="h-3 w-3 stroke-[3]" /> Detected
                    </span>
                  )}
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
                {autofilledFields.has('purchase_price') && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-2">
                    <Check className="h-3 w-3 stroke-[3]" /> Detected
                  </span>
                )}
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
                {autofilledFields.has('selling_price') && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-2">
                    <Check className="h-3 w-3 stroke-[3]" /> Detected
                  </span>
                )}
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
                {autofilledFields.has('gst_rate') && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-2">
                    <Check className="h-3 w-3 stroke-[3]" /> Detected
                  </span>
                )}
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
                {autofilledFields.has('opening_stock') && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-2">
                    <Check className="h-3 w-3 stroke-[3]" /> Detected
                  </span>
                )}
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
          MODAL: PRODUCT BARCODE / QR SCANNER
      ═════════════════════════════════════════════════════════ */}
      <ProductBarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onApplyScanResult={handleApplyScanResult}
      />

      {/* ═════════════════════════════════════════════════════════
          MODAL: SCANNER CONFLICT RESOLUTION
      ═════════════════════════════════════════════════════════ */}
      <Dialog open={isConflictDialogOpen} onOpenChange={setIsConflictDialogOpen}>
        <DialogContent className="sm:max-w-lg border-border bg-card text-card-foreground p-6 rounded-2xl shadow-2xl">
          <DialogHeader className="space-y-1 text-left">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Review Detected Data</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Some fields already have entered values. Choose which values you want to keep.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 my-4 max-h-80 overflow-y-auto pr-1">
            {conflicts.map((c) => (
              <div key={c.fieldName} className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">{c.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-background border border-border/80">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">Current Value</span>
                    <span className="font-semibold text-foreground break-all">{String(c.currentValue || '—')}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                    <span className="text-[10px] uppercase font-bold text-primary block mb-0.5">Detected Value</span>
                    <span className="font-bold text-foreground break-all">{String(c.detectedValue || '—')}</span>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleResolveConflict(c.fieldName, false)}
                    className="h-7 text-xs font-semibold px-3"
                  >
                    Keep Current
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleResolveConflict(c.fieldName, true)}
                    className="h-7 text-xs font-bold px-3 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Use Detected
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="grid grid-cols-2 gap-3 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleResolveAllConflicts(false)}
              className="w-full font-semibold"
            >
              Keep All Current
            </Button>
            <Button
              type="button"
              onClick={() => handleResolveAllConflicts(true)}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              Use All Detected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
