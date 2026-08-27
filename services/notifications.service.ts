import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function getNotifications(shopId: string, options: { unreadOnly?: boolean, limit?: number } = {}) {
  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase.from('notifications').select('*').eq('shop_id', shopId);
    
    if (options.unreadOnly) {
      query = query.eq('is_read', false);
    }
    
    query = query.order('created_at', { ascending: false }).limit(options.limit || 20);

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error("Failed to load notifications:", error);
    return [];
  }
}

export async function markNotificationAsRead(shopId: string, id: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('shop_id', shopId).eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to mark notification read:", error);
  }
}

export async function markAllNotificationsAsRead(shopId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('shop_id', shopId).eq('is_read', false);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to mark all notifications read:", error);
  }
}

export async function getUnreadNotificationCount(shopId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('is_read', false);

    if (error) return 0;
    return count || 0;
  } catch (error) {
    console.error("Failed to fetch unread notification count:", error);
    return 0;
  }
}

// Aliases matching action calls
export const getUnreadCount = getUnreadNotificationCount;
export const markAllNotificationsRead = markAllNotificationsAsRead;
export const markNotificationRead = markNotificationAsRead;
