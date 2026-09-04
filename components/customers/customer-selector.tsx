"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CustomerFormDialog } from "./customer-form-dialog";
import { getCustomersAction } from "@/actions/customers";

interface CustomerSelectorProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function CustomerSelector({ value, onChange, className }: CustomerSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedValue, setSelectedValue] = React.useState(value || "");
  const [customerOptions, setCustomerOptions] = React.useState<Array<{ value: string; label: string }>>([]);

  const loadCustomers = React.useCallback(async () => {
    try {
      const res = await getCustomersAction({ limit: 100 });
      if (res.success && res.data?.customers) {
        setCustomerOptions(
          res.data.customers.map((c: any) => ({
            value: String(c.id),
            label: `${c.name}${c.phone || c.mobile ? ` (${c.phone || c.mobile})` : ""}${c.village ? ` - ${c.village}` : ""}`,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load customers in selector:", err);
    }
  }, []);

  React.useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  React.useEffect(() => {
    setSelectedValue(value || "");
  }, [value]);

  const handleSelect = (currentValue: string) => {
    const newValue = currentValue === selectedValue ? "" : currentValue;
    setSelectedValue(newValue);
    if (onChange) onChange(newValue);
    setOpen(false);
  };

  const handleCustomerCreated = (newCust?: any) => {
    if (newCust) {
      const opt = {
        value: String(newCust.id),
        label: `${newCust.name}${newCust.phone || newCust.mobile ? ` (${newCust.phone || newCust.mobile})` : ""}${newCust.village ? ` - ${newCust.village}` : ""}`,
      };
      setCustomerOptions(prev => [opt, ...prev.filter(o => o.value !== opt.value)]);
      handleSelect(opt.value);
    }
    loadCustomers();
    setDialogOpen(false);
  };

  const selectedLabel = customerOptions.find((c) => c.value === selectedValue)?.label || "Select customer...";

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-[300px] justify-between text-left font-normal", className)}
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput placeholder="Search customer..." />
            <CommandList>
              <CommandEmpty>No customer found.</CommandEmpty>
              <CommandGroup>
                {customerOptions.map((c) => (
                  <CommandItem
                    key={c.value}
                    value={c.label}
                    onSelect={() => handleSelect(c.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedValue === c.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{c.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setDialogOpen(true);
                  }}
                  className="text-primary font-medium cursor-pointer"
                >
                  + Add New Customer
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <CustomerFormDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
        onSuccess={handleCustomerCreated}
      />
    </>
  );
}
