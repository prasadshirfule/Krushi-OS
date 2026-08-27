'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Store, Building2, MapPin, CheckCircle2 } from 'lucide-react';

export default function SetupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    shopName: 'Krushi Seva Kendra',
    ownerName: 'Prasad Mahajan',
    phone: '9876543210',
    gstin: '23AAACK1234F1Z9',
    address: 'Main Market Road, Near Mandi Yard',
    city: 'Sehore',
    state: 'Madhya Pradesh',
    pincode: '466001',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      document.cookie = 'krushi_demo_session=true; path=/; max-age=86400';
      toast.success('Shop registered successfully! Welcome to KRUSHI OS.');
      setIsLoading(false);
      router.push('/dashboard');
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-xl shadow-lg border-primary/20">
        <CardHeader className="text-center space-y-1">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl mb-2">
            🌾
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Initial Shop Setup</CardTitle>
          <CardDescription>
            Configure your Krushi Kendra details to generate valid GST tax invoices and customer receipts.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shopName" className="flex items-center gap-1.5 font-medium">
                  <Store className="h-4 w-4 text-primary" /> Shop / Business Name
                </Label>
                <Input
                  id="shopName"
                  required
                  value={formData.shopName}
                  onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                  placeholder="e.g. Jai Kisan Krushi Seva Kendra"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerName" className="font-medium">Owner Full Name</Label>
                <Input
                  id="ownerName"
                  required
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  placeholder="e.g. Ramesh Chandra"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="font-medium">Contact Phone</Label>
                <Input
                  id="phone"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="10-digit mobile number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gstin" className="flex items-center gap-1.5 font-medium">
                  <Building2 className="h-4 w-4 text-primary" /> GSTIN Number (Optional)
                </Label>
                <Input
                  id="gstin"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  placeholder="15-digit GSTIN"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-1.5 font-medium">
                <MapPin className="h-4 w-4 text-primary" /> Store Address
              </Label>
              <Textarea
                id="address"
                required
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Shop number, street, landmark"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city" className="text-xs font-medium">City / District</Label>
                <Input
                  id="city"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state" className="text-xs font-medium">State</Label>
                <Input
                  id="state"
                  required
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pincode" className="text-xs font-medium">Pincode</Label>
                <Input
                  id="pincode"
                  required
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-2">
            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 font-semibold text-base py-5" disabled={isLoading}>
              {isLoading ? (
                'Initializing Shop...'
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" /> Complete Setup & Enter Dashboard
                </span>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
