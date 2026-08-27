import { ProductForm } from "@/components/products/product-form";
import { getCategoriesAction, getBrandsAction, getProductAction } from "@/actions/products";
import { notFound } from "next/navigation";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const [productRes, catRes, brandRes] = await Promise.all([
    getProductAction(id),
    getCategoriesAction(),
    getBrandsAction()
  ]);

  if (!productRes.success || !productRes.data) {
    notFound();
  }

  const initialData = productRes.data;
  const categories = catRes.success ? (catRes.data || []) : [];
  const brands = brandRes.success ? (brandRes.data || []) : [];

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <ProductForm mode="edit" initialData={initialData} categories={categories} brands={brands} />
    </div>
  );
}
