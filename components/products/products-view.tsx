'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductTable } from '@/components/products/product-table';
import { 
  isClientDemoMode, 
  getDemoProductsClient, 
  deleteDemoProductClient,
  getDemoCategoriesClient 
} from '@/lib/client-demo-store';
import { deleteProductAction } from '@/actions/products';
import { toast } from 'sonner';
import { Package, Plus, Download, AlertTriangle } from 'lucide-react';

interface ProductsViewProps {
  initialProducts?: any[];
  initialCategories?: any[];
}

export function ProductsView({ initialProducts = [], initialCategories = [] }: ProductsViewProps) {
  const [products, setProducts] = useState<any[]>(initialProducts);
  const [categories, setCategories] = useState<any[]>(initialCategories);

  const loadData = useCallback(() => {
    if (isClientDemoMode()) {
      const demoProds = getDemoProductsClient().filter(p => p.is_active !== false);
      setProducts(demoProds);
      setCategories(getDemoCategoriesClient());
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleProductsUpdated = () => {
      loadData();
    };
    const handleCategoriesUpdated = () => {
      loadData();
    };

    window.addEventListener('krushi-products-updated', handleProductsUpdated);
    window.addEventListener('krushi-categories-updated', handleCategoriesUpdated);
    return () => {
      window.removeEventListener('krushi-products-updated', handleProductsUpdated);
      window.removeEventListener('krushi-categories-updated', handleCategoriesUpdated);
    };
  }, [loadData]);

  const handleDeleteProduct = async (product: any) => {
    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) return;

    try {
      if (isClientDemoMode()) {
        deleteDemoProductClient(product.id);
        try {
          await deleteProductAction(product.id);
        } catch (e) {
          console.warn('Server action fallback in demo mode:', e);
        }
        setProducts(prev => prev.filter(p => p.id !== product.id));
        toast.success(`Product "${product.name}" deleted successfully`);
        return;
      }

      const res = await deleteProductAction(product.id);
      if (res.success) {
        setProducts(prev => prev.filter(p => p.id !== product.id));
        toast.success(`Product "${product.name}" deleted successfully`);
      } else {
        toast.error(res.error || 'Failed to delete product');
      }
    } catch (err: any) {
      console.error('Delete product error:', err);
      toast.error(err.message || 'Error deleting product');
    }
  };

  const lowStockCount = products.filter(p => {
    const stock = Number(p.current_stock ?? p.stock_quantity ?? p.stock ?? 0);
    const min = Number(p.min_stock ?? 5);
    return stock <= min;
  }).length;

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Products</h2>
          <p className="text-sm text-muted-foreground">Manage your agricultural catalog, pricing, and stock levels</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-border hover:bg-muted">
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
          <Link href="/products/new">
            <Button className="bg-primary hover:bg-primary/90 font-semibold shadow-sm">
              <Plus className="h-4 w-4 mr-1.5" /> Add Product
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Products</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{products.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Active products in catalog</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Alert</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-amber-500' : 'text-foreground'}`}>
              {lowStockCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Items at or below min threshold</p>
          </CardContent>
        </Card>
      </div>

      <ProductTable 
        initialData={products} 
        categories={categories} 
        onDelete={handleDeleteProduct} 
      />
    </div>
  );
}
