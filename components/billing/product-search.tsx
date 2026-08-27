'use client';

import React, { useState, useEffect, useRef } from 'react';
import { searchProductsAction } from '@/actions/products';
import { getBatchesAction } from '@/actions/inventory';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ShoppingCart, AlertTriangle, PackageOpen } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';

export default function ProductSearch({ onAddToCart }: { onAddToCart: (item: any) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (debouncedQuery.length > 1) {
      const fetchProducts = async () => {
        setLoading(true);
        try {
          const res = await searchProductsAction(debouncedQuery);
          if (res.success && Array.isArray(res.data)) {
            setResults(res.data);
          } else {
            setResults([]);
          }
        } catch (error) {
          console.error(error);
          setResults([]);
        } finally {
          setLoading(false);
        }
      };
      fetchProducts();
    } else {
      setResults([]);
    }
  }, [debouncedQuery]);

  const handleAdd = async (product: any) => {
    const totalStock = product.current_stock ?? product.stock_quantity ?? product.stock ?? 0;
    if (totalStock === 0) return;
    
    try {
      const batchesRes = await getBatchesAction(product.id);
      const batches = batchesRes.success && Array.isArray(batchesRes.data) ? batchesRes.data : [];
      
      const activeBatch = batches.find((b: any) => {
        const qty = b.quantity_available ?? b.stock_quantity ?? 0;
        const exp = b.expiry_date || b.exp_date;
        return qty > 0 && (!exp || new Date(exp) > new Date());
      });
      
      const cartItem = {
        product_id: product.id,
        product_name: product.name,
        batch_id: activeBatch?.id || null,
        batch_number: activeBatch?.batch_number || null,
        quantity: 1,
        rate: activeBatch?.selling_price || product.selling_price || 0,
        gst_rate: product.gst_rate || 0,
        discount: 0,
        available_stock: activeBatch?.quantity_available ?? activeBatch?.stock_quantity ?? totalStock,
      };
      
      onAddToCart(cartItem);
      
      setRecentProducts(prev => [product, ...prev.filter(p => p.id !== product.id)].slice(0, 10));
      setQuery('');
      searchInputRef.current?.focus();
    } catch (error) {
      console.error('Failed to add product to cart', error);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input 
          ref={searchInputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search product or scan barcode (F4)..."
          className="pl-9 text-lg py-6"
          autoFocus
        />
      </div>

      <div className="flex-1 overflow-y-auto border rounded-md">
        {loading && <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>}
        
        {!loading && query && results.length === 0 && (
          <div className="flex flex-col items-center justify-center p-6 gap-2">
            <PackageOpen className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No products found for &ldquo;{query}&rdquo;</p>
            <p className="text-[11px] text-muted-foreground/70 text-center">
              Need to add products first?{' '}
              <Link href="/products/new" className="text-primary underline">Add Product</Link>
            </p>
          </div>
        )}

        {!query && recentProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 gap-2">
            <PackageOpen className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">Search for a product to begin</p>
            <p className="text-xs text-muted-foreground text-center max-w-[220px]">
              Type a product name, SKU, or scan a barcode above.
            </p>
          </div>
        )}

        {!query && recentProducts.length > 0 && (
          <div className="p-2 bg-muted/50 text-xs font-semibold uppercase">Recent Products</div>
        )}

        <ul className="divide-y">
          {(query ? results : recentProducts).map(product => {
            const stock = product.current_stock ?? product.stock_quantity ?? product.stock ?? 0;
            return (
              <li 
                key={product.id} 
                className={`p-3 flex justify-between items-center hover:bg-muted/50 cursor-pointer ${stock === 0 ? 'opacity-50' : ''}`}
                onClick={() => handleAdd(product)}
              >
                <div>
                  <div className="font-medium">{product.name}</div>
                  <div className="text-xs text-muted-foreground">{product.category || product.unit || 'Product'} | Stock: {stock}</div>
                  {stock > 0 && stock <= 5 && (
                    <div className="text-xs text-orange-500 flex items-center gap-1 mt-1">
                      <AlertTriangle className="h-3 w-3" /> Low Stock
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="font-semibold">{formatCurrency(product.selling_price || 0)}</span>
                  {stock === 0 ? (
                    <span className="text-xs text-destructive font-bold">Out of stock</span>
                  ) : (
                    <Button size="sm" variant="secondary" className="h-7 text-xs">
                      <ShoppingCart className="h-3 w-3 mr-1" /> Add
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
