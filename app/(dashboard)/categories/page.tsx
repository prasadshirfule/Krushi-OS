import { getCategoriesAction } from "@/actions/products";
import { CategoryManager } from "@/components/categories/category-manager";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Categories | KRUSHI OS',
};

export default async function CategoriesPage() {
  const res = await getCategoriesAction();
  const categories = res.success && Array.isArray(res.data) ? res.data : [];

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <CategoryManager categories={categories} />
    </div>
  );
}
