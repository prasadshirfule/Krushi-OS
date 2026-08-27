import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SettingsInput } from '@/lib/validations';

const DEFAULT_SETTINGS: Record<string, any> = {
  shop_name: 'KRUSHI OS Store',
  shop_address: '',
  shop_phone: '',
  shop_email: '',
  shop_gst: '',
  invoice_prefix: 'KOS',
  default_gst_rate: 18,
  invoice_terms: '1. Goods once sold will not be taken back without valid batch receipt.'
};

export async function getSettings(shopId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: shop } = await supabase.from('shops').select('*').eq('id', shopId).single();

    if (shop) {
      return {
        ...DEFAULT_SETTINGS,
        shop_name: shop.name || DEFAULT_SETTINGS.shop_name,
        shop_address: shop.address || '',
        shop_phone: shop.phone || '',
        shop_email: shop.email || '',
        shop_gst: shop.gst_number || '',
        invoice_prefix: shop.invoice_prefix || 'KOS',
        invoice_terms: shop.terms_and_conditions || DEFAULT_SETTINGS.invoice_terms
      };
    }

    const { data } = await supabase.from('settings').select('*').eq('shop_id', shopId);

    const settingsObj: Record<string, any> = {};
    (data || []).forEach(item => {
      try {
        settingsObj[item.key] = JSON.parse(item.value);
      } catch {
        settingsObj[item.key] = item.value;
      }
    });

    return { ...DEFAULT_SETTINGS, ...settingsObj };
  } catch (error) {
    console.error("Failed to load settings:", error);
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(shopId: string, data: SettingsInput) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('shops').update({
    name: data.shop_name,
    address: data.shop_address,
    phone: data.shop_phone,
    email: data.shop_email,
    gst_number: data.shop_gst,
    invoice_prefix: data.invoice_prefix,
    terms_and_conditions: data.invoice_terms
  }).eq('id', shopId);

  if (error) {
    console.error("Error updating settings:", error);
    throw error;
  }

  return getSettings(shopId);
}

export async function uploadLogo(shopId: string, formData: FormData) {
  try {
    const supabase = await createServerSupabaseClient();
    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');

    const fileExt = file.name.split('.').pop();
    const fileName = `logo-${shopId}-${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('shop-logos')
      .upload(fileName, file, { upsert: true });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('shop-logos')
      .getPublicUrl(fileName);

    await supabase.from('shops').update({ logo_url: publicUrl }).eq('id', shopId);

    return { logoUrl: publicUrl };
  } catch (error) {
    console.error("Failed to upload logo:", error);
    return { logoUrl: '' };
  }
}
