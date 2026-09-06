import { getCustomerById } from '@/services/customers.service';
import { getAuthAndPermissions } from '@/lib/auth-helper';
import { CustomerDetailClient } from '@/components/customers/customer-detail-client';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthAndPermissions();
  const shopId = user.shop_id;

  const customer = await getCustomerById(shopId, id);

  return <CustomerDetailClient initialCustomer={customer} customerId={id} />;
}
