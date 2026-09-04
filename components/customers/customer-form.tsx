"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { createCustomerAction, updateCustomerAction } from "@/actions/customers";

const customerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  mobile: z.string().optional(),
  village: z.string().optional(),
  address: z.string().optional(),
  farm_size: z.string().optional(),
  crops: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

export interface CustomerFormProps {
  initialData?: any;
  onSuccess?: (customer?: any) => void;
  onCancel?: () => void;
}

export function CustomerForm({ initialData, onSuccess, onCancel }: CustomerFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      mobile: initialData?.mobile || initialData?.phone || "",
      village: initialData?.village || "",
      address: initialData?.address || "",
      farm_size: initialData?.farm_size || initialData?.farmSize || (initialData?.land_acres ? `${initialData.land_acres} Acres` : ""),
      crops: initialData?.crops || initialData?.crop_details || "",
      notes: initialData?.notes || "",
    },
  });

  async function onSubmit(data: CustomerFormValues) {
    setIsSubmitting(true);
    try {
      let result;
      if (initialData?.id) {
        result = await updateCustomerAction(initialData.id, {
          name: data.name.trim(),
          mobile: data.mobile?.trim() || null,
          village: data.village?.trim() || null,
          address: data.address?.trim() || null,
          farm_size: data.farm_size?.trim() || null,
          crops: data.crops?.trim() || null,
          notes: data.notes?.trim() || null,
        });
      } else {
        result = await createCustomerAction({
          name: data.name.trim(),
          mobile: data.mobile?.trim() || null,
          village: data.village?.trim() || null,
          address: data.address?.trim() || null,
          farm_size: data.farm_size?.trim() || null,
          crops: data.crops?.trim() || null,
          notes: data.notes?.trim() || null,
        });
      }

      if (result.success) {
        toast.success(initialData?.id ? "Customer updated successfully" : "Customer created successfully");
        router.refresh();
        if (onSuccess) {
          onSuccess(result.data);
        }
      } else {
        toast.error(result.error || "Failed to save customer");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Farmer / Customer Name *</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Ramesh Patel" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="mobile"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mobile Number</FormLabel>
                <FormControl>
                  <Input placeholder="10-digit mobile" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="village"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Village / Area</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Pipariya" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Address</FormLabel>
              <FormControl>
                <Textarea placeholder="Address details" className="resize-none h-20" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="farm_size"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Farm Size</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 5 Acres" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="crops"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Major Crops</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Wheat, Soybean" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Credit terms or other details" className="resize-none h-16" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center justify-end gap-2 pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting} className="min-w-[130px]">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : initialData?.id ? (
              "Update Customer"
            ) : (
              "Save Customer"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
