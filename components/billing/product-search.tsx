'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { searchProductsAction, getCategoriesAction } from '@/actions/products';
import { getBatchesAction } from '@/actions/inventory';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Package, AlertTriangle, Barcode, X, Sparkles, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { formatProductPackDisplay } from '@/lib/validations';
import { useDebounce } from '@/hooks/use-debounce';
import { MOCK_PRODUCTS, MOCK_CATEGORIES } from '@/lib/mock-data';
import { 
  isClientDemoMode, 
  getDemoProductsClient, 
  searchDemoProductsClient,
  getDemoCategoriesClient 
} from '@/lib/client-demo-store';

interface ProductSearchProps {
  onAddToCart: (item: any) => void;
}

export default function ProductSearch({ onAddToCart }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>(MOCK_CATEGORIES);
  const [allProducts, setAllProducts] = useState<any[]>([]);
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

  // Load products (demo store or real Supabase)
  const loadProducts = useCallback(async () => {
    if (isClientDemoMode()) {
      const demoList = getDemoProductsClient();
      setAllProducts(demoList);
      return;
    }

    try {
      const res = await searchProductsAction('');
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setAllProducts(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch products for billing:', err);
    }
  }, []);

  // Load categories (demo store or real Supabase)
  const loadCategories = useCallback(async () => {
    if (isClientDemoMode()) {
      setCategories(getDemoCategoriesClient());
      return;
    }

    try {
      const res = await getCategoriesAction();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setCategories(res.data);
      }
    } catch (err) {
      console.warn('Using fallback categories:', err);
    }
  }, []);

  // Initialize and listen for live product and category updates
  useEffect(() => {
    loadProducts();
    loadCategories();

    const handleProductsUpdated = () => {
      loadProducts();
      // If active search in demo mode, update search results too
      if (isClientDemoMode() && query.trim()) {
        setSearchResults(searchDemoProductsClient(query.trim()));
      }
    };
    const handleCategoriesUpdated = () => {
      loadCategories();
    };

    window.addEventListener('krushi-products-updated', handleProductsUpdated);
    window.addEventListener('krushi-categories-updated', handleCategoriesUpdated);
    return () => {
      window.removeEventListener('krushi-products-updated', handleProductsUpdated);
      window.removeEventListener('krushi-categories-updated', handleCategoriesUpdated);
    };
  }, [loadProducts, loadCategories, query]);

  // Fetch search results when debounced query changes
  useEffect(() => {
    let isCurrent = true;
    const fetchProducts = async () => {
      const trimmed = debouncedQuery.trim();
      if (!trimmed) {
        setSearchResults(null);
        return;
      }

      setLoading(true);
      try {
        if (isClientDemoMode()) {
          const results = searchDemoProductsClient(trimmed);
          if (isCurrent) setSearchResults(results);
          return;
        }

        const res = await searchProductsAction(trimmed);
        if (isCurrent) {
          if (res.success && Array.isArray(res.data)) {
            setSearchResults(res.data);
          } else {
            setSearchResults([]);
          }
        }
      } catch (error) {
        console.warn('Search action failed:', error);
        if (isCurrent) {
          setSearchResults([]);
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
    } else if (!isClientDemoMode()) {
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
      product: product,
      product_name: product.name,
      batch_id: activeBatch?.id || null,
      batch_number: activeBatch?.batch_number || null,
      unit: product.unit || undefined,
      pack_size: product.pack_size || undefined,
      product_size_value: product.product_size_value ?? undefined,
      product_size_unit: product.product_size_unit ?? undefined,
      quantity: 1,
      rate: activeBatch?.selling_price || product.selling_price || 0,
      gst_rate: product.gst_rate || 0,
      discount: 0,
      available_stock: activeBatch?.quantity_available ?? activeBatch?.stock_quantity ?? totalStock,
    };

    onAddToCart(cartItem);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm space-y-5 text-card-foreground">
      {/* ─── Header & Search ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
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
            className="pl-10 pr-10 py-5 text-base rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-primary"
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
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border pointer-events-none">
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
          className={`rounded-full px-4 py-1.5 h-auto text-sm font-semibold transition-all shrink-0 ${
            selectedCategory === 'all'
              ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm'
              : 'border-border bg-background/50 text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/50'
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
              className={`rounded-full px-4 py-1.5 h-auto text-sm font-semibold transition-all shrink-0 ${
                isSelected
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm'
                  : 'border-border bg-background/50 text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/50'
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
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm font-medium">Searching products...</p>
        </div>
      ) : displayedProducts.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-border rounded-xl p-8">
          <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-base font-semibold text-foreground">No products found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {query ? `No items matching "${query}" in this category.` : 'No products available in this category.'}
          </p>
          {(query || selectedCategory !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-primary border-primary/40 hover:bg-primary/10"
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
                className={`relative rounded-xl border p-4 flex flex-col justify-between transition-all bg-card ${
                  isOut
                    ? 'border-border/50 opacity-50 bg-muted/20'
                    : isJustAdded
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                    : 'border-border hover:border-primary/50 hover:shadow-md'
                }`}
              >
                <div>
                  {/* Category & Stock Badges */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {categoryName}
                    </span>
                    {isOut ? (
                      <span className="text-[11px] font-bold text-destructive flex items-center gap-1">
                        Out of stock
                      </span>
                    ) : isLow ? (
                      <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="h-3 w-3" /> {stock} Pieces left
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Stock: <span className="font-semibold text-foreground/90">{stock} Pieces</span>
                      </span>
                    )}
                  </div>

                  {/* Product Title */}
                  <h3 className="font-bold text-foreground text-base leading-snug line-clamp-2 mb-1" title={product.name}>
                    {product.name}
                  </h3>

                  {/* Packaging & Product Size */}
                  {formatProductPackDisplay(product) ? (
                    <div className="mb-2">
                      <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                        {formatProductPackDisplay(product)}
                      </span>
                    </div>
                  ) : product.unit ? (
                    <p className="text-xs text-muted-foreground mb-2">{product.unit}</p>
                  ) : null}
                </div>

                {/* Price and Add Button */}
                <div className="pt-3 border-t border-border flex items-center justify-between gap-2 mt-2">
                  <div>
                    <span className="text-xs text-muted-foreground block leading-none mb-0.5">Price</span>
                    <span className="text-lg md:text-xl font-black text-primary">
                      {formatCurrency(product.selling_price || 0)}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    disabled={isOut}
                    onClick={() => handleAdd(product)}
                    className={`h-9 px-3.5 rounded-lg font-bold transition-all ${
                      isJustAdded
                        ? 'bg-primary text-primary-foreground'
                        : isOut
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-95'
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
