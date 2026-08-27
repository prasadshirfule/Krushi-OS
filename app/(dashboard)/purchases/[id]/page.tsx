import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/purchases" className="text-muted-foreground hover:text-foreground">
            &larr; Back
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Details</h1>
        </div>
        <Button variant="outline">Print Invoice</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="font-semibold text-lg mb-4">Supplier Information</h3>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Name:</span> Agri Seeds Ltd</p>
            <p><span className="font-medium">GST No:</span> 24AAACC1206D1Z1</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="font-semibold text-lg mb-4">Purchase Details</h3>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Invoice No:</span> INV-001</p>
            <p><span className="font-medium">Date:</span> 2023-10-27</p>
            <p><span className="font-medium">Status:</span> Pending</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card text-card-foreground shadow overflow-hidden">
        <div className="p-6">
          <h3 className="font-semibold text-lg mb-4">Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Exp Date</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">GST</th>
                  <th className="px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-3 font-medium">Urea 50kg</td>
                  <td className="px-4 py-3">B001</td>
                  <td className="px-4 py-3">12/2025</td>
                  <td className="px-4 py-3">100</td>
                  <td className="px-4 py-3">₹250.00</td>
                  <td className="px-4 py-3">5%</td>
                  <td className="px-4 py-3">₹26,250.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="w-full md:w-1/3 rounded-xl border bg-card text-card-foreground shadow p-6 space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">₹25,000.00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span className="font-medium">₹1,250.00</span>
          </div>
          <div className="flex justify-between pt-3 border-t text-lg font-bold">
            <span>Total</span>
            <span>₹26,250.00</span>
          </div>
          <div className="flex justify-between pt-3 text-red-500 font-medium">
            <span>Amount Due</span>
            <span>₹26,250.00</span>
          </div>
        </div>
      </div>
    </div>
  );
}
