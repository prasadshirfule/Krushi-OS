'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Printer, Layers, Package, Building2 } from 'lucide-react';
import { getProductsAction } from '@/actions/products';
import { isClientDemoMode, getDemoProductsClient } from '@/lib/client-demo-store';
import { getSavedShopDetails } from '@/lib/shop-details';
import {
  exportCategoryProductReportPDF,
  printCategoryProductReport,
  formatCurrencyValue,
} from '@/lib/report-export';
import { formatProductPackDisplay } from '@/lib/validations';
import { useLanguage } from '@/lib/i18n';
import { toast } from 'sonner';

interface CategoryReportDialogProps {
  category: { id: string; name: string; description?: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryReportDialog({
  category,
  open,
  onOpenChange,
}: CategoryReportDialogProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !category) {
      setProducts([]);
      return;
    }

    let isCancelled = false;
    setLoading(true);

    const loadProducts = async () => {
      let matched: any[] = [];

      // 1. Check client demo store first
      if (isClientDemoMode()) {
        const demoProds = getDemoProductsClient();
        matched = demoProds.filter(
          (p) =>
            p.category_id === category.id ||
            p.category?.id === category.id ||
            (p.category?.name && p.category.name.toUpperCase() === category.name.toUpperCase())
        );
      }

      // 2. Fetch from server action
      try {
        const res = await getProductsAction({ category: category.id, limit: 200 });
        if (res.success && res.data?.products && Array.isArray(res.data.products)) {
          if (res.data.products.length > 0 || !isClientDemoMode()) {
            matched = res.data.products;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch category products from server:', err);
      }

      if (!isCancelled) {
        setProducts(matched);
        setLoading(false);
      }
    };

    loadProducts();
    return () => {
      isCancelled = true;
    };
  }, [open, category]);

  if (!category) return null;

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

  const inStockCount = products.filter(
    (p) => Number(p.current_stock ?? p.stock_quantity ?? p.stock ?? 0) > 0
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="space-y-2 pb-3 border-b border-border/70">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span>{t('categories.reportTitle', 'Category Report')}</span>
                  <span className="text-muted-foreground font-normal">–</span>
                  <span className="text-primary font-bold">{category.name}</span>
                </DialogTitle>
                {category.description && (
                  <DialogDescription className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {category.description}
                  </DialogDescription>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 font-semibold text-xs border-border"
                onClick={handlePrint}
                disabled={loading || products.length === 0}
              >
                <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t('categories.printReport', 'Print Report')}</span>
              </Button>
              <Button
                size="sm"
                className="h-9 gap-1.5 font-semibold text-xs bg-green-600 hover:bg-green-700 text-white shadow-xs"
                onClick={handleDownloadPDF}
                disabled={loading || products.length === 0}
              >
                <Download className="h-3.5 w-3.5" />
                <span>{t('categories.downloadPdf', 'Download PDF')}</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2 text-xs font-semibold text-muted-foreground">
            <Badge variant="secondary" className="gap-1.5 py-1 px-2.5 font-bold">
              <Package className="h-3.5 w-3.5 text-primary" />
              <span>{t('categories.totalProducts', 'Total Products')}:</span>
              <span className="text-foreground">{products.length}</span>
            </Badge>
            <Badge variant="outline" className="gap-1.5 py-1 px-2.5 font-bold border-green-600/30 text-green-700 dark:text-green-400">
              <span>{t('categories.inStock', 'In Stock')}:</span>
              <span>{inStockCount}</span>
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <span className="text-sm font-medium">{t('common.loading', 'Loading...')}</span>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground space-y-2">
              <Package className="h-10 w-10 text-muted-foreground/40 stroke-1" />
              <p className="text-sm font-medium">
                {t('categories.noProductsInCategory', 'No products registered under this category yet.')}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-muted/40 text-xs font-bold text-muted-foreground uppercase border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">#</th>
                    <th className="py-2.5 px-4">Product Name</th>
                    <th className="py-2.5 px-4">Manufacturer / Company</th>
                    <th className="py-2.5 px-4 text-center">Size / Unit</th>
                    <th className="py-2.5 px-4 text-right">Selling Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {products.map((prod, idx) => {
                    const sizeStr = formatProductPackDisplay(prod) || prod.pack_size || prod.unit || '–';
                    const brandName = prod.brand?.name || prod.brand?.manufacturer || prod.brand_name || prod.manufacturer || '–';

                    return (
                      <tr key={prod.id || idx} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 text-center text-xs font-mono text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-foreground">
                          {prod.name}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                          <Building2 className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                          <span>{brandName}</span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <Badge variant="outline" className="font-semibold text-xs">
                            {sizeStr}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-primary text-sm">
                          {formatCurrencyValue(prod.selling_price)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
