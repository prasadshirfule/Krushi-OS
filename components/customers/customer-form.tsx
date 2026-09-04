"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, IndianRupee } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { createCustomerAction, updateCustomerAction } from "@/actions/customers";

import { 
  isClientDemoMode, 
  saveDemoCustomerClient, 
  updateDemoCustomerClient 
} from "@/lib/client-demo-store";

const customerFormSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  mobile: z.string()
    .min(1, "Mobile number is required")
    .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits"),
  aadhaar: z.string()
    .min(1, "Aadhaar number is required")
    .regex(/^\d{12}$/, "Aadhaar number must be exactly 12 digits"),
  village: z.string().optional(),
  previous_udhari: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

/** Format Aadhaar as XXXX XXXX 1234 for display */
export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar || aadhaar.length !== 12) return aadhaar || '';
  return `XXXX XXXX ${aadhaar.slice(-4)}`;
}

/** Format Aadhaar as 1234 5678 9012 for input display */
function formatAadhaarInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 12);
  const parts = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(' ');
}

export interface CustomerFormProps {
  initialData?: any;
  onSuccess?: (customer?: any) => void;
  onCancel?: () => void;
}

export function CustomerForm({ initialData, onSuccess, onCancel }: CustomerFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aadhaarDisplay, setAadhaarDisplay] = useState(() => {
    const raw = initialData?.aadhaar || '';
    return raw ? formatAadhaarInput(raw) : '';
  });

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      mobile: initialData?.mobile || initialData?.phone || "",
      aadhaar: initialData?.aadhaar || "",
      village: initialData?.village || "",
      previous_udhari: initialData?.id 
        ? String(Number(initialData?.outstanding ?? initialData?.outstanding_balance ?? 0))
        : "0",
    },
  });

  async function onSubmit(data: CustomerFormValues) {
    setIsSubmitting(true);
    try {
      const demoMode = isClientDemoMode();
      let result: any = null;
      let savedCust: any = null;
      const udhariAmount = Number(data.previous_udhari || 0);

      if (demoMode) {
        // Save to browser localStorage demo store (one source of truth)
        if (initialData?.id) {
          savedCust = updateDemoCustomerClient(initialData.id, {
            name: data.name.trim(),
            mobile: data.mobile.trim(),
            aadhaar: data.aadhaar.trim(),
            village: data.village?.trim() || null,
          });
        } else {
          try {
            savedCust = saveDemoCustomerClient({
              name: data.name.trim(),
              mobile: data.mobile.trim(),
              aadhaar: data.aadhaar.trim(),
              village: data.village?.trim() || null,
              previous_udhari: udhariAmount,
            });
          } catch (dupErr: any) {
            toast.error(dupErr.message || "Duplicate customer found");
            setIsSubmitting(false);
            return;
          }
        }
        result = { success: true, data: savedCust };

        // Call server action safely for server cache invalidation
        try {
          if (initialData?.id) {
            updateCustomerAction(initialData.id, {
              name: data.name.trim(),
              mobile: data.mobile.trim(),
              aadhaar: data.aadhaar.trim(),
              village: data.village?.trim() || null,
            }).catch(() => {});
          } else {
            createCustomerAction({
              name: data.name.trim(),
              mobile: data.mobile.trim(),
              aadhaar: data.aadhaar.trim(),
              village: data.village?.trim() || null,
              previous_udhari: udhariAmount,
            }).catch(() => {});
          }
        } catch {}
      } else {
        // Real Supabase mode
        if (initialData?.id) {
          result = await updateCustomerAction(initialData.id, {
            name: data.name.trim(),
            mobile: data.mobile.trim(),
            aadhaar: data.aadhaar.trim(),
            village: data.village?.trim() || null,
          });
        } else {
          result = await createCustomerAction({
            name: data.name.trim(),
            mobile: data.mobile.trim(),
            aadhaar: data.aadhaar.trim(),
            village: data.village?.trim() || null,
            previous_udhari: udhariAmount,
          });
        }
        savedCust = result.data;
      }

      if (result && result.success) {
        toast.success(initialData?.id ? "Customer updated successfully" : "Customer created successfully");
        router.refresh();
        if (onSuccess) {
          onSuccess(savedCust);
        }
      } else {
        toast.error(result?.error || "Unable to save customer. Please try again.");
      }
    } catch (err: any) {
      console.error("Failed to save customer:", err);
      toast.error(err.message || "Unable to save customer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Required Fields */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Farmer / Customer Name <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="e.g. Ramesh Patel" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="mobile"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mobile Number <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g. 9876543210" 
                    maxLength={10}
                    inputMode="numeric"
                    {...field} 
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      field.onChange(digits);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="aadhaar"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Aadhaar Number <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g. 1234 5678 9012"
                    inputMode="numeric"
                    value={aadhaarDisplay}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
                      setAadhaarDisplay(formatAadhaarInput(digits));
                      field.onChange(digits);
                    }}
                  />
                </FormControl>
                <FormDescription className="text-xs">12-digit Aadhaar number</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Optional Fields */}
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

        {/* Previous Udhari - only show for new customers */}
        {!initialData?.id && (
          <FormField
            control={form.control}
            name="previous_udhari"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  <IndianRupee className="h-3.5 w-3.5" />
                  Previous Udhari (Outstanding Balance)
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                    <Input 
                      className="pl-7"
                      placeholder="0" 
                      inputMode="numeric"
                      {...field} 
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        field.onChange(val);
                      }}
                    />
                  </div>
                </FormControl>
                <FormDescription className="text-xs">
                  Enter any previous credit/udhari amount. This will be the opening balance. Default is ₹0.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

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
