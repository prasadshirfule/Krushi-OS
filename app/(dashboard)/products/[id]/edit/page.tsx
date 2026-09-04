import { EditProductWrapper } from "@/components/products/edit-product-wrapper";
import { getCategoriesAction, getBrandsAction, getProductAction } from "@/actions/products";

export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const [productRes, catRes, brandRes] = await Promise.all([
    getProductAction(id),
    getCategoriesAction(),
    getBrandsAction()
  ]);

  const initialData = productRes.success ? productRes.data : null;
  const categories = catRes.success ? (catRes.data || []) : [];
  const brands = brandRes.success ? (brandRes.data || []) : [];

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <EditProductWrapper 
        productId={id} 
        ssrProduct={initialData} 
        categories={categories} 
        brands={brands} 
      />
    </div>
  );
}

