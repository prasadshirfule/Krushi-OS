import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomerLedger } from '@/components/customers/customer-ledger';
import Link from 'next/link';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/customers" className="text-muted-foreground hover:text-foreground">
            &larr; Back
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Customer Details</h1>
        </div>
        <div className="space-x-2">
          <Button variant="outline">Edit</Button>
          <Button>Collect Payment</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="col-span-1 rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="font-semibold text-lg mb-4">Overview</h3>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Name:</span> Ramesh Patel</p>
            <p><span className="font-medium">Mobile:</span> +91 9876543210</p>
            <p><span className="font-medium">Village:</span> Rampur</p>
            <p><span className="font-medium">Farm Size:</span> 5 Acres</p>
            <p><span className="font-medium">Crops:</span> Wheat, Cotton</p>
          </div>
        </div>
        <div className="col-span-3 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
            <h3 className="text-sm font-medium">Total Purchases</h3>
            <div className="text-2xl font-bold mt-2">₹50,000</div>
          </div>
          <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
            <h3 className="text-sm font-medium">Total Paid</h3>
            <div className="text-2xl font-bold mt-2 text-green-600">₹38,000</div>
          </div>
          <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
            <h3 className="text-sm font-medium">Outstanding</h3>
            <div className="text-2xl font-bold mt-2 text-red-600">₹12,000</div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="ledger" className="w-full">
        <TabsList>
          <TabsTrigger value="ledger">Credit Ledger</TabsTrigger>
          <TabsTrigger value="purchases">Purchase History</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="ledger" className="mt-4">
          <CustomerLedger customerId={id} />
        </TabsContent>
        <TabsContent value="purchases" className="mt-4">
          <div className="p-4 border rounded-lg text-center text-muted-foreground">Purchase history table will appear here.</div>
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <div className="p-4 border rounded-lg text-center text-muted-foreground">Payment history table will appear here.</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
