export interface ShopDetails {
  shopName: string;
  ownerName: string;
  address: string;
  village: string;
  taluka: string;
  district: string;
  state: string;
  pincode: string;
  contact1: string;
  contact2: string;
  email: string;
  gstNumber: string;
  licenseNumber: string;
  registrationNumber: string;
  invoiceTerms: string;
  authorizedSignatory: string;
  logoBase64?: string;
  // Owner Bank Details
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
  accountType?: string;
}

export const DEFAULT_SHOP_DETAILS: ShopDetails = {
  shopName: 'Krushi Seva Kendra',
  ownerName: 'Prasad Mahajan',
  address: 'Main Market Road, Near Mandi Yard',
  village: '',
  taluka: '',
  district: 'Pune',
  state: 'Maharashtra',
  pincode: '',
  contact1: '9876543210',
  contact2: '',
  email: 'contact@krushiseva.com',
  gstNumber: '27AAACK1234F1Z9',
  licenseNumber: 'LIC/PEST/2024/7834',
  registrationNumber: 'LIC/FERT/2024/0981',
  invoiceTerms: '1. Goods once sold will not be taken back without valid batch receipt.\n2. Interest @ 18% p.a. charged on credit khata balances past 30 days.\n3. Check expiry date and seal before opening the package.',
  authorizedSignatory: 'For Krushi Seva Kendra',
  logoBase64: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
  ifsc: '',
  branch: '',
  accountType: '',
};

export function getSavedShopDetails(): ShopDetails {
  if (typeof window === 'undefined') {
    return DEFAULT_SHOP_DETAILS;
  }

  try {
    let merged: ShopDetails = { ...DEFAULT_SHOP_DETAILS };

    // 1. Try krushi_demo_shop_details (saved via /shop-details)
    const rawShopDetails = localStorage.getItem('krushi_demo_shop_details');
    if (rawShopDetails) {
      const parsed = JSON.parse(rawShopDetails);
      merged = { ...merged, ...parsed };
    }

    // 2. Try krushi_settings_shop (saved via /settings)
    const rawSettingsShop = localStorage.getItem('krushi_settings_shop');
    if (rawSettingsShop) {
      const parsed = JSON.parse(rawSettingsShop);
      if (parsed.name) merged.shopName = parsed.name;
      if (parsed.owner) merged.ownerName = parsed.owner;
      if (parsed.phone) merged.contact1 = parsed.phone;
      if (parsed.email) merged.email = parsed.email;
      if (parsed.address && !merged.address) merged.address = parsed.address;
      if (parsed.pesticideLicence) merged.licenseNumber = parsed.pesticideLicence;
      if (parsed.fertilizerLicence) merged.registrationNumber = parsed.fertilizerLicence;
    }

    // 3. Try krushi_settings_tax (saved via /settings)
    const rawSettingsTax = localStorage.getItem('krushi_settings_tax');
    if (rawSettingsTax) {
      const parsed = JSON.parse(rawSettingsTax);
      if (parsed.gstin) merged.gstNumber = parsed.gstin;
    }

    return merged;
  } catch (err) {
    console.error('Error loading shop details:', err);
    return DEFAULT_SHOP_DETAILS;
  }
}

/**
 * Format the shop address line using village, taluka, district, state.
 * Guaranteed format: At [ACTUAL VILLAGE], [ACTUAL TALUKA], [ACTUAL DISTRICT], [ACTUAL STATE]
 */
export function formatShopAddress(shop: ShopDetails): string {
  const parts: string[] = [];

  const village = (shop.village || '').trim();
  if (village) {
    parts.push(village.toLowerCase().startsWith('at ') ? village : `At ${village}`);
  } else if (shop.address) {
    parts.push(shop.address);
  }

  const taluka = (shop.taluka || '').trim();
  if (taluka) {
    parts.push(taluka);
  }

  const district = (shop.district || '').trim();
  if (district) {
    parts.push(district);
  }

  const state = (shop.state || '').trim();
  const pincode = (shop.pincode || '').trim();

  if (state && pincode) {
    parts.push(`${state} - ${pincode}`);
  } else if (state) {
    parts.push(state);
  } else if (pincode) {
    parts.push(pincode);
  }

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return shop.address || '';
}
