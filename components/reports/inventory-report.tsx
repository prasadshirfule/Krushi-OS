"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function InventoryReport() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="current">
        <TabsList>
          <TabsTrigger value="current">Current Stock</TabsTrigger>
          <TabsTrigger value="low">Low Stock</TabsTrigger>
          <TabsTrigger value="expiring">Expiring</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
          <TabsTrigger value="value">Stock Value</TabsTrigger>
        </TabsList>
        <TabsContent value="current">
          <div className="p-4 border rounded-md bg-card">Current Stock Table Placeholder</div>
        </TabsContent>
        <TabsContent value="low">
          <div className="p-4 border rounded-md bg-card">Low Stock Table Placeholder</div>
        </TabsContent>
        <TabsContent value="expiring">
          <div className="p-4 border rounded-md bg-card">Expiring Table Placeholder</div>
        </TabsContent>
        <TabsContent value="expired">
          <div className="p-4 border rounded-md bg-card">Expired Table Placeholder</div>
        </TabsContent>
        <TabsContent value="value">
          <div className="p-4 border rounded-md bg-card">Stock Value Details Placeholder</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
