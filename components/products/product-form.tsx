'use client';

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { productSchema } from "@/lib/validations";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PRODUCT_UNITS, GST_RATES } from "@/lib/constants";
import { CategoryDialog } from "./category-dialog";

export function ProductForm({ mode, initialData, categories, brands }: any) {
  const router = useRouter();
  
  const form = useForm({
    // resolver: zodResolver(productSchema),
    defaultValues: initialData || {
      name: "",
      category_id: "",
      sku: "",
      selling_price: 0,
      status: "ACTIVE",
    },
  });

  const onSubmit = async (data: any) => {
    toast.success(`Product ${mode === 'create' ? 'created' : 'updated'} successfully`);
    router.push('/products');
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input placeholder="Product name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Additional fields would go here */}
          </CardContent>
        </Card>
        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit">{mode === 'create' ? 'Create Product' : 'Save Changes'}</Button>
        </div>
      </form>
    </Form>
  );
}
