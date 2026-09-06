import { redirect } from 'next/navigation';

export default function ShopDetailsPage() {
  redirect('/settings?tab=shop');
}
