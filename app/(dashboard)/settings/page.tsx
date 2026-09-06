"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Store, Receipt, Printer, Percent, ShieldCheck, Save, LogOut, Upload, Building2, CreditCard, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { getShopProfileAction, updateShopProfileAction } from "@/actions/settings";
import { ShopDetails, DEFAULT_SHOP_DETAILS } from "@/lib/shop-details";
import { createClient } from "@/lib/supabase/client";

const DEFAULTS = {
  invoice: {
    prefix: "KOS",
    nextNumber: "1001",
    format: "prefix-year-number",
    headerTitle: "TAX INVOICE / RETAIL BILL",
    terms: "1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. charged on credit khata balances past 30 days.\n3. Check expiry date and seal before opening the package.",
    footer: "Thank you for supporting sustainable agriculture! Happy Farming!",
  },
  print: {
    format: "A5",
    copies: "1",
    headerText: "Krushi Seva Kendra - Seeds, Fertilizers & Pesticides",
    showShopName: true,
    showAddress: true,
    showPhone: true,
    showGst: true,
    showLicence: true,
    showCustomer: true,
    showTerms: true,
    showQrCode: true,
    footerMessage: "Visit Again | Krushi Seva Kendra",
  },
  tax: {
    gstEnabled: true,
    defaultGst: "18",
    defaultCgst: "9",
    defaultSgst: "9",
    defaultIgst: "18",
    gstin: "23AAACK1234F1Z9",
    stateCode: "27 - Maharashtra",
    defaultHsn: "3808",
    requireHsn: true,
  },
  account: {
    businessType: "Krushi Seva Kendra (Agri Retail & Wholesale)",
    currency: "INR (₹)",
    dateFormat: "DD/MM/YYYY",
    financialYearStart: "1st April",
    timezone: "Asia/Kolkata (IST +5:30)",
    adminName: "Shop Administrator",
    adminRole: "Administrator",
  }
};

function loadSetting<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = localStorage.getItem(`krushi_settings_${key}`);
    return stored ? { ...fallback, ...JSON.parse(stored) } : fallback;
  } catch {
    return fallback;
  }
}

function saveSetting(key: string, value: any) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`krushi_settings_${key}`, JSON.stringify(value));
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'shop';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const [shopProfile, setShopProfile] = useState<ShopDetails>(DEFAULT_SHOP_DETAILS);
  const [invoiceSettings, setInvoiceSettings] = useState(DEFAULTS.invoice);
  const [printSettings, setPrintSettings] = useState(DEFAULTS.print);
  const [taxSettings, setTaxSettings] = useState(DEFAULTS.tax);
  const [accountSettings, setAccountSettings] = useState(DEFAULTS.account);

  // Load shop profile from Supabase and local settings on mount
  useEffect(() => {
    async function loadData() {
      try {
        const res = await getShopProfileAction();
        if (res.success && res.data) {
          setShopProfile(res.data);
          // Also sync to localStorage for invoice preview helper
          localStorage.setItem('krushi_demo_shop_details', JSON.stringify(res.data));
        }
      } catch (err) {
        console.error("Failed to load shop profile from Supabase:", err);
      } finally {
        setIsLoadingProfile(false);
      }
    }

    loadData();
    setInvoiceSettings(loadSetting('invoice', DEFAULTS.invoice));
    setPrintSettings(loadSetting('print', DEFAULTS.print));
    setTaxSettings(loadSetting('tax', DEFAULTS.tax));
    setAccountSettings(loadSetting('account', DEFAULTS.account));
  }, []);

  const handleShopInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setShopProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      toast.error('Logo file size must be less than 1MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setShopProfile((prev) => ({ ...prev, logoBase64: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveShopProfile = async () => {
    if (!shopProfile.shopName?.trim()) {
      toast.error('Shop Name is required');
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateShopProfileAction(shopProfile);
      if (res.success) {
        if (res.data) setShopProfile(res.data);
        localStorage.setItem('krushi_demo_shop_details', JSON.stringify(res.data || shopProfile));
        toast.success('Shop Profile saved successfully in Supabase!');
      } else {
        toast.error(res.error || 'Failed to save shop profile');
      }
    } catch (err: any) {
      console.error('Error saving shop profile:', err);
      toast.error(err.message || 'Failed to save shop profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = (section: string) => {
    setIsSaving(true);
    try {
      switch (section) {
        case 'Invoice': saveSetting('invoice', invoiceSettings); break;
        case 'Print Layout': saveSetting('print', printSettings); break;
        case 'GST & Tax': saveSetting('tax', taxSettings); break;
        case 'Account': saveSetting('account', accountSettings); break;
      }
      toast.success(`${section} settings saved successfully!`);
    } catch {
      toast.error(`Failed to save ${section} settings`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.info("Logged out successfully");
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
          <p className="text-sm text-muted-foreground">Configure shop profile, invoice numbering, tax rates, bank details, and account defaults</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl mb-6">
          <TabsTrigger value="shop" className="flex items-center gap-2">
            <Store className="h-4 w-4" /> Shop Profile
          </TabsTrigger>
          <TabsTrigger value="invoice" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Invoice
          </TabsTrigger>
          <TabsTrigger value="printing" className="flex items-center gap-2">
            <Printer className="h-4 w-4" /> Print
          </TabsTrigger>
          <TabsTrigger value="tax" className="flex items-center gap-2">
            <Percent className="h-4 w-4" /> Tax/GST
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Account
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: SHOP PROFILE & IDENTITY */}
        <TabsContent value="shop">
          {isLoadingProfile ? (
            <div className="p-12 flex justify-center items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6 max-w-4xl">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Basic Info */}
                <div className="p-6 border rounded-lg space-y-4 bg-card shadow-sm">
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-primary">
                    <Store className="h-5 w-5" /> Shop & Owner Identity
                  </h2>
                  <div className="space-y-2">
                    <Label>Shop / Kendra Name <span className="text-destructive">*</span></Label>
                    <Input
                      name="shopName"
                      value={shopProfile.shopName || ''}
                      onChange={handleShopInputChange}
                      placeholder="e.g. KRUSHI OS SEVA KENDRA"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Owner / Proprietor Name</Label>
                    <Input
                      name="ownerName"
                      value={shopProfile.ownerName || ''}
                      onChange={handleShopInputChange}
                      placeholder="e.g. Prasad Mahajan"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>GSTIN Number</Label>
                    <Input
                      name="gstNumber"
                      value={shopProfile.gstNumber || ''}
                      onChange={handleShopInputChange}
                      placeholder="e.g. 27AAAAA0000A1Z5"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Licence Number</Label>
                      <Input
                        name="licenseNumber"
                        value={shopProfile.licenseNumber || ''}
                        onChange={handleShopInputChange}
                        placeholder="LIC/..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Registration Number</Label>
                      <Input
                        name="registrationNumber"
                        value={shopProfile.registrationNumber || ''}
                        onChange={handleShopInputChange}
                        placeholder="REG/..."
                      />
                    </div>
                  </div>
                </div>

                {/* Contact & Location */}
                <div className="p-6 border rounded-lg space-y-4 bg-card shadow-sm">
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-primary">
                    <Building2 className="h-5 w-5" /> Contact & Address
                  </h2>
                  <div className="space-y-2">
                    <Label>Shop Full Address</Label>
                    <Textarea
                      name="address"
                      value={shopProfile.address || ''}
                      onChange={handleShopInputChange}
                      placeholder="Main Market Road, Near Mandi..."
                      className="h-20"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Village / City</Label>
                      <Input
                        name="village"
                        value={shopProfile.village || ''}
                        onChange={handleShopInputChange}
                        placeholder="e.g. Kamari"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Taluka / Tehsil</Label>
                      <Input
                        name="taluka"
                        value={shopProfile.taluka || ''}
                        onChange={handleShopInputChange}
                        placeholder="e.g. Himayatnagar"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>District</Label>
                      <Input
                        name="district"
                        value={shopProfile.district || ''}
                        onChange={handleShopInputChange}
                        placeholder="e.g. Nanded"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Input
                        name="state"
                        value={shopProfile.state || ''}
                        onChange={handleShopInputChange}
                        placeholder="e.g. Maharashtra"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>PIN Code</Label>
                      <Input
                        name="pincode"
                        value={shopProfile.pincode || ''}
                        onChange={handleShopInputChange}
                        placeholder="e.g. 431802"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Phone 1</Label>
                      <Input
                        name="contact1"
                        value={shopProfile.contact1 || ''}
                        onChange={handleShopInputChange}
                        placeholder="e.g. 9876543210"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Contact Phone 2 / Email</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          name="contact2"
                          value={shopProfile.contact2 || ''}
                          onChange={handleShopInputChange}
                          placeholder="Alternate phone"
                        />
                        <Input
                          type="email"
                          name="email"
                          value={shopProfile.email || ''}
                          onChange={handleShopInputChange}
                          placeholder="Shop email"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bank Details */}
                <div className="p-6 border rounded-lg space-y-4 bg-card shadow-sm md:col-span-2">
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-primary">
                    <CreditCard className="h-5 w-5" /> Bank Account Details (Printed on Invoices)
                  </h2>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Account Holder Name</Label>
                      <Input
                        name="accountName"
                        value={shopProfile.accountName || ''}
                        onChange={handleShopInputChange}
                        placeholder={shopProfile.ownerName || "Name on Bank Account"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bank Name</Label>
                      <Input
                        name="bankName"
                        value={shopProfile.bankName || ''}
                        onChange={handleShopInputChange}
                        placeholder="e.g. Maharashtra Gramin Bank / SBI"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Account Number</Label>
                      <Input
                        name="accountNumber"
                        value={shopProfile.accountNumber || ''}
                        onChange={handleShopInputChange}
                        placeholder="Bank Account Number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>IFSC Code</Label>
                      <Input
                        name="ifsc"
                        value={shopProfile.ifsc || ''}
                        onChange={handleShopInputChange}
                        placeholder="e.g. MAHG0004120"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Branch</Label>
                      <Input
                        name="branch"
                        value={shopProfile.branch || ''}
                        onChange={handleShopInputChange}
                        placeholder="Branch Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Account Type</Label>
                      <Input
                        name="accountType"
                        value={shopProfile.accountType || ''}
                        onChange={handleShopInputChange}
                        placeholder="Current / Savings"
                      />
                    </div>
                  </div>
                </div>

                {/* Logo & Invoice Terms */}
                <div className="p-6 border rounded-lg space-y-4 bg-card shadow-sm md:col-span-2">
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-primary">
                    <Receipt className="h-5 w-5" /> Logo & Invoice Settings
                  </h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Invoice Terms & Conditions</Label>
                        <Textarea
                          name="invoiceTerms"
                          value={shopProfile.invoiceTerms || ''}
                          onChange={handleShopInputChange}
                          className="h-28"
                          placeholder="Terms printed at bottom of tax invoices..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Authorized Signatory Text</Label>
                        <Input
                          name="authorizedSignatory"
                          value={shopProfile.authorizedSignatory || ''}
                          onChange={handleShopInputChange}
                          placeholder={shopProfile.shopName || "e.g. MAULI KRUSHI SEVA KENDRA"}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Shop Logo</Label>
                      <div className="flex items-center gap-4">
                        {shopProfile.logoBase64 ? (
                          <div className="w-24 h-24 border border-border rounded-lg overflow-hidden flex items-center justify-center bg-muted/20">
                            <img src={shopProfile.logoBase64} alt="Shop Logo" className="max-w-full max-h-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-24 h-24 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center text-muted-foreground bg-muted/10">
                            <Building2 className="h-8 w-8 opacity-50" />
                            <span className="text-[10px] mt-1">No Logo</span>
                          </div>
                        )}
                        <div className="space-y-2">
                          <div className="relative inline-block">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <Button type="button" variant="outline" size="sm" className="flex items-center gap-2">
                              <Upload className="h-4 w-4" />
                              {shopProfile.logoBase64 ? 'Change Logo' : 'Upload Logo'}
                            </Button>
                          </div>
                          {shopProfile.logoBase64 && (
                            <div>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => setShopProfile(prev => ({ ...prev, logoBase64: '' }))}
                              >
                                Remove Logo
                              </Button>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">PNG, JPG under 1MB.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                className="bg-green-600 hover:bg-green-700 font-bold px-8 py-5 text-base shadow-sm"
                onClick={handleSaveShopProfile}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving to Supabase...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" /> Save Shop Profile to Supabase
                  </>
                )}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* TAB 2: INVOICE */}
        <TabsContent value="invoice">
          <div className="p-6 border rounded-lg space-y-4 bg-card max-w-2xl shadow-sm">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-primary">
              <Receipt className="h-5 w-5" /> Invoice & Receipt Numbering
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invoice Number Prefix (e.g. INV / KSK / KOS)</Label>
                <Input
                  value={invoiceSettings.prefix}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, prefix: e.target.value.toUpperCase() })}
                  placeholder="e.g. KOS"
                />
              </div>
              <div className="space-y-2">
                <Label>Next Invoice Starting Number</Label>
                <Input
                  type="number"
                  value={invoiceSettings.nextNumber}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, nextNumber: e.target.value })}
                  placeholder="e.g. 1001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Invoice Numbering Format</Label>
              <Select
                value={invoiceSettings.format}
                onValueChange={(val) => setInvoiceSettings({ ...invoiceSettings, format: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select numbering format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prefix-year-number">Prefix / Financial Year / Number (e.g. {invoiceSettings.prefix}/2026/{invoiceSettings.nextNumber})</SelectItem>
                  <SelectItem value="prefix-number">Prefix - Number (e.g. {invoiceSettings.prefix}-{invoiceSettings.nextNumber})</SelectItem>
                  <SelectItem value="simple-number">Simple Serial Number (e.g. #{invoiceSettings.nextNumber})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Invoice Header / Title</Label>
              <Input
                value={invoiceSettings.headerTitle}
                onChange={(e) => setInvoiceSettings({ ...invoiceSettings, headerTitle: e.target.value })}
                placeholder="TAX INVOICE / RETAIL BILL"
              />
            </div>

            <div className="space-y-2">
              <Label>Invoice Footer Notes / Terms & Conditions</Label>
              <Textarea
                rows={4}
                value={invoiceSettings.terms}
                onChange={(e) => setInvoiceSettings({ ...invoiceSettings, terms: e.target.value })}
                placeholder="Terms and conditions for farmers and customers..."
              />
            </div>

            <div className="space-y-2">
              <Label>Receipt Footer Message / Slogan</Label>
              <Input
                value={invoiceSettings.footer}
                onChange={(e) => setInvoiceSettings({ ...invoiceSettings, footer: e.target.value })}
                placeholder="Thank you for supporting sustainable agriculture!"
              />
            </div>

            <Button className="bg-green-600 hover:bg-green-700 font-semibold" onClick={() => handleSave("Invoice")} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" /> Save Invoice Settings
            </Button>
          </div>
        </TabsContent>

        {/* TAB 3: PRINT */}
        <TabsContent value="printing">
          <div className="p-6 border rounded-lg space-y-4 bg-card max-w-2xl shadow-sm">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-primary">
              <Printer className="h-5 w-5" /> Thermal Printer & Bill Layout
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Paper Size Selection</Label>
                <Select
                  value={printSettings.format}
                  onValueChange={(val) => setPrintSettings({ ...printSettings, format: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select paper size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A5">A5 Landscape (Tax Invoice)</SelectItem>
                    <SelectItem value="A4">A4 Full Sheet</SelectItem>
                    <SelectItem value="80mm">80mm Thermal Receipt (POS)</SelectItem>
                    <SelectItem value="58mm">58mm Mini Thermal Receipt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default Print Copies</Label>
                <Select
                  value={printSettings.copies}
                  onValueChange={(val) => setPrintSettings({ ...printSettings, copies: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select copies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Copy (Customer Bill)</SelectItem>
                    <SelectItem value="2">2 Copies (Customer + Store Copy)</SelectItem>
                    <SelectItem value="3">3 Copies (Customer + Store + Transporter)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Label>Header Text / Custom Header Message</Label>
              <Input
                value={printSettings.headerText}
                onChange={(e) => setPrintSettings({ ...printSettings, headerText: e.target.value })}
                placeholder="e.g. Krushi Seva Kendra - Seeds, Fertilizers & Pesticides"
              />
            </div>

            <div className="space-y-3 pt-3 border-t">
              <Label className="text-sm font-semibold">Show / Hide Bill Elements</Label>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Show Shop Name & Header</p>
                  <p className="text-xs text-muted-foreground">Print shop name at top of invoice</p>
                </div>
                <Switch
                  checked={printSettings.showShopName}
                  onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showShopName: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Show Shop Address</p>
                  <p className="text-xs text-muted-foreground">Print full address on receipt header</p>
                </div>
                <Switch
                  checked={printSettings.showAddress}
                  onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showAddress: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Show Phone & Contact</p>
                  <p className="text-xs text-muted-foreground">Print phone numbers on receipt</p>
                </div>
                <Switch
                  checked={printSettings.showPhone}
                  onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showPhone: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Show GSTIN Number</p>
                  <p className="text-xs text-muted-foreground">Display GSTIN on tax invoice</p>
                </div>
                <Switch
                  checked={printSettings.showGst}
                  onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showGst: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Show Licences</p>
                  <p className="text-xs text-muted-foreground">Print mandatory statutory licence numbers</p>
                </div>
                <Switch
                  checked={printSettings.showLicence}
                  onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showLicence: checked })}
                />
              </div>
            </div>

            <Button className="bg-green-600 hover:bg-green-700 font-semibold" onClick={() => handleSave("Print Layout")} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" /> Save Print Settings
            </Button>
          </div>
        </TabsContent>

        {/* TAB 4: TAX / GST */}
        <TabsContent value="tax">
          <div className="p-6 border rounded-lg space-y-4 bg-card max-w-2xl shadow-sm">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-primary">
              <Percent className="h-5 w-5" /> Tax & GST Compliance
            </h2>

            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border">
              <div>
                <p className="text-sm font-semibold">Enable GST Billing</p>
                <p className="text-xs text-muted-foreground">Toggle GST tax calculations on bills and sales invoices</p>
              </div>
              <Switch
                checked={taxSettings.gstEnabled}
                onCheckedChange={(checked) => setTaxSettings({ ...taxSettings, gstEnabled: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>GSTIN Number</Label>
              <Input
                value={taxSettings.gstin}
                onChange={(e) => setTaxSettings({ ...taxSettings, gstin: e.target.value.toUpperCase() })}
                placeholder="e.g. 27AAAAA0000A1Z5"
              />
            </div>

            <div className="space-y-2">
              <Label>State Code & Name</Label>
              <Input
                value={taxSettings.stateCode}
                onChange={(e) => setTaxSettings({ ...taxSettings, stateCode: e.target.value })}
                placeholder="e.g. 27 - Maharashtra"
              />
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Default GST %</Label>
                <Select
                  value={taxSettings.defaultGst}
                  onValueChange={(val) => {
                    const half = (Number(val) / 2).toString();
                    setTaxSettings({
                      ...taxSettings,
                      defaultGst: val,
                      defaultCgst: half,
                      defaultSgst: half,
                      defaultIgst: val
                    });
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0% (Exempt)</SelectItem>
                    <SelectItem value="5">5% (Fertilizers)</SelectItem>
                    <SelectItem value="12">12% (Bio-inputs)</SelectItem>
                    <SelectItem value="18">18% (Pesticides)</SelectItem>
                    <SelectItem value="28">28% (Equipment)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Default CGST %</Label>
                <Input
                  type="number"
                  className="h-9"
                  value={taxSettings.defaultCgst}
                  onChange={(e) => setTaxSettings({ ...taxSettings, defaultCgst: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Default SGST %</Label>
                <Input
                  type="number"
                  className="h-9"
                  value={taxSettings.defaultSgst}
                  onChange={(e) => setTaxSettings({ ...taxSettings, defaultSgst: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Default IGST %</Label>
                <Input
                  type="number"
                  className="h-9"
                  value={taxSettings.defaultIgst}
                  onChange={(e) => setTaxSettings({ ...taxSettings, defaultIgst: e.target.value })}
                />
              </div>
            </div>

            <Button className="bg-green-600 hover:bg-green-700 font-semibold" onClick={() => handleSave("GST & Tax")} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" /> Save Tax Settings
            </Button>
          </div>
        </TabsContent>

        {/* TAB 5: ACCOUNT */}
        <TabsContent value="account">
          <div className="p-6 border rounded-lg space-y-4 bg-card max-w-2xl shadow-sm">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5" /> Account & System Defaults
            </h2>

            <div className="space-y-2">
              <Label>Business Category / Type</Label>
              <Select
                value={accountSettings.businessType}
                onValueChange={(val) => setAccountSettings({ ...accountSettings, businessType: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Krushi Seva Kendra (Agri Retail & Wholesale)">Krushi Seva Kendra (Agri Retail & Wholesale)</SelectItem>
                  <SelectItem value="Fertilizer & Seed Distributor">Fertilizer & Seed Distributor</SelectItem>
                  <SelectItem value="Pesticide Dealer & Retailer">Pesticide Dealer & Retailer</SelectItem>
                  <SelectItem value="Farmer Producer Company (FPC / FPO)">Farmer Producer Company (FPC / FPO)</SelectItem>
                  <SelectItem value="General Farm Machinery & Input Store">General Farm Machinery & Input Store</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Currency</Label>
                <Select
                  value={accountSettings.currency}
                  onValueChange={(val) => setAccountSettings({ ...accountSettings, currency: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR (₹)">INR (₹) - Indian Rupee</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date Display Format</Label>
                <Select
                  value={accountSettings.dateFormat}
                  onValueChange={(val) => setAccountSettings({ ...accountSettings, dateFormat: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (Indian Standard)</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO Standard)</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US Format)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button className="bg-green-600 hover:bg-green-700 font-semibold" onClick={() => handleSave("Account")} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" /> Save Account Settings
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2 text-destructive" /> Sign Out
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
