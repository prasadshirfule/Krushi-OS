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
import { Plus } from "lucide-react";
import { expenseSchema } from "@/lib/validations";

type ExpenseFormValues = z.infer<typeof expenseSchema>;

export function ExpenseFormDialog() {
  const [open, setOpen] = useState(false);
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
    console.log(data);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-green-600 hover:bg-green-700">
          <Plus className="mr-2 h-4 w-4" /> Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea {...form.register("description")} placeholder="Expense details..." />
          </div>
          <div>
            <label className="text-sm font-medium">Amount (₹)</label>
            <Input type="number" step="0.01" {...form.register("amount", { valueAsNumber: true })} />
          </div>
          <div>
            <label className="text-sm font-medium">Payment Method</label>
            <select
              {...form.register("payment_method")}
              className="w-full h-10 px-3 border rounded-md bg-background text-sm"
            >
              <option value="CASH">CASH</option>
              <option value="UPI">UPI</option>
              <option value="CARD">CARD</option>
              <option value="BANK_TRANSFER">BANK TRANSFER</option>
            </select>
          </div>
          <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">Save Expense</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
