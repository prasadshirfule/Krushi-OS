'use client';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";

export function CategoryDialog({ onCreated }: { onCreated?: (cat: any) => void }) {
  const [open, setOpen] = useState(false);
  
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Category created");
    setOpen(false);
    if(onCreated) onCreated({ id: 'new', name: 'New Category' });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Add New</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Category</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input required placeholder="Category name" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea placeholder="Optional description" />
          </div>
          <Button type="submit" className="w-full">Save Category</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
