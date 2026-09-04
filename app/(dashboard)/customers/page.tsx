import { getCustomers, getCustomerSummary } from '@/services/customers.service';
import { CustomersView } from '@/components/customers/customers-view';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Customers | KRUSHI OS',
};

export default async function CustomersPage() {
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

  const [{ customers }, summary] = await Promise.all([
    getCustomers(shopId, { limit: 50 }),
    getCustomerSummary(shopId)
  ]);

  return (
    <CustomersView
      initialCustomers={customers}
      initialSummary={summary}
    />
  );
}
