'use server';

import { getAuthAndPermissions } from '@/lib/auth-helper';
import { getDashboardStats } from '@/services/dashboard.service';
import { ActionResult } from './types';

export async function getDashboardStatsAction(): Promise<ActionResult<any>> {
  try {
    const user = await getAuthAndPermissions();
    const stats = await getDashboardStats(user.shop_id);
    return { success: true, data: stats };
  } catch (error: any) {
    console.error('getDashboardStatsAction error:', error);
    return { success: false, error: error.message || 'Unable to load dashboard stats' };
  }
}
