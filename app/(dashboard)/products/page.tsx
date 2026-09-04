import { getProductsAction, getCategoriesAction } from "@/actions/products";
import { ProductsView } from "@/components/products/products-view";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Products | KRUSHI OS',
  description: 'Agricultural product catalog and inventory management',
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<any> }) {
  const params = await searchParams;
  const productsRes = await getProductsAction(params);
  const categoriesRes = await getCategoriesAction();

  const products = productsRes.success && Array.isArray(productsRes.data?.products || productsRes.data)
    ? (productsRes.data?.products || productsRes.data)
    : [];

  const categories = categoriesRes.success && Array.isArray(categoriesRes.data)
    ? categoriesRes.data
    : [];

  return (
    <ProductsView 
      initialProducts={products} 
      initialCategories={categories} 
    />
  );
}

