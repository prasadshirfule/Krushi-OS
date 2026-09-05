'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Building2, Save, Upload, Loader2, IndianRupee, Store, FileText, MapPin, Phone } from 'lucide-react';

const KRUSHI_DEMO_SHOP_DETAILS = 'krushi_demo_shop_details';

export default function ShopDetailsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    shopName: '',
    ownerName: '',
    gstNumber: '',
    address: '',
    village: '',
    district: '',
    state: '',
    pincode: '',
    contact1: '',
    contact2: '',
    email: '',
    licenseNumber: '',
    registrationNumber: '',
    invoiceTerms: '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if not paid within 30 days.',
    authorizedSignatory: '',
    logoBase64: '',
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KRUSHI_DEMO_SHOP_DETAILS);
      if (stored) {
        const parsed = JSON.parse(stored);
        setFormData((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.error('Failed to load shop details', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
      setFormData((prev) => ({ ...prev, logoBase64: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!formData.shopName.trim()) {
      toast.error('Shop Name is required');
      return;
    }
    
    setSaving(true);
    try {
      localStorage.setItem(KRUSHI_DEMO_SHOP_DETAILS, JSON.stringify(formData));
      toast.success('Shop details saved successfully');
    } catch (error) {
      console.error('Failed to save shop details', error);
      toast.error('Failed to save shop details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shop Details</h1>
          <p className="text-muted-foreground mt-1">Manage your shop information, logo, and invoice settings.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="lg" className="font-bold px-6 shadow-sm">
          {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
          Save Details
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /> Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Shop / Business Name <span className="text-destructive">*</span></Label>
              <Input name="shopName" value={formData.shopName} onChange={handleInputChange} placeholder="e.g. KRUSHI SEVA KENDRA" />
            </div>
            <div className="space-y-2">
              <Label>Owner Name</Label>
              <Input name="ownerName" value={formData.ownerName} onChange={handleInputChange} placeholder="e.g. Ramesh Patel" />
            </div>
            <div className="space-y-2">
              <Label>GST Number</Label>
              <Input name="gstNumber" value={formData.gstNumber} onChange={handleInputChange} placeholder="e.g. 22AAAAA0000A1Z5" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>License Number</Label>
                <Input name="licenseNumber" value={formData.licenseNumber} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label>Registration Number</Label>
                <Input name="registrationNumber" value={formData.registrationNumber} onChange={handleInputChange} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact & Location */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Contact & Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Shop Address</Label>
              <Textarea name="address" value={formData.address} onChange={handleInputChange} placeholder="Main Market Road..." className="h-20" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Village / City</Label>
                <Input name="village" value={formData.village} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label>District</Label>
                <Input name="district" value={formData.district} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input name="state" value={formData.state} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label>PIN Code</Label>
                <Input name="pincode" value={formData.pincode} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label>Contact Number 1</Label>
                <Input name="contact1" value={formData.contact1} onChange={handleInputChange} placeholder="e.g. 9876543210" />
              </div>
              <div className="space-y-2">
                <Label>Contact Number 2</Label>
                <Input name="contact2" value={formData.contact2} onChange={handleInputChange} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Settings */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Invoice Settings & Logo</CardTitle>
            <CardDescription>Configure how your invoices look when printed</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Invoice Terms & Conditions</Label>
                <Textarea 
                  name="invoiceTerms" 
                  value={formData.invoiceTerms} 
                  onChange={handleInputChange} 
                  className="h-32" 
                  placeholder="Terms printed at the bottom of the invoice..."
                />
              </div>
              <div className="space-y-2">
                <Label>Authorized Signatory Text</Label>
                <Input 
                  name="authorizedSignatory" 
                  value={formData.authorizedSignatory} 
                  onChange={handleInputChange} 
                  placeholder="e.g. For Krushi Seva Kendra" 
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <Label>Shop Logo</Label>
              <div className="flex flex-col gap-4">
                {formData.logoBase64 ? (
                  <div className="relative w-48 h-48 border border-border rounded-lg overflow-hidden flex items-center justify-center bg-muted/20">
                    <img src={formData.logoBase64} alt="Shop Logo" className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-48 h-48 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center text-muted-foreground bg-muted/10">
                    <Building2 className="h-10 w-10 mb-2 opacity-50" />
                    <span className="text-sm font-medium">No Logo Uploaded</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleLogoUpload} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Button type="button" variant="outline" className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      {formData.logoBase64 ? 'Change Logo' : 'Upload Logo'}
                    </Button>
                  </div>
                  {formData.logoBase64 && (
                    <Button 
                      type="button" 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => setFormData(prev => ({ ...prev, logoBase64: '' }))}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Square image recommended. Max size: 1MB.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
