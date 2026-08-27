import { ProductForm } from "@/components/products/product-form";
import { getCategoriesAction, getBrandsAction } from "@/actions/products";

export default async function NewProductPage() {
  const categories = await getCategoriesAction();
  const brands = await getBrandsAction();

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center space-x-2 text-muted-foreground mb-4">
        <span className="hover:text-foreground cursor-pointer">Products</span>
        <span>/</span>
        <span className="text-foreground">New Product</span>
      </div>
      <h2 className="text-3xl font-bold tracking-tight">Add New Product</h2>
      <ProductForm mode="create" categories={categories} brands={brands} />
    </div>
  );
}
