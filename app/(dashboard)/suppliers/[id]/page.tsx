import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/suppliers" className="text-muted-foreground hover:text-foreground">
            &larr; Back
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Supplier Details</h1>
        </div>
        <div className="space-x-2">
          <Button variant="outline">Edit</Button>
          <Button>Make Payment</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="col-span-1 rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="font-semibold text-lg mb-4">Overview</h3>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Name:</span> Amit Shah</p>
            <p><span className="font-medium">Company:</span> Agri Seeds Ltd</p>
            <p><span className="font-medium">Mobile:</span> +91 9988776655</p>
            <p><span className="font-medium">GST No:</span> 24AAACC1206D1Z1</p>
          </div>
        </div>
        <div className="col-span-3 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
            <h3 className="text-sm font-medium">Total Purchases</h3>
            <div className="text-2xl font-bold mt-2">₹5,00,000</div>
          </div>
          <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
            <h3 className="text-sm font-medium">Total Paid</h3>
            <div className="text-2xl font-bold mt-2 text-green-600">₹3,75,000</div>
          </div>
          <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
            <h3 className="text-sm font-medium">Outstanding</h3>
            <div className="text-2xl font-bold mt-2 text-red-600">₹1,25,000</div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="purchases" className="w-full">
        <TabsList>
          <TabsTrigger value="purchases">Purchase History</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>
        <TabsContent value="purchases" className="mt-4">
          <div className="p-4 border rounded-lg text-center text-muted-foreground">Purchase history table will appear here.</div>
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <div className="p-4 border rounded-lg text-center text-muted-foreground">Payment history table will appear here.</div>
        </TabsContent>
        <TabsContent value="ledger" className="mt-4">
          <div className="p-4 border rounded-lg text-center text-muted-foreground">Supplier ledger will appear here.</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
