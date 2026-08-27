"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { createEmployeeAction, updateEmployeeAction, getRolesAction } from "@/actions/employees";
import { useRouter } from "next/navigation";

interface EmployeeFormDialogProps {
  employee?: any;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function EmployeeFormDialog({ employee, trigger, onSuccess }: EmployeeFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(employee?.full_name || employee?.name || "");
  const [email, setEmail] = useState(employee?.email || "");
  const [phone, setPhone] = useState(employee?.phone || "");
  const [roleId, setRoleId] = useState(employee?.role_id || "");
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      getRolesAction().then(res => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setRoles(res.data);
          if (!roleId && !employee) {
            setRoleId(res.data[0].id);
          }
        }
      }).catch(() => {});
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let res;
      if (employee?.id) {
        res = await updateEmployeeAction(employee.id, {
          full_name: fullName,
          email,
          phone: phone || undefined,
          role_id: roleId || undefined,
        });
      } else {
        res = await createEmployeeAction({
          full_name: fullName,
          email,
          phone: phone || undefined,
          role_id: roleId || undefined,
          is_active: true,
        });
      }

      if (res.success) {
        setOpen(false);
        router.refresh();
        onSuccess?.();
      } else {
        setError(res.error || "Failed to save employee");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); setError(null); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-primary">
            <Plus className="mr-2 h-4 w-4" /> Add Employee
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit Staff Member" : "Add New Staff Member"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm rounded bg-destructive/15 text-destructive font-medium">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input 
              id="full_name" 
              placeholder="e.g. Ramesh Kumar" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="ramesh@krushios.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Contact Number</Label>
            <Input 
              id="phone" 
              placeholder="10-digit mobile number" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {roles.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="role">Role / Permissions</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select assigned role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name || r.role_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {employee ? "Update Employee" : "Save Employee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
