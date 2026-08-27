import { getProductsAction, getCategoriesAction } from "@/actions/products";
import { ProductTable } from "@/components/products/product-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Products</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline">Export</Button>
          <Link href="/products/new">
            <Button className="bg-green-600 hover:bg-green-700">Add Product</Button>
          </Link>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
      </div>

      <ProductTable initialData={products} categories={categories} />
    </div>
  );
}
