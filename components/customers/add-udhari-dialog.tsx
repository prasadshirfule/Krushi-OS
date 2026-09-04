"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  isClientDemoMode,
  addDemoUdhariClient,
} from "@/lib/client-demo-store";
// import { addUdhariAction } from "@/actions/customers"; // Assuming this might exist later

interface AddUdhariDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  outstanding: number;
  onSuccess?: () => void;
}

export function AddUdhariDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  outstanding,
  onSuccess,
}: AddUdhariDialogProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = (val: boolean) => {
    onOpenChange(val);
    if (val) {
      setAmount("");
      setDescription("");
      setDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Enter a valid amount greater than ₹0.");
      return;
    }
    if (!description.trim()) {
      setError("Please provide a reason or description.");
      return;
    }

    setLoading(true);

    try {
      if (isClientDemoMode()) {
        addDemoUdhariClient(customerId, numAmount, description, notes || undefined);
        toast.success(`Udhari of ${formatCurrency(numAmount)} added for ${customerName}`);
        handleOpen(false);
        if (onSuccess) onSuccess();
      } else {
        // Fallback or placeholder for actual Supabase action
        // const res = await addUdhariAction({ ... });
        toast.warning("Manual Udhari addition in Supabase mode not fully implemented yet. Using demo logic.");
        addDemoUdhariClient(customerId, numAmount, description, notes || undefined);
        handleOpen(false);
        router.refresh();
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Add New Udhari</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Info */}
          <div className="rounded-lg bg-muted p-3 space-y-1">
            <div className="font-semibold text-sm">{customerName}</div>
            <div className="text-xs">
              Current Outstanding:{" "}
              <span className="font-bold text-red-600 text-base">
                {formatCurrency(outstanding)}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm rounded bg-destructive/15 text-destructive font-medium">
              {error}
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="udhari-amount">Amount <span className="text-destructive">*</span></Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
              <Input
                id="udhari-amount"
                className="pl-7"
                type="number"
                min="1"
                step="any"
                placeholder="Enter udhari amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="udhari-desc">Reason / Description <span className="text-destructive">*</span></Label>
            <Input
              id="udhari-desc"
              placeholder="e.g. Previous farm input purchase"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="udhari-date">Date</Label>
            <Input
              id="udhari-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="udhari-notes">Reference / Note (Optional)</Label>
            <Textarea
              id="udhari-notes"
              placeholder="Additional notes"
              className="resize-none h-16"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 min-w-[150px]">
              {loading ? "Saving..." : "ADD UDHARI"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
