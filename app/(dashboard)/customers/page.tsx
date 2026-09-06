import { getCustomers, getCustomerSummary } from '@/services/customers.service';
import { CustomersView } from '@/components/customers/customers-view';
import { getAuthAndPermissions } from '@/lib/auth-helper';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Customers | KRUSHI OS',
};

export default async function CustomersPage() {
  const user = await getAuthAndPermissions();
  const shopId = user.shop_id;

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
