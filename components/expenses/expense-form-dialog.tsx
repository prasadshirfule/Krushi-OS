"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2 } from "lucide-react";
import { expenseSchema } from "@/lib/validations";
import { createExpenseAction } from "@/actions/expenses";
import { useRouter } from "next/navigation";

type ExpenseFormValues = z.infer<typeof expenseSchema>;

export function ExpenseFormDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: 0,
      description: "",
      payment_method: "CASH",
      date: new Date(),
    },
  });

  const onSubmit = async (data: ExpenseFormValues) => {
    setLoading(true);
    setError(null);
    try {
      const res = await createExpenseAction(data);
      if (res.success) {
        setOpen(false);
        form.reset();
        router.refresh();
      } else {
        setError(res.error || "Failed to record expense");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); setError(null); }}>
      <DialogTrigger asChild>
        <Button className="bg-primary">
          <Plus className="mr-2 h-4 w-4" /> Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Record New Expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="p-3 text-sm rounded bg-destructive/15 text-destructive font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Description *</label>
            <Textarea {...form.register("description")} placeholder="e.g. Shop rent, electricity bill, tea/snacks..." />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Amount (₹) *</label>
            <Input type="number" step="0.01" min="0.01" {...form.register("amount", { valueAsNumber: true })} />
            {form.formState.errors.amount && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.amount.message}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Payment Method *</label>
            <select
              {...form.register("payment_method")}
              className="w-full h-10 px-3 border rounded-md bg-background text-sm"
            >
              <option value="CASH">Cash</option>
              <option value="UPI">UPI / QR Code</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank Transfer / NetBanking</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Expense
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
