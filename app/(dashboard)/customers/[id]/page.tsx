import { getCustomerById } from '@/services/customers.service';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CustomerDetailClient } from '@/components/customers/customer-detail-client';

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

  return <CustomerDetailClient initialCustomer={customer} customerId={id} />;
}
