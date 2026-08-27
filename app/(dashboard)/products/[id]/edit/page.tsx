import { ProductForm } from "@/components/products/product-form";
import { getCategoriesAction, getBrandsAction } from "@/actions/products";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const categories = await getCategoriesAction();
  const brands = await getBrandsAction();
  
  // mock data
  const initialData = {
    id: params.id,
    name: "Mock Product",
  } as any;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <h2 className="text-3xl font-bold tracking-tight">Edit Product</h2>
      <ProductForm mode="edit" initialData={initialData} categories={categories} brands={brands} />
    </div>
  );
}
