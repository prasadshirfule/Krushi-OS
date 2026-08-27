'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function StockAdjustmentDialog({ open, onOpenChange, product }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock for {product?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Form content goes here...</p>
          <Button className="w-full">Save Adjustment</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
