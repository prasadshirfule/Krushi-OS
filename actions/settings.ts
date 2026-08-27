'use server';

import { revalidatePath } from 'next/cache';
import { getAuthAndPermissions } from '@/lib/auth-helper';
import { settingsSchema } from '@/lib/validations';
import * as settingsService from '@/services/settings.service';
import { ActionResult } from './types';

export async function getSettingsAction(): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('settings.view');
    const result = await settingsService.getSettings(userData.shop_id);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function updateSettingsAction(data: any): Promise<ActionResult<any>> {
  try {
    const userData = await getAuthAndPermissions('settings.edit');
    const validated = settingsSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0].message };
    }
    const result = await settingsService.updateSettings(userData.shop_id, validated.data);
    revalidatePath('/settings');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function uploadLogoAction(formData: FormData): Promise<ActionResult<string>> {
  try {
    const userData = await getAuthAndPermissions('settings.edit');
    const result = await settingsService.uploadLogo(userData.shop_id, formData);
    revalidatePath('/settings');
    return { success: true, data: result.logoUrl };
  } catch (error: any) {
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
