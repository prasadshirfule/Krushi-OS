'use server';

import { revalidatePath } from 'next/cache';
import { getAuthAndPermissions } from '@/lib/auth-helper';
import * as notificationsService from '@/services/notifications.service';
import { ActionResult } from './types';

export async function getNotificationsAction(params: { unreadOnly?: boolean, page?: number, limit?: number }): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('notifications.view');
    const result = await notificationsService.getNotifications(userData.shop_id, params);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function markNotificationReadAction(id: string): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('notifications.view');
    const result = await notificationsService.markNotificationRead(userData.shop_id, id);
    revalidatePath('/', 'layout');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('notifications.view');
    const result = await notificationsService.markAllNotificationsRead(userData.shop_id);
    revalidatePath('/', 'layout');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getUnreadCountAction(): Promise<ActionResult<number>> {
  try {
    const userData = await getAuthAndPermissions('notifications.view');
    const result = await notificationsService.getUnreadCount(userData.shop_id);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
