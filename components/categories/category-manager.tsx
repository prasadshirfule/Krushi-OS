'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { createCategoryAction } from '@/actions/products';
import { toast } from 'sonner';
import { Plus, Grid3X3 } from 'lucide-react';

export function CategoryManager({ categories }: { categories: any[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await createCategoryAction({ name, description });
      if (res.success) {
        toast.success('Category created successfully!');
        setName('');
        setDescription('');
        setOpen(false);
      } else {
        toast.error(res.error || 'Failed to create category');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating category');
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
        data={categories}
        searchKey="name"
        searchPlaceholder="Search categories..."
      />
    </div>
  );
}
