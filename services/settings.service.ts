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
  invoice_terms: '1. Goods once sold will not be taken back without valid batch receipt.\n2. Interest @ 18% p.a. will be charged if not paid within 30 days.'
};

export async function getSettings(shopId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: shop } = await supabase.from('shops').select('*').eq('id', shopId).maybeSingle();
    const { data: settingRow } = await supabase.from('settings').select('*').eq('shop_id', shopId).maybeSingle();

    return {
      ...DEFAULT_SETTINGS,
      shop_name: shop?.name || settingRow?.shop_name || DEFAULT_SETTINGS.shop_name,
      shop_address: shop?.address || settingRow?.shop_address || '',
      shop_phone: shop?.phone || settingRow?.shop_phone || '',
      shop_email: shop?.email || settingRow?.shop_email || '',
      shop_gst: shop?.gst_number || settingRow?.shop_gst || '',
      shop_license: shop?.license_info || settingRow?.shop_license || '',
      invoice_prefix: shop?.invoice_prefix || settingRow?.invoice_prefix || 'KOS',
      invoice_terms: shop?.terms_and_conditions || settingRow?.invoice_terms || DEFAULT_SETTINGS.invoice_terms,
      invoice_footer: settingRow?.invoice_footer || '',
      logo_url: shop?.logo_url || settingRow?.logo_url || '',
      default_gst_rate: settingRow?.default_gst_rate ? Number(settingRow.default_gst_rate) : 18,
    };
  } catch (error) {
    console.error("Failed to load settings:", error);
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(shopId: string, data: SettingsInput) {
  const supabase = await createServerSupabaseClient();

  const { error: shopError } = await supabase.from('shops').update({
    name: data.shop_name,
    address: data.shop_address,
    phone: data.shop_phone,
    email: data.shop_email,
    gst_number: data.shop_gst,
    invoice_prefix: data.invoice_prefix,
    terms_and_conditions: data.invoice_terms,
    updated_at: new Date().toISOString()
  }).eq('id', shopId);

  if (shopError) {
    console.error("Error updating settings in shops table:", shopError);
    throw new Error(`Failed to update shop settings: ${shopError.message}`);
  }

  const { error: settingError } = await supabase.from('settings').upsert({
    shop_id: shopId,
    shop_name: data.shop_name,
    shop_address: data.shop_address,
    shop_phone: data.shop_phone,
    shop_email: data.shop_email,
    shop_gst: data.shop_gst,
    invoice_prefix: data.invoice_prefix,
    invoice_terms: data.invoice_terms,
    default_gst_rate: data.default_gst_rate || 18,
    updated_at: new Date().toISOString()
  }, { onConflict: 'shop_id' });

  if (settingError) {
    console.error("Error updating settings table:", settingError);
    throw new Error(`Failed to update settings: ${settingError.message}`);
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
    const { data: settingRow } = await supabase.from('settings').select('*').eq('shop_id', shopId).maybeSingle();

    let extended: Partial<ShopDetails> = {};
    if (settingRow?.invoice_footer) {
      try {
        if (settingRow.invoice_footer.trim().startsWith('{')) {
          extended = JSON.parse(settingRow.invoice_footer);
        }
      } catch (e) {
        console.warn("Could not parse invoice_footer JSON:", e);
      }
    }

    if (shop?.license_info && Object.keys(extended).length === 0) {
      try {
        if (shop.license_info.trim().startsWith('{')) {
          extended = JSON.parse(shop.license_info);
        }
      } catch {}
    }

    return {
      ...DEFAULT_SHOP_DETAILS,
      ...extended,
      shopName: shop?.name || settingRow?.shop_name || extended.shopName || '',
      address: shop?.address || settingRow?.shop_address || extended.address || '',
      contact1: shop?.phone || settingRow?.shop_phone || extended.contact1 || '',
      email: shop?.email || settingRow?.shop_email || extended.email || '',
      gstNumber: shop?.gst_number || settingRow?.shop_gst || extended.gstNumber || '',
      licenseNumber: extended.licenseNumber || settingRow?.shop_license || (shop?.license_info && !shop.license_info.startsWith('{') ? shop.license_info : '') || '',
      invoiceTerms: shop?.terms_and_conditions || settingRow?.invoice_terms || extended.invoiceTerms || DEFAULT_SHOP_DETAILS.invoiceTerms,
      logoBase64: shop?.logo_url || settingRow?.logo_url || extended.logoBase64 || '',
      ownerName: extended.ownerName || '',
      village: extended.village || '',
      taluka: extended.taluka || '',
      district: extended.district || '',
      state: extended.state || '',
      pincode: extended.pincode || '',
      contact2: extended.contact2 || '',
      registrationNumber: extended.registrationNumber || '',
      authorizedSignatory: extended.authorizedSignatory || shop?.name || settingRow?.shop_name || '',
      upiId: (extended.upiId || '').trim(),
      defaultBillFormat: (extended.defaultBillFormat === 'THERMAL_80MM' || (extended.defaultBillFormat as any) === '80mm' ? 'THERMAL_80MM' : 'A5'),
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

  // 1. Fetch current profile to ensure partial updates don't wipe existing fields
  const currentProfile = await getShopProfile(shopId);
  const merged: ShopDetails = {
    ...currentProfile,
    ...data,
  };

  const payloadJSON = JSON.stringify(merged);

  // 2. Update shops table
  const { error: shopError } = await supabase
    .from('shops')
    .update({
      name: merged.shopName || '',
      address: merged.address || '',
      phone: merged.contact1 || '',
      email: merged.email || '',
      gst_number: merged.gstNumber || '',
      license_info: merged.licenseNumber || '',
      terms_and_conditions: merged.invoiceTerms || '',
      logo_url: merged.logoBase64 || '',
      updated_at: new Date().toISOString(),
    })
    .eq('id', shopId);

  if (shopError) {
    console.error("Error updating shops table:", shopError);
    throw new Error(`Failed to update shop: ${shopError.message}`);
  }

  // 3. Upsert settings table with real onConflict: 'shop_id'
  const { error: settingError } = await supabase
    .from('settings')
    .upsert({
      shop_id: shopId,
      shop_name: merged.shopName || '',
      shop_address: merged.address || '',
      shop_phone: merged.contact1 || '',
      shop_email: merged.email || '',
      shop_gst: merged.gstNumber || '',
      shop_license: merged.licenseNumber || '',
      logo_url: merged.logoBase64 || '',
      invoice_terms: merged.invoiceTerms || '',
      invoice_footer: payloadJSON,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'shop_id' });

  if (settingError) {
    console.error("Error updating settings table:", settingError);
    throw new Error(`Failed to update settings: ${settingError.message}`);
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

    await supabase.from('shops').update({ logo_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', shopId);
    await supabase.from('settings').upsert({ shop_id: shopId, logo_url: publicUrl, updated_at: new Date().toISOString() }, { onConflict: 'shop_id' });

    return { logoUrl: publicUrl };
  } catch (error) {
    console.error("Failed to upload logo:", error);
    return { logoUrl: '' };
  }
}
