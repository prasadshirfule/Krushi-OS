'use client';

import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { BatchFormDialog } from "./batch-form-dialog";

export function BatchList({ productId, initialBatches }: any) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <BatchFormDialog productId={productId} />
      </div>
      <DataTable
        columns={[
          { accessorKey: "batch_number", header: "Batch #" },
          { accessorKey: "expiry_date", header: "Expiry Date" },
          { accessorKey: "quantity_available", header: "Qty Available" },
        ]}
        data={initialBatches || []}
      />
    </div>
  );
}
