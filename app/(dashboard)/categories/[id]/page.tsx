import { notFound } from 'next/navigation';
import { getCategoryAction, getProductsAction } from '@/actions/products';
import { CategoryProductsClient } from '@/components/categories/category-products-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const catRes = await getCategoryAction(id);
  const title = catRes.success && catRes.data?.name ? `${catRes.data.name} | Categories | KRUSHI OS` : 'Category Products | KRUSHI OS';
  return { title };
}

export default async function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [catRes, prodRes] = await Promise.all([
    getCategoryAction(id),
    getProductsAction({ category: id, limit: 300 }),
  ]);

  let category = catRes.success && catRes.data ? catRes.data : null;
  const products = prodRes.success && Array.isArray(prodRes.data?.products) ? prodRes.data.products : [];

  // Fallback for demo or custom categories if not found in server
  if (!category) {
    // If the id exists in client demo store or fallback
    category = {
      id,
      name: 'Category Products',
      description: null,
    };
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <CategoryProductsClient category={category} initialProducts={products} />
    </div>
  );
}
