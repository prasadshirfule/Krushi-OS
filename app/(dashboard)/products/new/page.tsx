import { ProductForm } from "@/components/products/product-form";
import { getCategoriesAction, getBrandsAction } from "@/actions/products";

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const [catRes, brandRes] = await Promise.all([
    getCategoriesAction(),
    getBrandsAction()
  ]);

  const categories = catRes.success ? (catRes.data || []) : [];
  const brands = brandRes.success ? (brandRes.data || []) : [];

  return (
    <div className="flex-1 space-y-3 sm:space-y-4 p-0 sm:p-4 md:p-6 pt-1 sm:pt-4">
      <div className="flex items-center space-x-2 text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-4">
        <span className="hover:text-foreground cursor-pointer">Products</span>
        <span>/</span>
        <span className="text-foreground">New Product</span>
      </div>
      <ProductForm mode="create" categories={categories} brands={brands} />
    </div>
  );
}
