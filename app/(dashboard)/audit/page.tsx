import { AuditTable } from "@/components/audit/audit-table";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Audit Logs | KRUSHI OS',
};

export default async function AuditPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

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

      <AuditTable initialLogs={auditLogs} />
    </div>
  );
}
