'use server';

import {
  getCustomerDashboardData,
  getCustomerBillDetail,
  markCustomerNotificationRead,
  CustomerDashboardData,
} from '@/services/customer-portal.service';

export async function getCustomerDashboardDataAction(): Promise<{
  success: boolean;
  data?: CustomerDashboardData;
  error?: string;
}> {
  try {
    return await getCustomerDashboardData();
  } catch (err: any) {
    console.error('Server action error getCustomerDashboardDataAction:', err);
    return { success: false, error: err.message || 'Failed to load customer dashboard.' };
  }
}

export async function getCustomerBillDetailAction(billId: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    return await getCustomerBillDetail(billId);
  } catch (err: any) {
    console.error('Server action error getCustomerBillDetailAction:', err);
    return { success: false, error: err.message || 'Failed to load bill details.' };
  }
}

export async function markCustomerNotificationReadAction(notificationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    return await markCustomerNotificationRead(notificationId);
  } catch (err: any) {
    console.error('Server action error markCustomerNotificationReadAction:', err);
    return { success: false, error: err.message || 'Failed to mark notification as read.' };
  }
}
