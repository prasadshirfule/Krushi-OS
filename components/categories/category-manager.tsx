'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { createCategoryAction } from '@/actions/products';
import { isClientDemoMode, getDemoCategoriesClient, saveDemoCategoryClient } from '@/lib/client-demo-store';
import { toast } from 'sonner';
import { Plus, Grid3X3 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export function CategoryManager({ categories: initialCategories }: { categories: any[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [categoriesList, setCategoriesList] = useState<any[]>(() => {
    if (isClientDemoMode()) return getDemoCategoriesClient();
    return initialCategories;
  });

  // Listen to live category updates
  React.useEffect(() => {
    if (isClientDemoMode()) {
      setCategoriesList(getDemoCategoriesClient());
    }

    const handleUpdated = () => {
      if (isClientDemoMode()) {
        setCategoriesList(getDemoCategoriesClient());
      }
    };

    window.addEventListener('krushi-categories-updated', handleUpdated);
    return () => window.removeEventListener('krushi-categories-updated', handleUpdated);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      if (isClientDemoMode()) {
        const newCat = saveDemoCategoryClient({ name: trimmed, description: description.trim() });
        setCategoriesList(getDemoCategoriesClient());
        try {
          await createCategoryAction({ name: trimmed, description: description.trim() });
        } catch (err) {
          console.warn('Server category creation fallback in demo mode:', err);
        }
        toast.success('Category created successfully!');
        setName('');
        setDescription('');
        setOpen(false);
        router.refresh();
        return;
      }

      const res = await createCategoryAction({ name: trimmed, description: description.trim() });
      if (res.success) {
        toast.success('Category created successfully!');
        setName('');
        setDescription('');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to create category');
      }
    } catch (err: any) {
      const message = err?.message || '';
      if (message.includes('fetch failed') || message.includes('ENOTFOUND') || message.includes('network')) {
        toast.error('Unable to reach the server. Please check your network connection and Supabase configuration.');
      } else {
        toast.error(message || 'An unexpected error occurred while creating the category.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Product Categories</h2>
          <p className="text-sm text-muted-foreground">Manage product classification (Fertilizers, Pesticides, Seeds, Tools)</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700 font-semibold">
              <Plus className="h-4 w-4 mr-2" /> Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Grid3X3 className="h-5 w-5 text-primary" /> Create New Category
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="catName">Category Name</Label>
                <Input
                  id="catName"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bio-Fertilizers"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catDesc">Description</Label>
                <Textarea
                  id="catDesc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Category scope and application..."
                />
              </div>
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading}>
                {loading ? 'Creating...' : 'Save Category'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {categoriesList.length === 0 ? (
        <EmptyState
          icon={<Grid3X3 className="h-10 w-10 text-muted-foreground/50" />}
          title="No categories created yet"
          description="Categories help organize your products (e.g. Fertilizers, Pesticides, Seeds, Tools). Start by creating your first category."
          actionLabel="+ Add Category"
          actionHref="#"
        />
      ) : (
        <DataTable
          columns={[
            { accessorKey: "name", header: "Category Name" },
            { accessorKey: "description", header: "Description" },
            { 
              accessorKey: "count", 
              header: "Products Count",
              cell: ({ row }: any) => <span className="font-semibold text-primary">{row.original.count ?? 0} items</span>
            },
          ]}
          data={categoriesList}
          searchKey="name"
          searchPlaceholder="Search categories..."
        />
      )}
    </div>
  );
}
