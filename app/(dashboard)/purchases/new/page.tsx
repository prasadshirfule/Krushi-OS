"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export default function NewPurchasePage() {
  const [items, setItems] = useState([{ id: 1, product: "", batch: "", mfgDate: "", expDate: "", qty: 1, price: 0, gst: 0 }]);
  
  const addItem = () => {
    setItems([...items, { id: items.length + 1, product: "", batch: "", mfgDate: "", expDate: "", qty: 1, price: 0, gst: 0 }]);
  };

  const removeItem = (id: number) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Purchase recorded successfully");
    // Redirect logic would go here
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">New Purchase</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Supplier Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <label className="text-sm font-medium">Select Supplier</label>
               <Input placeholder="Supplier Search..." />
             </div>
             <div className="space-y-2">
               <label className="text-sm font-medium">Invoice Number</label>
               <Input placeholder="Invoice #" />
             </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Purchase Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="flex gap-2 items-end border-b pb-4">
                <div className="grid grid-cols-7 gap-2 flex-1">
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs">Product</label>
                    <Input placeholder="Product name" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs">Batch</label>
                    <Input placeholder="Batch No" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs">Exp Date</label>
                    <Input type="month" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs">Qty</label>
                    <Input type="number" min="1" defaultValue="1" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs">Rate (₹)</label>
                    <Input type="number" min="0" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs">GST %</label>
                    <Input type="number" min="0" max="28" />
                  </div>
                </div>
                <Button type="button" variant="destructive" size="icon" onClick={() => removeItem(item.id)}>
                  &times;
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addItem}>+ Add Item</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary & Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center text-lg">
              <span>Subtotal:</span>
              <span>₹0.00</span>
            </div>
            <div className="flex justify-between items-center text-lg">
              <span>Tax Amount:</span>
              <span>₹0.00</span>
            </div>
            <div className="flex justify-between items-center text-xl font-bold border-t pt-2">
              <span>Total Amount:</span>
              <span>₹0.00</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Amount</label>
                <Input type="number" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Method</label>
                <Input placeholder="Cash / Bank Transfer" />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Textarea placeholder="Any notes regarding this purchase" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline">Cancel</Button>
          <Button type="submit">Complete Purchase</Button>
        </div>
      </form>
    </div>
  );
}
