import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SettingsInput } from '@/lib/validations';

function isPlaceholderMode() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
}

const MOCK_SETTINGS: Record<string, any> = {
  shop_name: 'Krushi Seva Kendra',
  address: 'Main Market Road, Near Mandi Yard, Sehore, MP - 466001',
  phone: '9876543210',
  email: 'contact@krushiseva.com',
  gstin: '23AAACK1234F1Z9',
  invoice_prefix: 'KOS',
  default_gst_rate: 18,
  terms: '1. Goods once sold will not be taken back without valid batch receipt.\n2. Interest @ 18% p.a. will be charged on credit khata balances outstanding beyond 30 days.'
};

export async function getSettings(shopId: string) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from('settings').select('*').eq('shop_id', shopId);
    if (error) throw error;

    const settingsObj: Record<string, any> = {};
    (data || []).forEach(item => {
      try {
        settingsObj[item.key] = JSON.parse(item.value);
      } catch {
        settingsObj[item.key] = item.value;
      }
    });

    return { ...MOCK_SETTINGS, ...settingsObj };
  } catch (error) {
    return MOCK_SETTINGS;
  }
}

export async function updateSettings(shopId: string, data: SettingsInput) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const entries = Object.entries(data);

    for (const [key, value] of entries) {
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      await supabase.from('settings').upsert({
        shop_id: shopId,
        key,
        value: stringValue,
      }, { onConflict: 'shop_id,key' });
    }

    return getSettings(shopId);
  } catch (error) {
    Object.assign(MOCK_SETTINGS, data);
    return MOCK_SETTINGS;
  }
}

export async function uploadLogo(shopId: string, formData: FormData) {
  try {
    if (isPlaceholderMode()) throw new Error('Using mock');
    const supabase = await createServerSupabaseClient();
    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');

    const fileExt = file.name.split('.').pop();
    const fileName = `logo-${shopId}-${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('shop-logos')
      .upload(fileName, file, { upsert: true });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('shop-logos')
      .getPublicUrl(fileName);

    await supabase.from('shops').update({ logo_url: publicUrl }).eq('id', shopId);

    return { logoUrl: publicUrl };
  } catch (error) {
    return { logoUrl: '/placeholder-logo.png' };
  }
}
