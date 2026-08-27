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
import { Store, Receipt, Printer, Percent, ShieldCheck, Save, LogOut, FileText, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";

const DEFAULTS = {
  shop: {
    name: "Krushi Seva Kendra",
    tagline: "Your Trusted Agricultural Partner",
    address: "Main Market Road, Near Mandi Yard, Sehore, MP - 466001",
    phone: "9876543210",
    email: "contact@krushiseva.com",
    owner: "Prasad Mahajan",
    fertilizerLicence: "LIC/FERT/2024/0981",
    seedLicence: "LIC/SEED/2023/4512",
    pesticideLicence: "LIC/PEST/2024/7834",
  },
  invoice: {
    prefix: "KOS",
    nextNumber: "1004",
    format: "prefix-year-number",
    headerTitle: "TAX INVOICE / RETAIL BILL",
    terms: "1. Goods once sold will not be taken back without valid batch receipt.\n2. Interest @ 18% p.a. charged on credit khata balances past 30 days.\n3. Check expiry date and seal before opening the package.",
    footer: "Thank you for supporting sustainable agriculture! Happy Farming!",
  },
  print: {
    format: "80mm",
    copies: "1",
    showLogo: true,
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
    stateCode: "23 - Madhya Pradesh",
    defaultHsn: "3808",
    requireHsn: true,
    compositionScheme: false,
  },
  account: {
    businessType: "Krushi Seva Kendra (Agri Retail & Wholesale)",
    currency: "INR (₹)",
    dateFormat: "DD/MM/YYYY",
    financialYearStart: "1st April",
    timezone: "Asia/Kolkata (IST +5:30)",
    adminName: "Prasad Mahajan",
    adminRole: "Super Administrator",
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
  const [activeTab, setActiveTab] = useState("shop");
  const [isSaving, setIsSaving] = useState(false);

  const [shopSettings, setShopSettings] = useState(DEFAULTS.shop);
  const [invoiceSettings, setInvoiceSettings] = useState(DEFAULTS.invoice);
  const [printSettings, setPrintSettings] = useState(DEFAULTS.print);
  const [taxSettings, setTaxSettings] = useState(DEFAULTS.tax);
  const [accountSettings, setAccountSettings] = useState(DEFAULTS.account);

  // Load persisted settings on mount
  useEffect(() => {
    setShopSettings(loadSetting('shop', DEFAULTS.shop));
    setInvoiceSettings(loadSetting('invoice', DEFAULTS.invoice));
    setPrintSettings(loadSetting('print', DEFAULTS.print));
    setTaxSettings(loadSetting('tax', DEFAULTS.tax));
    setAccountSettings(loadSetting('account', DEFAULTS.account));
  }, []);

  const handleSave = (section: string) => {
    setIsSaving(true);
    try {
      switch (section) {
        case 'Shop Profile': saveSetting('shop', shopSettings); break;
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

  const handleLogout = () => {
    toast.info("Logged out successfully");
    router.push("/dashboard");
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
          <p className="text-sm text-muted-foreground">Configure shop profile, invoice numbering, thermal print layouts, tax rates, and account defaults</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl mb-6">
          <TabsTrigger value="shop" className="flex items-center gap-2">
            <Store className="h-4 w-4" /> Shop
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
        
        {/* TAB 1: SHOP */}
        <TabsContent value="shop">
          <div className="p-6 border rounded-lg space-y-4 bg-card max-w-2xl shadow-sm">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-primary">
              <Store className="h-5 w-5" /> Shop Profile & Identity
            </h2>
            <div className="space-y-2">
              <Label>Shop / Kendra Name</Label>
              <Input 
                value={shopSettings.name} 
                onChange={(e) => setShopSettings({ ...shopSettings, name: e.target.value })} 
                placeholder="e.g. Krushi Seva Kendra"
              />
            </div>
            <div className="space-y-2">
              <Label>Header Tagline / Slogan</Label>
              <Input 
                value={shopSettings.tagline} 
                onChange={(e) => setShopSettings({ ...shopSettings, tagline: e.target.value })} 
                placeholder="e.g. Seeds, Fertilizers, Pesticides & Farm Equipment"
              />
            </div>
            <div className="space-y-2">
              <Label>Owner Name</Label>
              <Input 
                value={shopSettings.owner} 
                onChange={(e) => setShopSettings({ ...shopSettings, owner: e.target.value })} 
                placeholder="Owner / Proprietor Name"
              />
            </div>
            <div className="space-y-2">
              <Label>Shop Address</Label>
              <Textarea 
                rows={3}
                value={shopSettings.address} 
                onChange={(e) => setShopSettings({ ...shopSettings, address: e.target.value })} 
                placeholder="Full address with Mandi / Taluka details"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input 
                  value={shopSettings.phone} 
                  onChange={(e) => setShopSettings({ ...shopSettings, phone: e.target.value })} 
                  placeholder="Primary contact number"
                />
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input 
                  type="email" 
                  value={shopSettings.email} 
                  onChange={(e) => setShopSettings({ ...shopSettings, email: e.target.value })} 
                  placeholder="Shop email"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <Label className="text-xs">Fertilizer Licence</Label>
                <Input 
                  className="text-xs h-8"
                  value={shopSettings.fertilizerLicence} 
                  onChange={(e) => setShopSettings({ ...shopSettings, fertilizerLicence: e.target.value })} 
                  placeholder="LIC/FERT/..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Seed Licence</Label>
                <Input 
                  className="text-xs h-8"
                  value={shopSettings.seedLicence} 
                  onChange={(e) => setShopSettings({ ...shopSettings, seedLicence: e.target.value })} 
                  placeholder="LIC/SEED/..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pesticide Licence</Label>
                <Input 
                  className="text-xs h-8"
                  value={shopSettings.pesticideLicence} 
                  onChange={(e) => setShopSettings({ ...shopSettings, pesticideLicence: e.target.value })} 
                  placeholder="LIC/PEST/..."
                />
              </div>
            </div>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleSave("Shop Profile")} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" /> Save Shop Details
            </Button>
          </div>
        </TabsContent>

        {/* TAB 2: INVOICE */}
        <TabsContent value="invoice">
          <div className="p-6 border rounded-lg space-y-4 bg-card max-w-2xl shadow-sm">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-primary">
              <Receipt className="h-5 w-5" /> Invoice & Receipt Numbering
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invoice Number Prefix</Label>
                <Input 
                  value={invoiceSettings.prefix} 
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, prefix: e.target.value.toUpperCase() })} 
                  placeholder="e.g. KOS, INV, KSK"
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
              <Label>Standard Terms & Conditions (Shown on Invoices)</Label>
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

            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleSave("Invoice")} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" /> Save Invoice Config
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
                <Label>Default Paper Format / Width</Label>
                <Select 
                  value={printSettings.format} 
                  onValueChange={(val) => setPrintSettings({ ...printSettings, format: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select paper format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="80mm">80mm Thermal Receipt (Standard POS)</SelectItem>
                    <SelectItem value="58mm">58mm Mini Thermal Receipt (Pocket POS)</SelectItem>
                    <SelectItem value="A4">A4 Full Sheet (Tax Invoice)</SelectItem>
                    <SelectItem value="A5">A5 Half Sheet</SelectItem>
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

            <div className="space-y-3 pt-3 border-t">
              <Label className="text-sm font-semibold">Print Elements Configuration</Label>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Show Shop Address</p>
                  <p className="text-xs text-muted-foreground">Print full address on header</p>
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
                  <p className="text-xs text-muted-foreground">Display GST number on tax invoice</p>
                </div>
                <Switch 
                  checked={printSettings.showGst} 
                  onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showGst: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Show CIB / Fertilizer Licences</p>
                  <p className="text-xs text-muted-foreground">Print mandatory statutory licence numbers</p>
                </div>
                <Switch 
                  checked={printSettings.showLicence} 
                  onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showLicence: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Show Customer Details</p>
                  <p className="text-xs text-muted-foreground">Print farmer name, mobile & village</p>
                </div>
                <Switch 
                  checked={printSettings.showCustomer} 
                  onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showCustomer: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Show Terms & Conditions</p>
                  <p className="text-xs text-muted-foreground">Print return & interest policies on footer</p>
                </div>
                <Switch 
                  checked={printSettings.showTerms} 
                  onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showTerms: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Show UPI Payment QR Code</p>
                  <p className="text-xs text-muted-foreground">Print dynamic UPI QR for quick scan & pay</p>
                </div>
                <Switch 
                  checked={printSettings.showQrCode} 
                  onCheckedChange={(checked) => setPrintSettings({ ...printSettings, showQrCode: checked })}
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Label>Thermal Bill Footer Message</Label>
              <Input 
                value={printSettings.footerMessage} 
                onChange={(e) => setPrintSettings({ ...printSettings, footerMessage: e.target.value })} 
                placeholder="Visit Again | Krushi Seva Kendra"
              />
            </div>

            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleSave("Print Layout")} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" /> Save Printing Options
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
                <p className="text-xs text-muted-foreground">Calculate CGST, SGST, IGST on bills and sales invoices</p>
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
                placeholder="e.g. 23AAACK1234F1Z9"
              />
            </div>

            <div className="space-y-2">
              <Label>State Code & Name</Label>
              <Input 
                value={taxSettings.stateCode} 
                onChange={(e) => setTaxSettings({ ...taxSettings, stateCode: e.target.value })} 
                placeholder="e.g. 23 - Madhya Pradesh"
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
                <Label className="text-xs">CGST %</Label>
                <Input 
                  type="number" 
                  className="h-9"
                  value={taxSettings.defaultCgst} 
                  onChange={(e) => setTaxSettings({ ...taxSettings, defaultCgst: e.target.value })} 
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">SGST %</Label>
                <Input 
                  type="number" 
                  className="h-9"
                  value={taxSettings.defaultSgst} 
                  onChange={(e) => setTaxSettings({ ...taxSettings, defaultSgst: e.target.value })} 
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">IGST %</Label>
                <Input 
                  type="number" 
                  className="h-9"
                  value={taxSettings.defaultIgst} 
                  onChange={(e) => setTaxSettings({ ...taxSettings, defaultIgst: e.target.value })} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div className="space-y-2">
                <Label>Default HSN Code</Label>
                <Input 
                  value={taxSettings.defaultHsn} 
                  onChange={(e) => setTaxSettings({ ...taxSettings, defaultHsn: e.target.value })} 
                  placeholder="e.g. 3808 (Pesticides) / 3105 (Fertilizers)"
                />
              </div>

              <div className="flex flex-col justify-end space-y-2 pb-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Require HSN on All Items</Label>
                  <Switch 
                    checked={taxSettings.requireHsn} 
                    onCheckedChange={(checked) => setTaxSettings({ ...taxSettings, requireHsn: checked })}
                  />
                </div>
              </div>
            </div>

            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleSave("GST & Tax")} disabled={isSaving}>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Financial Year Cycle</Label>
                <Select 
                  value={accountSettings.financialYearStart} 
                  onValueChange={(val) => setAccountSettings({ ...accountSettings, financialYearStart: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1st April">1st April - 31st March (Indian FY)</SelectItem>
                    <SelectItem value="1st January">1st January - 31st December (Calendar Year)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>System Timezone</Label>
                <Input 
                  value={accountSettings.timezone} 
                  onChange={(e) => setAccountSettings({ ...accountSettings, timezone: e.target.value })} 
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label>Administrator Name</Label>
              <Input 
                value={accountSettings.adminName} 
                onChange={(e) => setAccountSettings({ ...accountSettings, adminName: e.target.value })} 
                placeholder="Administrator name"
              />
            </div>

            <div className="p-4 bg-muted/50 rounded-lg space-y-1 text-sm border">
              <div><span className="font-semibold">Current Session:</span> Demo Admin</div>
              <div><span className="font-semibold">Role:</span> {accountSettings.adminRole}</div>
              <div><span className="font-semibold">Permissions:</span> Full Access (Billing, Inventory, Purchases, Accounting, Reports)</div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleSave("Account")} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" /> Save Account Settings
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2 text-destructive" /> End Session
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
