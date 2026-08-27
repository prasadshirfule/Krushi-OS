"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReportFilters() {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 border rounded-md bg-card">
      <div className="flex gap-2">
        <Input type="date" className="w-[150px]" />
        <Input type="date" className="w-[150px]" />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm">Daily</Button>
        <Button variant="outline" size="sm">Weekly</Button>
        <Button variant="outline" size="sm">Monthly</Button>
        <Button variant="outline" size="sm">Yearly</Button>
      </div>
      <div className="ml-auto flex gap-2">
        <Button variant="secondary">Apply Filters</Button>
        <Button variant="ghost">Reset</Button>
        <Button variant="outline">Export</Button>
      </div>
    </div>
  );
}
