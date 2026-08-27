'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productSchema, ProductInput } from '@/lib/validations';
import { createProductAction, updateProductAction } from '@/actions/products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PRODUCT_UNITS, GST_RATES, AGRICULTURAL_TYPES } from '@/lib/constants';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Loader2, Save, ArrowLeft } from 'lucide-react';

interface ProductFormProps {
  mode: 'create' | 'edit';
  initialData?: any;
  categories: any[];
  brands: any[];
}

export function ProductForm({ mode, initialData, categories, brands }: ProductFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: initialData?.name || '',
      category_id: initialData?.category_id || (categories[0]?.id || ''),
      brand_id: initialData?.brand_id || '',
      sku: initialData?.sku || '',
      barcode: initialData?.barcode || '',
      description: initialData?.description || '',
      purchase_price: initialData?.purchase_price ?? 0,
      selling_price: initialData?.selling_price ?? 0,
      hsn_code: initialData?.hsn_code || '',
      gst_rate: initialData?.gst_rate ?? 18,
      unit: initialData?.unit || 'Bottle',
      min_stock: initialData?.min_stock ?? 5,
      opening_stock: initialData?.current_stock ?? 0,
      batch_tracking: initialData?.batch_tracking ?? false,
      expiry_tracking: initialData?.expiry_tracking ?? false,
      product_type: initialData?.product_type || 'Pesticide',
      active_ingredient: initialData?.active_ingredient || '',
      formulation: initialData?.formulation || '',
      crop: initialData?.crop || '',
      target_pest: initialData?.target_pest || '',
      pack_size: initialData?.pack_size || '',
      licence_number: initialData?.licence_number || '',
    },
  });

  const watchBatchTracking = form.watch('batch_tracking');

  const onSubmit = async (data: ProductInput) => {
    setIsSubmitting(true);
    try {
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === 'create' ? 'Add New Product' : `Edit Product: ${initialData?.name}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter agricultural product details, pricing, tax rates, and inventory settings.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" className="bg-green-600 hover:bg-green-700 font-semibold" disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Product...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" /> {mode === 'create' ? 'Save Product' : 'Update Product'}</>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basic" className="w-full space-y-4">
        <TabsList className="grid grid-cols-4 w-full bg-muted/60 p-1">
          <TabsTrigger value="basic">1. Basic Info</TabsTrigger>
          <TabsTrigger value="pricing">2. Pricing & Tax</TabsTrigger>
          <TabsTrigger value="inventory">3. Inventory & Stock</TabsTrigger>
          <TabsTrigger value="agricultural">4. Agricultural Info</TabsTrigger>
        </TabsList>

        {/* Tab 1: Basic Info */}
        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Product title, category, brand, and identification codes.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input id="name" placeholder="e.g. Chlorpyrifos 20% EC" {...form.register('name')} />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category_id">Category *</Label>
                <Select
                  value={form.watch('category_id')}
                  onValueChange={(val) => form.setValue('category_id', val, { shouldValidate: true })}
                >
                  <SelectTrigger id="category_id">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.category_id && (
                  <p className="text-xs text-destructive">{form.formState.errors.category_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand_id">Brand / Manufacturer</Label>
                <Select
                  value={form.watch('brand_id') || ''}
                  onValueChange={(val) => form.setValue('brand_id', val || null)}
                >
                  <SelectTrigger id="brand_id">
                    <SelectValue placeholder="Select Brand (Optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU / Product Code</Label>
                <Input id="sku" placeholder="e.g. PEST-CHL-20" {...form.register('sku')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode</Label>
                <Input id="barcode" placeholder="Scan or enter barcode" {...form.register('barcode')} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Product Description</Label>
                <Textarea id="description" placeholder="Dosage, usage instructions, safety warnings..." {...form.register('description')} rows={3} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Pricing & Tax */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <CardTitle>Pricing & Tax</CardTitle>
              <CardDescription>Purchase price, retail selling price, HSN code, and GST slabs.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="purchase_price">Purchase Cost (₹)</Label>
                <Input id="purchase_price" type="number" step="0.01" min="0" {...form.register('purchase_price')} />
                {form.formState.errors.purchase_price && (
                  <p className="text-xs text-destructive">{form.formState.errors.purchase_price.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="selling_price">Selling Price / MRP (₹) *</Label>
                <Input id="selling_price" type="number" step="0.01" min="0" {...form.register('selling_price')} />
                {form.formState.errors.selling_price && (
                  <p className="text-xs text-destructive">{form.formState.errors.selling_price.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="hsn_code">HSN Code</Label>
                <Input id="hsn_code" placeholder="e.g. 3808" {...form.register('hsn_code')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gst_rate">GST Rate (%)</Label>
                <Select
                  value={String(form.watch('gst_rate'))}
                  onValueChange={(val) => form.setValue('gst_rate', Number(val))}
                >
                  <SelectTrigger id="gst_rate">
                    <SelectValue placeholder="Select GST Rate" />
                  </SelectTrigger>
                  <SelectContent>
                    {GST_RATES.map((rate) => (
                      <SelectItem key={rate} value={String(rate)}>{rate}% GST</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Inventory & Stock */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Inventory & Stock Management</CardTitle>
              <CardDescription>Units, low stock alert limits, opening inventory, and tracking options.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="unit">Unit of Measurement *</Label>
                <Select
                  value={form.watch('unit')}
                  onValueChange={(val) => form.setValue('unit', val, { shouldValidate: true })}
                >
                  <SelectTrigger id="unit">
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
                  <p className="text-xs text-destructive">{form.formState.errors.unit.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_stock">Minimum Stock Reorder Level</Label>
                <Input id="min_stock" type="number" min="0" {...form.register('min_stock')} />
              </div>

              {mode === 'create' && (
                <div className="space-y-2">
                  <Label htmlFor="opening_stock">Opening Stock Quantity</Label>
                  <Input id="opening_stock" type="number" min="0" placeholder="e.g. 50" {...form.register('opening_stock')} />
                  <p className="text-[11px] text-muted-foreground">Will automatically generate opening stock inventory entry.</p>
                </div>
              )}

              <div className="space-y-4 md:col-span-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-semibold">Batch Tracking</Label>
                    <p className="text-xs text-muted-foreground">Enable tracking individual batch numbers and quantities.</p>
                  </div>
                  <Switch
                    checked={form.watch('batch_tracking')}
                    onCheckedChange={(checked) => form.setValue('batch_tracking', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-semibold">Expiry Date Tracking</Label>
                    <p className="text-xs text-muted-foreground">Monitor expiry dates and receive urgent expiration alerts.</p>
                  </div>
                  <Switch
                    checked={form.watch('expiry_tracking')}
                    onCheckedChange={(checked) => form.setValue('expiry_tracking', checked)}
                  />
                </div>
              </div>

              {(watchBatchTracking || form.watch('expiry_tracking')) && mode === 'create' && (
                <div className="grid grid-cols-2 gap-4 md:col-span-2 bg-muted/40 p-4 rounded-lg border">
                  <div className="space-y-2">
                    <Label htmlFor="batch_number">Initial Batch Number (Optional)</Label>
                    <Input id="batch_number" placeholder="e.g. BATCH-2026-01" {...form.register('batch_number')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiry_date">Expiry Date (Optional)</Label>
                    <Input id="expiry_date" type="date" {...form.register('expiry_date')} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Agricultural Info */}
        <TabsContent value="agricultural">
          <Card>
            <CardHeader>
              <CardTitle>Agricultural & Technical Specifications</CardTitle>
              <CardDescription>Pesticide/fertilizer active ingredients, formulation, crop suitability, and CIB licence numbers.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product_type">Product Type</Label>
                <Select
                  value={form.watch('product_type') || 'Pesticide'}
                  onValueChange={(val) => form.setValue('product_type', val)}
                >
                  <SelectTrigger id="product_type">
                    <SelectValue placeholder="Select Agricultural Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGRICULTURAL_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="active_ingredient">Active Ingredient / Technical Name</Label>
                <Input id="active_ingredient" placeholder="e.g. Chlorpyrifos 20% EC" {...form.register('active_ingredient')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="formulation">Formulation Type</Label>
                <Input id="formulation" placeholder="e.g. EC, WP, SL, GR, SC" {...form.register('formulation')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="crop">Target Crops</Label>
                <Input id="crop" placeholder="e.g. Cotton, Soybean, Wheat, Rice" {...form.register('crop')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_pest">Target Pest / Disease</Label>
                <Input id="target_pest" placeholder="e.g. Aphids, Stem Borer, Bollworm" {...form.register('target_pest')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pack_size">Pack Size</Label>
                <Input id="pack_size" placeholder="e.g. 500 ml, 1 Kg, 50 Kg Bag" {...form.register('pack_size')} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="licence_number">CIB Registration / Licence Number</Label>
                <Input id="licence_number" placeholder="e.g. CIR-12345/2025/Fertilizer" {...form.register('licence_number')} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4 pt-4 border-t">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" className="bg-green-600 hover:bg-green-700 font-semibold" disabled={isSubmitting}>
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Product...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" /> {mode === 'create' ? 'Save Product' : 'Update Product'}</>
          )}
        </Button>
      </div>
    </form>
  );
}
