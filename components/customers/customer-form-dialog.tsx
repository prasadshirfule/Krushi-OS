"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CustomerForm } from "./customer-form";

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (customer?: any) => void;
  customer?: any;
}

export function CustomerFormDialog({ open, onOpenChange, onSuccess, customer }: CustomerFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit Customer / Farmer" : "Add New Customer / Farmer"}</DialogTitle>
        </DialogHeader>
        <CustomerForm
          initialData={customer}
          onSuccess={(savedCustomer) => {
            if (onSuccess) onSuccess(savedCustomer);
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
