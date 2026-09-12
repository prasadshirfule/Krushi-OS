'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Layers, 
  Package, 
  Search, 
  Plus, 
  Printer, 
  Download, 
  Building2, 
  Edit, 
  Eye, 
  CheckCircle2,
  Boxes
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { isClientDemoMode, getDemoProductsClient, getDemoCategoriesClient } from '@/lib/client-demo-store';
import { formatProductPackDisplay, formatToDDMMYYYY } from '@/lib/validations';
import { formatCurrency } from '@/lib/utils';
import { getSavedShopDetails } from '@/lib/shop-details';
import { exportCategoryProductReportPDF, printCategoryProductReport } from '@/lib/report-export';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';

interface CategoryProductsClientProps {
  category: {
    id: string;
    name: string;
    description?: string | null;
    count?: number;
  };
  initialProducts: any[];
}

export function CategoryProductsClient({ category: initialCategory, initialProducts }: CategoryProductsClientProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [category, setCategory] = useState(initialCategory);
  const [products, setProducts] = useState<any[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState('');

  // Synchronize with demo store & live event bus
  useEffect(() => {
    const syncData = () => {
      if (isClientDemoMode()) {
        const demoCats = getDemoCategoriesClient();
        const foundCat = demoCats.find(c => String(c.id) === String(initialCategory.id));
        if (foundCat) setCategory(foundCat);

        const demoProds = getDemoProductsClient();
        const matched = demoProds.filter(
          p =>
            p.is_active !== false &&
            (p.category_id === initialCategory.id ||
              p.category?.id === initialCategory.id ||
              (p.category?.name && p.category.name.toUpperCase() === (foundCat?.name || initialCategory.name).toUpperCase()))
        );
        setProducts(matched);
      }
    };

    syncData();

    window.addEventListener('krushi-products-updated', syncData);
    window.addEventListener('krushi-categories-updated', syncData);
    return () => {
      window.removeEventListener('krushi-products-updated', syncData);
      window.removeEventListener('krushi-categories-updated', syncData);
    };
  }, [initialCategory]);

  const filteredProducts = products.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (p.name || '').toLowerCase().includes(q);
    const skuMatch = (p.sku || '').toLowerCase().includes(q);
    const barcodeMatch = (p.barcode || '').toLowerCase().includes(q);
    const brandMatch = (p.brand?.name || p.brand?.manufacturer || p.manufacturer || '').toLowerCase().includes(q);
    return nameMatch || skuMatch || barcodeMatch || brandMatch;
  });

  const inStockCount = products.filter(
    p => Number(p.current_stock ?? p.stock_quantity ?? p.stock ?? 0) > 0
  ).length;

  const handleDownloadPDF = async () => {
    try {
      const shop = getSavedShopDetails();
      await exportCategoryProductReportPDF(category, products, shop);
      toast.success(t('common.downloadPdf', 'Download PDF') + ' ' + t('common.success', 'Success'));
    } catch (err: any) {
      console.error('PDF export error:', err);
      toast.error('Failed to export category report PDF');
    }
  };

  const handlePrint = () => {
    try {
      const shop = getSavedShopDetails();
      printCategoryProductReport(category, products, shop);
    } catch (err: any) {
      console.error('Print error:', err);
      toast.error('Failed to open print dialog');
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header & Breadcrumb ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/categories"
            className="h-10 w-10 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-xs"
            title="Back to Categories"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Link href="/categories" className="hover:text-primary transition-colors">
                Categories
              </Link>
              <span>/</span>
              <span className="text-foreground">{category.name}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5 mt-0.5">
              <Layers className="h-7 w-7 text-primary" />
              <span>{category.name}</span>
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 font-semibold text-xs border-border"
            onClick={handlePrint}
            disabled={products.length === 0}
          >
            <Printer className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Print Report</span>
          </Button>

          <Button
            size="sm"
            className="h-9 gap-1.5 font-semibold text-xs bg-green-600 hover:bg-green-700 text-white shadow-xs"
            onClick={handleDownloadPDF}
            disabled={products.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download PDF</span>
          </Button>

          <Link href="/products/new">
            <Button size="sm" className="h-9 gap-1.5 font-semibold text-xs shadow-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>Add Product</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* ─── Description & Stats Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Category Scope & Details
          </p>
          <p className="text-sm text-foreground">
            {category.description || 'All registered products classified under this category.'}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex items-center justify-around gap-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground font-semibold">Total Products</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">{products.length}</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground font-semibold">In Stock</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-0.5">{inStockCount}</p>
          </div>
        </div>
      </div>

      {/* ─── Search Bar ─── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Filter products in this category by name, brand, SKU, or barcode..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10 h-11 text-sm bg-background border-border"
        />
      </div>

      {/* ─── Product Table / Responsive List ─── */}
      {filteredProducts.length === 0 ? (
        products.length === 0 ? (
          <EmptyState
            icon={<Package className="h-10 w-10 text-muted-foreground/40" />}
            title="No products in this category"
            description={`You haven't added any products to ${category.name} yet.`}
            actionLabel="+ Add Product"
            actionHref="/products/new"
          />
        ) : (
          <div className="py-12 text-center border-2 border-dashed border-border rounded-xl p-8">
            <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-base font-semibold text-foreground">No matching products</p>
            <p className="text-sm text-muted-foreground mt-1">
              No products in {category.name} match &ldquo;{searchQuery}&rdquo;.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-primary border-primary/40 hover:bg-primary/10"
              onClick={() => setSearchQuery('')}
            >
              Clear Search Filter
            </Button>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-muted/50 text-xs font-bold text-muted-foreground uppercase border-b border-border">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Manufacturer / Company</th>
                  <th className="py-3 px-4 text-center">Pack Size</th>
                  <th className="py-3 px-4 text-right">Selling Price</th>
                  <th className="py-3 px-4 text-center">Stock</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredProducts.map((prod, idx) => {
                  const sizeStr = formatProductPackDisplay(prod) || prod.pack_size || prod.unit || '–';
                  const brandName = prod.brand?.name || prod.brand?.manufacturer || prod.brand_name || prod.manufacturer || '–';
                  const stock = Number(prod.current_stock ?? prod.stock_quantity ?? prod.stock ?? 0);
                  const minStock = Number(prod.min_stock ?? 5);
                  const isLow = stock <= minStock;
                  const isActive = prod.is_active !== false;
                  const firstBatch = prod.batches?.[0];
                  const batchNo = prod.batch_number || firstBatch?.batch_number;
                  const rawExp = prod.expiry_date || firstBatch?.expiry_date || firstBatch?.exp_date;
                  const expStr = rawExp ? formatToDDMMYYYY(rawExp) : null;

                  return (
                    <tr key={prod.id || idx} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-center text-xs font-mono text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <Link
                            href={`/products/${prod.id}`}
                            className="font-bold text-foreground hover:text-primary hover:underline block leading-snug"
                          >
                            {prod.name}
                          </Link>
                          {(batchNo || expStr) && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {batchNo && <span>Batch: <span className="font-mono text-foreground/80">{batchNo}</span></span>}
                              {batchNo && expStr && <span>•</span>}
                              {expStr && <span>Exp: <span className="text-foreground/80">{expStr}</span></span>}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                          <span>{brandName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className="font-semibold text-xs">
                          {sizeStr}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-primary text-sm">
                        {formatCurrency(Number(prod.selling_price || 0))}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-bold text-sm ${stock === 0 ? 'text-destructive' : isLow ? 'text-amber-500' : 'text-foreground'}`}>
                          {stock} Pieces
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={isActive ? 'default' : 'secondary'} className="text-[11px] font-semibold">
                          {isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/products/${prod.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="View Details">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href={`/products/${prod.id}/edit`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Edit Product">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
