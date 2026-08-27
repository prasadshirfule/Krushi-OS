"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Store, Receipt, Printer, Percent, ShieldCheck, Save, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("shop");
  const [isSaving, setIsSaving] = useState(false);

  const [shopSettings, setShopSettings] = useState({
    name: "Krushi Seva Kendra",
    address: "Main Market Road, Near Mandi Yard, Sehore, MP - 466001",
    phone: "9876543210",
    email: "contact@krushiseva.com",
    owner: "Prasad Mahajan",
  });

  const [invoiceSettings, setInvoiceSettings] = useState({
    prefix: "KOS",
    nextNumber: "1003",
    terms: "1. Goods once sold will not be taken back without valid batch receipt.\n2. Interest @ 18% p.a. charged on credit khata balances past 30 days.",
    footer: "Thank you for supporting sustainable agriculture!",
  });

  const [printSettings, setPrintSettings] = useState({
    format: "A4",
    copies: "2",
    showLogo: "true",
  });

  const [taxSettings, setTaxSettings] = useState({
    defaultGst: "18",
    gstin: "23AAACK1234F1Z9",
    stateCode: "23 - Madhya Pradesh",
  });

  const handleSave = (section: string) => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success(`${section} settings updated successfully!`);
    }, 400);
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
          <p className="text-sm text-muted-foreground">Configure shop profile, invoice numbering, thermal print layouts, and tax rates</p>
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
              />
            </div>
            <div className="space-y-2">
              <Label>Owner Name</Label>
              <Input 
                value={shopSettings.owner} 
                onChange={(e) => setShopSettings({ ...shopSettings, owner: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea 
                rows={3}
                value={shopSettings.address} 
                onChange={(e) => setShopSettings({ ...shopSettings, address: e.target.value })} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input 
                  value={shopSettings.phone} 
                  onChange={(e) => setShopSettings({ ...shopSettings, phone: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email" 
                  value={shopSettings.email} 
                  onChange={(e) => setShopSettings({ ...shopSettings, email: e.target.value })} 
                />
              </div>
            </div>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleSave("Shop Profile")} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" /> Save Shop Details
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="invoice">
          <div className="p-6 border rounded-lg space-y-4 bg-card max-w-2xl shadow-sm">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-primary">
              <Receipt className="h-5 w-5" /> Invoice & Receipt Numbering
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invoice Series Prefix</Label>
                <Input 
                  value={invoiceSettings.prefix} 
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, prefix: e.target.value })} 
                  placeholder="e.g. KOS"
                />
              </div>
              <div className="space-y-2">
                <Label>Next Invoice Serial #</Label>
                <Input 
                  value={invoiceSettings.nextNumber} 
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, nextNumber: e.target.value })} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Standard Terms & Conditions</Label>
              <Textarea 
                rows={4}
                value={invoiceSettings.terms} 
                onChange={(e) => setInvoiceSettings({ ...invoiceSettings, terms: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label>Receipt Footer Message</Label>
              <Input 
                value={invoiceSettings.footer} 
                onChange={(e) => setInvoiceSettings({ ...invoiceSettings, footer: e.target.value })} 
              />
            </div>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleSave("Invoice")} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" /> Save Invoice Config
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="printing">
          <div className="p-6 border rounded-lg space-y-4 bg-card max-w-2xl shadow-sm">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-primary">
              <Printer className="h-5 w-5" /> Print Layout & Hardware
            </h2>
            <div className="space-y-2">
              <Label>Default Print Paper Size</Label>
              <Select 
                value={printSettings.format} 
                onValueChange={(val) => setPrintSettings({ ...printSettings, format: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select paper format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A4">A4 Tax Invoice (Full Sheet)</SelectItem>
                  <SelectItem value="80mm">80mm Thermal Counter Receipt</SelectItem>
                  <SelectItem value="58mm">58mm Mini Thermal Receipt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default Copies</Label>
              <Input 
                type="number" 
                value={printSettings.copies} 
                onChange={(e) => setPrintSettings({ ...printSettings, copies: e.target.value })} 
              />
            </div>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleSave("Print Layout")} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" /> Save Printing Options
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="tax">
          <div className="p-6 border rounded-lg space-y-4 bg-card max-w-2xl shadow-sm">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-primary">
              <Percent className="h-5 w-5" /> Tax & GST Compliance
            </h2>
            <div className="space-y-2">
              <Label>GSTIN Number</Label>
              <Input 
                value={taxSettings.gstin} 
                onChange={(e) => setTaxSettings({ ...taxSettings, gstin: e.target.value.toUpperCase() })} 
              />
            </div>
            <div className="space-y-2">
              <Label>State Code & Name</Label>
              <Input 
                value={taxSettings.stateCode} 
                onChange={(e) => setTaxSettings({ ...taxSettings, stateCode: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label>Default GST Rate (%)</Label>
              <Input 
                type="number" 
                value={taxSettings.defaultGst} 
                onChange={(e) => setTaxSettings({ ...taxSettings, defaultGst: e.target.value })} 
              />
            </div>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleSave("GST & Tax")} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" /> Save Tax Settings
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="account">
          <div className="p-6 border rounded-lg space-y-4 bg-card max-w-2xl shadow-sm">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5" /> Active Session & Account
            </h2>
            <div className="p-4 bg-muted rounded-md space-y-1 text-sm">
              <div><span className="font-semibold">Logged in as:</span> Demo Admin</div>
              <div><span className="font-semibold">Role:</span> Super Administrator</div>
              <div><span className="font-semibold">Access Level:</span> Unrestricted ERP / POS Access</div>
            </div>
            <Button variant="destructive" onClick={handleLogout} className="mt-4">
              <LogOut className="h-4 w-4 mr-2" /> End Session & Logout
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
