import { AuditTable } from "@/components/audit/audit-table";
import { getAuthAndPermissions } from "@/lib/auth-helper";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Audit Logs | KRUSHI OS',
};

export default async function AuditPage() {
  const user = await getAuthAndPermissions();
  const shopId = user.shop_id;
  const supabase = await createServerSupabaseClient();

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

      <AuditTable initialLogs={auditLogs} />
    </div>
  );
}
