'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { searchProductsAction, getCategoriesAction } from '@/actions/products';
import { getBatchesAction } from '@/actions/inventory';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Package, AlertTriangle, Barcode, X, Sparkles, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { MOCK_PRODUCTS, MOCK_CATEGORIES } from '@/lib/mock-data';

interface ProductSearchProps {
  onAddToCart: (item: any) => void;
}

export default function ProductSearch({ onAddToCart }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>(MOCK_CATEGORIES);
  const [allProducts, setAllProducts] = useState<any[]>(MOCK_PRODUCTS);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Keyboard shortcut F4 to focus search
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

  // Fetch categories on mount
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await getCategoriesAction();
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setCategories(res.data);
        }
      } catch (err) {
        console.warn('Using fallback categories:', err);
      }
    };
    fetchCats();
  }, []);

  // Fetch initial products or search results
  useEffect(() => {
    let isCurrent = true;
    const fetchProducts = async () => {
      if (!debouncedQuery.trim()) {
        setSearchResults(null);
        return;
      }

      setLoading(true);
      try {
        const res = await searchProductsAction(debouncedQuery.trim());
        if (isCurrent) {
          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            setSearchResults(res.data);
          } else {
            // Fallback search in mock data
            const q = debouncedQuery.toLowerCase();
            const fallback = MOCK_PRODUCTS.filter(p =>
              p.name.toLowerCase().includes(q) ||
              (p.barcode && p.barcode.includes(q)) ||
              (p.category?.name && p.category.name.toLowerCase().includes(q))
            );
            setSearchResults(fallback);
          }
        }
      } catch (error) {
        console.warn('Search action failed, using local mock data:', error);
        if (isCurrent) {
          const q = debouncedQuery.toLowerCase();
          const fallback = MOCK_PRODUCTS.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.barcode && p.barcode.includes(q))
          );
          setSearchResults(fallback);
        }
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    fetchProducts();
    return () => { isCurrent = false; };
  }, [debouncedQuery]);

  // Filter products by selected category and active search
  const displayedProducts = useMemo(() => {
    const baseList = searchResults !== null ? searchResults : allProducts;

    if (selectedCategory === 'all') {
      return baseList;
    }

    return baseList.filter(p => {
      const catId = p.category_id || p.category?.id;
      const catName = (typeof p.category === 'string' ? p.category : p.category?.name || '').toLowerCase();
      const targetCat = categories.find(c => c.id === selectedCategory);
      const targetName = targetCat ? targetCat.name.toLowerCase() : '';

      return catId === selectedCategory || (targetName && catName === targetName);
    });
  }, [searchResults, allProducts, selectedCategory, categories]);

  // Handle adding product to cart
  const handleAdd = async (product: any) => {
    const totalStock = product.current_stock ?? product.stock_quantity ?? product.stock ?? 0;
    if (totalStock === 0) return;

    // Visual feedback for added item
    setAddedProductId(product.id);
    setTimeout(() => setAddedProductId(null), 700);

    let activeBatch: any = null;

    if (product.batches && Array.isArray(product.batches) && product.batches.length > 0) {
      activeBatch = product.batches.find((b: any) => {
        const qty = b.quantity_available ?? b.stock_quantity ?? 0;
        const exp = b.expiry_date || b.exp_date;
        return qty > 0 && (!exp || new Date(exp) > new Date());
      }) || product.batches[0];
    } else {
      try {
        const batchesRes = await getBatchesAction(product.id);
        if (batchesRes.success && Array.isArray(batchesRes.data) && batchesRes.data.length > 0) {
          activeBatch = batchesRes.data.find((b: any) => {
            const qty = b.quantity_available ?? b.stock_quantity ?? 0;
            const exp = b.expiry_date || b.exp_date;
            return qty > 0 && (!exp || new Date(exp) > new Date());
          }) || batchesRes.data[0];
        }
      } catch (err) {
        console.warn('Batch lookup failed, using default product values:', err);
      }
    }

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
  };

  return (
    <section className="rounded-2xl border-2 border-green-100 bg-white p-5 md:p-6 shadow-sm space-y-5">
      {/* ─── Header & Search ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
            <Package className="h-5 w-5 text-green-700" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Select Products</h2>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search product or barcode (F4)..."
            className="pl-10 pr-10 py-5 text-base rounded-xl border-2 focus-visible:border-green-500"
          />
          {query ? (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border pointer-events-none">
              <Barcode className="h-3 w-3" /> F4
            </div>
          )}
        </div>
      </div>

      {/* ─── Category Filter Buttons ─── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Button
          type="button"
          size="sm"
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          className={`rounded-full px-4 py-2 h-auto text-sm font-semibold transition-all shrink-0 ${
            selectedCategory === 'all'
              ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm'
              : 'hover:bg-green-50 hover:text-green-700 hover:border-green-300'
          }`}
          onClick={() => setSelectedCategory('all')}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" /> All Products
        </Button>
        {categories.map(cat => {
          const isSelected = selectedCategory === cat.id;
          return (
            <Button
              key={cat.id}
              type="button"
              size="sm"
              variant={isSelected ? 'default' : 'outline'}
              className={`rounded-full px-4 py-2 h-auto text-sm font-semibold transition-all shrink-0 ${
                isSelected
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm'
                  : 'hover:bg-green-50 hover:text-green-700 hover:border-green-300'
              }`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </Button>
          );
        })}
      </div>

      {/* ─── Products Grid ─── */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-full border-4 border-green-600 border-t-transparent animate-spin" />
          <p className="text-sm font-medium">Searching products...</p>
        </div>
      ) : displayedProducts.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-xl p-8">
          <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-base font-semibold text-gray-700">No products found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {query ? `No items matching "${query}" in this category.` : 'No products available in this category.'}
          </p>
          {(query || selectedCategory !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-green-700 border-green-300 hover:bg-green-50"
              onClick={() => {
                setQuery('');
                setSelectedCategory('all');
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {displayedProducts.map(product => {
            const stock = product.current_stock ?? product.stock_quantity ?? product.stock ?? 0;
            const isOut = stock === 0;
            const isLow = stock > 0 && stock <= 5;
            const isJustAdded = addedProductId === product.id;
            const categoryName = typeof product.category === 'string'
              ? product.category
              : product.category?.name || 'Agro';

            return (
              <div
                key={product.id}
                className={`relative rounded-xl border-2 p-4 flex flex-col justify-between transition-all bg-white hover:shadow-md ${
                  isOut
                    ? 'border-gray-200 opacity-60 bg-gray-50/50'
                    : isJustAdded
                    ? 'border-green-500 bg-green-50/30 ring-2 ring-green-400'
                    : 'border-gray-100 hover:border-green-300'
                }`}
              >
                <div>
                  {/* Category & Stock Badges */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                      {categoryName}
                    </span>
                    {isOut ? (
                      <span className="text-[11px] font-bold text-destructive flex items-center gap-1">
                        Out of stock
                      </span>
                    ) : isLow ? (
                      <span className="text-[11px] font-semibold text-amber-600 flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="h-3 w-3" /> {stock} left
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Stock: {stock}
                      </span>
                    )}
                  </div>

                  {/* Product Title */}
                  <h3 className="font-bold text-gray-900 text-base leading-snug line-clamp-2 mb-1" title={product.name}>
                    {product.name}
                  </h3>

                  {/* Packing / Unit */}
                  {product.unit && (
                    <p className="text-xs text-muted-foreground mb-3">{product.unit}</p>
                  )}
                </div>

                {/* Price and Add Button */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2 mt-2">
                  <div>
                    <span className="text-xs text-muted-foreground block leading-none mb-0.5">Price</span>
                    <span className="text-lg md:text-xl font-black text-green-700">
                      {formatCurrency(product.selling_price || 0)}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    disabled={isOut}
                    onClick={() => handleAdd(product)}
                    className={`h-10 px-4 rounded-xl font-bold transition-all ${
                      isJustAdded
                        ? 'bg-emerald-600 text-white'
                        : isOut
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white shadow-sm active:scale-95'
                    }`}
                  >
                    {isJustAdded ? (
                      <>
                        <Check className="h-4 w-4 mr-1" /> Added
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1 stroke-[3]" /> Add
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
