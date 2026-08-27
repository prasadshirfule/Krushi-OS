'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function BatchFormDialog({ productId }: { productId: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Add Batch</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Batch</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Form fields for batch...</p>
          <Button className="w-full">Save Batch</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
