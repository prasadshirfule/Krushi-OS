"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Phone, MapPin, Check } from "lucide-react";

interface QuickCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    name?: string;
    phone?: string;
    village?: string;
  };
  onApply: (data: { id: string; name: string; phone: string; village: string }) => void;
}

export function QuickCustomerDialog({
  open,
  onOpenChange,
  initialData,
  onApply,
}: QuickCustomerDialogProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [village, setVillage] = useState(initialData?.village || "");

  useEffect(() => {
    if (open) {
      setName(initialData?.name || "");
      setPhone(initialData?.phone || "");
      setVillage(initialData?.village || "");
    }
  }, [open, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = (name.trim() || "WALK-IN CUSTOMER").toUpperCase();
    const cleanPhone = phone.trim();
    const cleanVillage = village.trim().toUpperCase();

    onApply({
      id: `quick-${Date.now()}`,
      name: cleanName,
      phone: cleanPhone,
      village: cleanVillage,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <User className="h-5 w-5 text-primary" /> Quick Customer Details
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Enter customer details for this bill without creating a permanent registered account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Customer Name */}
          <div className="space-y-1.5">
            <Label htmlFor="quick-customer-name" className="text-sm font-semibold">
              Customer / Farmer Name <span className="text-muted-foreground text-xs font-normal">(Auto Uppercase)</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="quick-customer-name"
                placeholder="e.g. RAHUL PATIL"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                className="pl-9 h-11 text-base font-semibold uppercase tracking-wide"
                autoFocus
              />
            </div>
          </div>

          {/* Mobile Number */}
          <div className="space-y-1.5">
            <Label htmlFor="quick-customer-phone" className="text-sm font-semibold">
              Mobile Number <span className="text-muted-foreground text-xs font-normal">(Optional)</span>
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="quick-customer-phone"
                type="tel"
                maxLength={10}
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="pl-9 h-11 text-base font-mono"
              />
            </div>
          </div>

          {/* Village / Area */}
          <div className="space-y-1.5">
            <Label htmlFor="quick-customer-village" className="text-sm font-semibold">
              Village / Area <span className="text-muted-foreground text-xs font-normal">(Optional)</span>
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="quick-customer-village"
                placeholder="e.g. KAMARI"
                value={village}
                onChange={(e) => setVillage(e.target.value.toUpperCase())}
                className="pl-9 h-11 text-base font-semibold uppercase"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              <Check className="h-4 w-4 mr-1.5" /> Apply to Bill
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
