"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { collectPaymentAction } from "@/actions/customers";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface CollectPaymentDialogProps {
  customer?: {
    id: string;
    name: string;
    outstanding: number;
    mobile?: string;
  };
  trigger?: React.ReactNode;
}

export function CollectPaymentDialog({ customer, trigger }: CollectPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(customer ? String(customer.outstanding || '') : '');
  const [method, setMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleOpen = (val: boolean) => {
    setOpen(val);
    if (val && customer) {
      setAmount(String(customer.outstanding || ''));
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer?.id) {
      setError("No customer selected.");
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid payment amount greater than 0.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await collectPaymentAction({
        customerId: customer.id,
        amount: numAmount,
        paymentMethod: method,
        notes: notes || undefined,
      });

      if (res.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error || "Failed to record payment");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger || <Button size="sm">Collect Payment</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Collect Udhar Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {customer && (
            <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
              <div className="font-semibold">{customer.name}</div>
              {customer.mobile && <div className="text-xs text-muted-foreground">{customer.mobile}</div>}
              <div className="text-xs">
                Current Outstanding:{" "}
                <span className="font-bold text-red-600">
                  {formatCurrency(Number(customer.outstanding || 0))}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 text-sm rounded bg-destructive/15 text-destructive font-medium">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₹) *</Label>
            <Input
              id="amount"
              type="number"
              min="1"
              step="any"
              placeholder="Enter amount to collect"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-method">Payment Method *</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger id="payment-method">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="UPI">UPI / QR Code</SelectItem>
                <SelectItem value="BANK_TRANSFER">Bank Transfer / NEFT</SelectItem>
                <SelectItem value="CARD">Debit / Credit Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes / Reference</Label>
            <Input
              id="notes"
              placeholder="e.g. GooglePay Txn ID or Receipt #"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
              {loading ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
