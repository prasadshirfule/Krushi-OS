import { createServerSupabaseClient } from '@/lib/supabase/server';
import { MOCK_NOTIFICATIONS } from '@/lib/mock-data';

function isPlaceholderMode() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
}

export async function getNotifications(shopId: string, options: { unreadOnly?: boolean, page?: number, limit?: number } = {}) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    let query = supabase.from('notifications').select('*', { count: 'exact' }).eq('shop_id', shopId);

    if (options.unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, count, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return { notifications: data || [], total: count || 0 };
  } catch (error) {
    let list = [...MOCK_NOTIFICATIONS];
    if (options.unreadOnly) list = list.filter(n => !n.read);
    return { notifications: list, total: list.length };
  }
}

export async function markNotificationRead(shopId: string, id: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('shop_id', shopId);
    if (error) throw error;
  } catch (error) {
    const item = MOCK_NOTIFICATIONS.find(n => n.id === id);
    if (item) item.read = true;
  }
}

export async function markAllNotificationsRead(shopId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('shop_id', shopId);
    if (error) throw error;
  } catch (error) {
    MOCK_NOTIFICATIONS.forEach(n => n.read = true);
  }
}

export async function getUnreadCount(shopId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('shop_id', shopId).eq('is_read', false);
    if (error) throw error;
    return count || 0;
  } catch (error) {
    return MOCK_NOTIFICATIONS.filter(n => !n.read).length;
  }
}
