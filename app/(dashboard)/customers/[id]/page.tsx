import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomerLedger } from '@/components/customers/customer-ledger';
import { CustomerDetailHeader } from '@/components/customers/customer-detail-header';
import { getCustomerById } from '@/services/customers.service';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  let shopId = 'demo-shop-1';
  if (user && !isPlaceholder) {
    const { data: userData } = await supabase
      .from('users')
      .select('shop_id')
      .eq('id', user.id)
      .single();

    if (userData?.shop_id) {
      shopId = userData.shop_id;
    }
  }

  const customer = await getCustomerById(shopId, id);
  if (!customer) {
    notFound();
  }

  const totalPurchases = Number(customer.total_purchases || customer.totalPurchases || 0);
  const outstanding = Number(customer.outstanding || customer.outstanding_balance || 0);
  const totalPaid = Math.max(0, totalPurchases - outstanding);

  return (
    <div className="space-y-6 p-6">
      <CustomerDetailHeader customer={customer} />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="col-span-1 rounded-xl border border-border bg-card text-card-foreground shadow p-6">
          <h3 className="font-semibold text-lg mb-4 text-foreground">Farmer Profile</h3>
          <div className="space-y-2.5 text-sm text-card-foreground">
            <p><span className="text-muted-foreground font-medium">Name:</span> {customer.name}</p>
            <p><span className="text-muted-foreground font-medium">Mobile:</span> {customer.mobile || customer.phone || 'N/A'}</p>
            <p><span className="text-muted-foreground font-medium">Village:</span> {customer.village || 'N/A'}</p>
            {customer.address && <p><span className="text-muted-foreground font-medium">Address:</span> {customer.address}</p>}
            <p><span className="text-muted-foreground font-medium">Farm Size:</span> {customer.farm_size || customer.farmSize || 'N/A'}</p>
            <p><span className="text-muted-foreground font-medium">Crops:</span> {customer.crops || 'N/A'}</p>
            {customer.notes && <p><span className="text-muted-foreground font-medium">Notes:</span> {customer.notes}</p>}
          </div>
        </div>
        <div className="col-span-3 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card text-card-foreground shadow p-6">
            <h3 className="text-sm font-medium text-muted-foreground">Total Purchases</h3>
            <div className="text-2xl font-bold mt-2 text-foreground">{formatCurrency(totalPurchases)}</div>
          </div>
          <div className="rounded-xl border border-border bg-card text-card-foreground shadow p-6">
            <h3 className="text-sm font-medium text-muted-foreground">Estimated Paid</h3>
            <div className="text-2xl font-bold mt-2 text-green-600">{formatCurrency(totalPaid)}</div>
          </div>
          <div className="rounded-xl border border-border bg-card text-card-foreground shadow p-6">
            <h3 className="text-sm font-medium text-muted-foreground">Outstanding (Udhar)</h3>
            <div className={`text-2xl font-bold mt-2 ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(outstanding)}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="ledger" className="w-full">
        <TabsList>
          <TabsTrigger value="ledger">Credit Ledger</TabsTrigger>
          <TabsTrigger value="purchases">Purchase History</TabsTrigger>
        </TabsList>
        <TabsContent value="ledger" className="mt-4">
          <CustomerLedger customerId={id} />
        </TabsContent>
        <TabsContent value="purchases" className="mt-4">
          <div className="p-6 border border-border rounded-xl text-center text-muted-foreground bg-card">
            Purchase history records for {customer.name} are tracked with sales invoices.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
