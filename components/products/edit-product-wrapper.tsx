'use client';

import React, { useState, useEffect } from 'react';
import { ProductForm } from '@/components/products/product-form';
import { isClientDemoMode, getDemoProductByIdClient, getDemoCategoriesClient } from '@/lib/client-demo-store';
import { EmptyState } from '@/components/ui/empty-state';
import { Package } from 'lucide-react';

interface EditProductWrapperProps {
  productId: string;
  ssrProduct?: any;
  categories: any[];
  brands: any[];
}

export function EditProductWrapper({ productId, ssrProduct, categories, brands }: EditProductWrapperProps) {
  const [product, setProduct] = useState<any>(ssrProduct);
  const [loading, setLoading] = useState(!ssrProduct);

  useEffect(() => {
    if (ssrProduct) {
      setProduct(ssrProduct);
      setLoading(false);
      return;
    }

    if (isClientDemoMode()) {
      const found = getDemoProductByIdClient(productId);
      if (found) {
        setProduct(found);
      }
    }
    setLoading(false);
  }, [productId, ssrProduct]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <EmptyState
          icon={<Package className="h-10 w-10 text-muted-foreground/50" />}
          title="Product Not Found"
          description="The requested product could not be located in your catalog."
          actionLabel="Back to Products"
          actionHref="/products"
        />
      </div>
    );
  }

  const finalCategories = categories.length > 0
    ? categories
    : (isClientDemoMode() ? getDemoCategoriesClient() : []);

  return (
    <ProductForm 
      mode="edit" 
      initialData={product} 
      categories={finalCategories} 
      brands={brands} 
    />
  );
}
