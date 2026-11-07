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
    <div className="flex-1 space-y-3 sm:space-y-4 p-0 sm:p-4 md:p-6 pt-1 sm:pt-4">
      <EditProductWrapper 
        productId={id} 
        ssrProduct={initialData} 
        categories={categories} 
        brands={brands} 
      />
    </div>
  );
}

