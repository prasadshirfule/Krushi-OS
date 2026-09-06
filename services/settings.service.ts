import { createServerSupabaseClient } from '@/lib/supabase/server';
import { SettingsInput } from '@/lib/validations';
import { ShopDetails, DEFAULT_SHOP_DETAILS } from '@/lib/shop-details';

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
    const { data: shop } = await supabase.from('shops').select('*').eq('id', shopId).maybeSingle();

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

/**
 * Retrieve unified shop profile from Supabase shops and settings tables.
 */
export async function getShopProfile(shopId: string): Promise<ShopDetails> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: shop } = await supabase.from('shops').select('*').eq('id', shopId).maybeSingle();

    let extended: Partial<ShopDetails> = {};
    const { data: settingRow } = await supabase
      .from('settings')
      .select('value')
      .eq('shop_id', shopId)
      .eq('key', 'shop_profile')
      .maybeSingle();

    if (settingRow?.value) {
      try {
        extended = JSON.parse(settingRow.value);
      } catch {}
    }

    if (!shop) {
      return { ...DEFAULT_SHOP_DETAILS, ...extended };
    }

    return {
      ...DEFAULT_SHOP_DETAILS,
      ...extended,
      shopName: shop.name || extended.shopName || '',
      address: shop.address || extended.address || '',
      contact1: shop.phone || extended.contact1 || '',
      email: shop.email || extended.email || '',
      gstNumber: shop.gst_number || extended.gstNumber || '',
      licenseNumber: shop.license_info || extended.licenseNumber || '',
      invoiceTerms: shop.terms_and_conditions || extended.invoiceTerms || DEFAULT_SHOP_DETAILS.invoiceTerms,
      logoBase64: shop.logo_url || extended.logoBase64 || '',
      ownerName: extended.ownerName || '',
      bankName: extended.bankName || '',
      accountName: extended.accountName || extended.ownerName || '',
      accountNumber: extended.accountNumber || '',
      ifsc: extended.ifsc || '',
      branch: extended.branch || '',
      accountType: extended.accountType || '',
    };
  } catch (err) {
    console.error("Failed to get shop profile from Supabase:", err);
    return DEFAULT_SHOP_DETAILS;
  }
}

/**
 * Update unified shop profile in Supabase shops and settings tables.
 */
export async function updateShopProfile(shopId: string, data: Partial<ShopDetails>): Promise<ShopDetails> {
  const supabase = await createServerSupabaseClient();

  // 1. Update core shops table
  const updatePayload: Record<string, any> = {};
  if (data.shopName !== undefined) updatePayload.name = data.shopName;
  if (data.address !== undefined) updatePayload.address = data.address;
  if (data.contact1 !== undefined) updatePayload.phone = data.contact1;
  if (data.email !== undefined) updatePayload.email = data.email;
  if (data.gstNumber !== undefined) updatePayload.gst_number = data.gstNumber;
  if (data.licenseNumber !== undefined) updatePayload.license_info = data.licenseNumber;
  if (data.invoiceTerms !== undefined) updatePayload.terms_and_conditions = data.invoiceTerms;
  if (data.logoBase64 !== undefined) updatePayload.logo_url = data.logoBase64;

  if (Object.keys(updatePayload).length > 0) {
    const { error: shopError } = await supabase
      .from('shops')
      .update(updatePayload)
      .eq('id', shopId);

    if (shopError) {
      console.error("Error updating shops table:", shopError);
      throw new Error(`Failed to update shop: ${shopError.message}`);
    }
  }

  // 2. Load existing settings payload and merge
  let currentSettings: Partial<ShopDetails> = {};
  const { data: existingRow } = await supabase
    .from('settings')
    .select('value')
    .eq('shop_id', shopId)
    .eq('key', 'shop_profile')
    .maybeSingle();

  if (existingRow?.value) {
    try {
      currentSettings = JSON.parse(existingRow.value);
    } catch {}
  }

  const mergedSettings = {
    ...currentSettings,
    ...data,
  };

  const { error: settingError } = await supabase
    .from('settings')
    .upsert({
      shop_id: shopId,
      key: 'shop_profile',
      value: JSON.stringify(mergedSettings),
      updated_at: new Date().toISOString()
    }, { onConflict: 'shop_id, key' });

  if (settingError) {
    console.warn("Notice: settings key upsert error:", settingError);
  }

  return getShopProfile(shopId);
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
