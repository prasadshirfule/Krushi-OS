import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BatchList } from "@/components/inventory/batch-list";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Product Details</h2>
        <div className="flex items-center space-x-2">
          <Link href={`/products/${id}/edit`}>
            <Button>Edit Product</Button>
          </Link>
        </div>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="history">Stock History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Product ID: {id}</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="batches">
          <BatchList productId={id} initialBatches={[]} />
        </TabsContent>
        <TabsContent value="history">
          <p>Stock History (Coming Soon)</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
