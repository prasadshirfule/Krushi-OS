import { createServerSupabaseClient } from '@/lib/supabase/server';
import { hasPermission } from '@/lib/permissions';
import { cookies } from 'next/headers';

export async function getAuthAndPermissions(requiredPermission: string) {
  const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  const cookieStore = await cookies();
  const isDemo = cookieStore.get('krushi_demo_session')?.value === 'true';

  if (isPlaceholder || isDemo) {
    return {
      id: 'demo-admin-id',
      shop_id: 'demo-shop-1',
      roles: { name: 'admin' }
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('*, roles(*)')
    .eq('id', user.id)
    .single();

  if (!userData) throw new Error('User not found');

  if (userData.roles?.name && !hasPermission(userData.roles.name, requiredPermission)) {
    throw new Error('Permission denied');
  }

  return userData;
}
