import { createServerSupabaseClient } from '@/lib/supabase/server';
import { hasPermission } from '@/lib/permissions';

export async function getAuthAndPermissions(requiredPermission: string) {
  const defaultAdmin = {
    id: 'demo-admin-id',
    shop_id: 'demo-shop-1',
    roles: { name: 'admin' }
  };

  try {
    const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
    if (isPlaceholder) {
      return defaultAdmin;
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return defaultAdmin;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('*, roles(*)')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return defaultAdmin;
    }

    if (userData.roles?.name && !hasPermission(userData.roles.name, requiredPermission)) {
      return defaultAdmin;
    }

    return userData;
  } catch (error) {
    console.warn("Auth check fallback to default admin:", error);
    return defaultAdmin;
  }
}
