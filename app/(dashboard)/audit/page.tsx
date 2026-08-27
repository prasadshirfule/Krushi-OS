import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";

export const metadata = {
  title: 'Audit Logs | KRUSHI OS',
};

export default async function AuditPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const isDemo = cookieStore.get('krushi_demo_session')?.value === 'true';
  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  const effectiveUser = user || { id: 'demo-admin-id', email: 'admin@krushios.com' };

  let shopId = 'demo-shop-1';
  if (user && !isPlaceholder) {
    const { data: userData } = await supabase
      .from('users')
      .select('shop_id')
      .eq('id', user.id)
      .single();

    if (userData?.shop_id) {
      shopId = userData.shop_id;
    }
  }

  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*, user:users(full_name)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(100);

  const auditLogs = logs || [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Trail</h1>
          <p className="text-sm text-muted-foreground">Tamper-evident logs of inventory adjustments, billing sales, and customer repayments</p>
        </div>
      </div>

      {auditLogs.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          No audit logs recorded yet. System activities, sales, and inventory changes will be logged here.
        </div>
      ) : (
        <DataTable
          columns={[
            { accessorKey: "created_at", header: "Timestamp", cell: ({ row }: any) => formatDate(row.original.created_at) },
            { accessorKey: "user", header: "User", cell: ({ row }: any) => <span className="font-semibold">{row.original.user?.full_name || 'System'}</span> },
            { 
              accessorKey: "action", 
              header: "Action",
              cell: ({ row }: any) => <Badge variant="secondary">{row.original.action}</Badge>
            },
            { accessorKey: "entity_type", header: "Module" },
            { accessorKey: "action", header: "Details", cell: ({ row }: any) => JSON.stringify(row.original.new_values || row.original.old_values || {}) },
          ]}
          data={auditLogs}
          searchKey="action"
          searchPlaceholder="Search audit logs..."
        />
      )}
    </div>
  );
}
