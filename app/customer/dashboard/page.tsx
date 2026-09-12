'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  LogOut,
  User,
  Sprout,
  Loader2,
  Phone,
  Mail,
  Edit2,
  Plus,
  Link2,
  Store,
  Receipt,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Bell,
  CheckCheck,
  RefreshCw,
  ShoppingBag,
  Calendar,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDisplayMobile, isValidIndianMobile } from '@/lib/phone-utils';
import { updateCustomerMobileAction } from '@/actions/customer-auth';
import {
  getCustomerDashboardDataAction,
  markCustomerNotificationReadAction,
} from '@/actions/customer-portal';
import { formatCurrency } from '@/lib/utils';
import {
  CustomerDashboardData,
  CustomerPortalBillSummary,
} from '@/services/customer-portal.service';

export default function CustomerDashboardPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [data, setData] = useState<CustomerDashboardData | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShopId, setSelectedShopId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('ALL');

  // Mobile Dialog state
  const [isMobileDialogOpen, setIsMobileDialogOpen] = useState(false);
  const [mobileInput, setMobileInput] = useState('');
  const [isSavingMobile, setIsSavingMobile] = useState(false);

  // Notifications Dialog state
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [markingNotificationId, setMarkingNotificationId] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const res = await getCustomerDashboardDataAction();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        // Check if unauthenticated
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          window.location.href = '/customer/login';
          return;
        }
        toast.error(res.error || 'Failed to load customer dashboard.');
      }
    } catch (err: any) {
      console.error('Failed to load customer dashboard:', err);
      toast.error('An error occurred while loading your purchase history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success('Logged out successfully.');
      window.location.href = '/customer/login';
    } catch (err: any) {
      console.error('Logout error:', err);
      toast.error(err.message || 'Failed to log out.');
      setIsLoggingOut(false);
    }
  };

  const handleOpenMobileDialog = () => {
    setMobileInput(data?.customer?.mobile || '');
    setIsMobileDialogOpen(true);
  };

  const handleSaveMobile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!mobileInput.trim()) {
      toast.error('Please enter a mobile number.');
      return;
    }

    if (!isValidIndianMobile(mobileInput.trim())) {
      toast.error('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
      return;
    }

    setIsSavingMobile(true);
    try {
      const result = await updateCustomerMobileAction(mobileInput.trim());

      if (!result.success) {
        toast.error(result.error || 'Failed to update mobile number.');
        setIsSavingMobile(false);
        return;
      }

      toast.success('Mobile number saved! Re-syncing your purchase bills...');
      setIsMobileDialogOpen(false);
      await loadDashboardData();
    } catch (err: any) {
      console.error('Error saving mobile:', err);
      toast.error(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSavingMobile(false);
    }
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    setMarkingNotificationId(notificationId);
    try {
      const res = await markCustomerNotificationReadAction(notificationId);
      if (res.success) {
        setData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            notifications: prev.notifications.map((n) =>
              n.id === notificationId ? { ...n, is_read: true } : n
            ),
          };
        });
      }
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    } finally {
      setMarkingNotificationId(null);
    }
  };

  // Filtered Bills logic
  const filteredBills = useMemo(() => {
    if (!data?.bills) return [];

    return data.bills.filter((bill) => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesInvoice = bill.invoice_number.toLowerCase().includes(q);
        const matchesShop = bill.shop_name.toLowerCase().includes(q);
        if (!matchesInvoice && !matchesShop) return false;
      }

      // 2. Shop Filter
      if (selectedShopId !== 'ALL' && bill.shop_id !== selectedShopId) {
        return false;
      }

      // 3. Status Filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'PAID' && bill.payment_status !== 'PAID') return false;
        if (selectedStatus === 'PARTIAL' && bill.payment_status !== 'PARTIAL') return false;
        if (selectedStatus === 'CREDIT' && bill.payment_status !== 'CREDIT' && bill.payment_status !== 'UNPAID') return false;
        if (selectedStatus === 'CANCELLED' && bill.status !== 'CANCELLED') return false;
        if (selectedStatus === 'RETURNED' && bill.status !== 'RETURNED' && bill.status !== 'PARTIALLY_RETURNED') return false;
      }

      // 4. Date Filter
      if (selectedDateRange !== 'ALL' && bill.sale_date) {
        const billDate = new Date(bill.sale_date);
        const now = new Date();

        if (selectedDateRange === '30_DAYS') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          if (billDate < thirtyDaysAgo) return false;
        } else if (selectedDateRange === 'THIS_MONTH') {
          if (billDate.getMonth() !== now.getMonth() || billDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        } else if (selectedDateRange === 'THIS_YEAR') {
          if (billDate.getFullYear() !== now.getFullYear()) return false;
        }
      }

      return true;
    });
  }, [data?.bills, searchQuery, selectedShopId, selectedStatus, selectedDateRange]);

  const unreadNotificationsCount = useMemo(() => {
    return data?.notifications.filter((n) => !n.is_read).length || 0;
  }, [data?.notifications]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Loading your customer portal...</p>
      </div>
    );
  }

  const customer = data?.customer;
  const summary = data?.summary;
  const linkedShops = data?.linkedShops || [];

  return (
    <div className="min-h-screen flex flex-col bg-muted/20 pb-12">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-card px-4 md:px-8 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-lg">
            🌾
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground leading-none">KRUSHI OS</h1>
            <p className="text-[11px] text-muted-foreground font-medium">Customer Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsNotificationsOpen(true)}
            className="relative h-9 px-3 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                {unreadNotificationsCount}
              </span>
            )}
          </Button>

          {/* Sign Out Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30"
          >
            {isLoggingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto p-4 md:p-8 space-y-6">
        {/* Welcome & Profile Card */}
        <div className="bg-card border rounded-2xl p-5 md:p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Sprout className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground truncate">
                  Welcome, {customer?.name || 'Farmer'}
                </h2>
                <p className="text-xs text-muted-foreground truncate">{customer?.email}</p>
              </div>
            </div>

            {/* Mobile & Linking Badge */}
            <div className="flex items-center justify-between md:justify-end gap-3 bg-muted/40 border rounded-xl px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground/80 shrink-0" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-foreground">
                      {customer?.displayMobile || 'No mobile added'}
                    </span>
                    {customer?.mobile && (
                      <span className="flex items-center text-[10px] text-emerald-600 font-medium">
                        <Link2 className="h-3 w-3 mr-0.5" /> Linked
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    {customer?.mobile ? 'Used for multi-shop bill linking' : 'Add mobile to link store bills'}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenMobileDialog}
                className="h-7 px-2.5 text-xs font-semibold border-emerald-600/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
              >
                {customer?.mobile ? (
                  <>
                    <Edit2 className="h-3 w-3 mr-1" /> Edit
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3 mr-1" /> Add Mobile
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Metrics Overview Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* Total Purchases */}
          <div className="bg-card border rounded-2xl p-4 md:p-5 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Total Purchases</span>
              <ShoppingBag className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-lg md:text-2xl font-bold text-foreground font-mono">
              {formatCurrency(summary?.totalPurchases || 0)}
            </div>
            <span className="text-[11px] text-muted-foreground block">Across all linked stores</span>
          </div>

          {/* Total Invoices */}
          <div className="bg-card border rounded-2xl p-4 md:p-5 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Total Bills</span>
              <Receipt className="h-4 w-4 text-primary" />
            </div>
            <div className="text-lg md:text-2xl font-bold text-foreground font-mono">
              {summary?.totalInvoices || 0}
            </div>
            <span className="text-[11px] text-muted-foreground block">
              In {summary?.linkedShopsCount || 0} Krushi OS {summary?.linkedShopsCount === 1 ? 'store' : 'stores'}
            </span>
          </div>

          {/* Total Paid */}
          <div className="bg-card border rounded-2xl p-4 md:p-5 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Total Paid</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-lg md:text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {formatCurrency(summary?.totalPaid || 0)}
            </div>
            <span className="text-[11px] text-muted-foreground block">Cleared transactions</span>
          </div>

          {/* Outstanding Balance */}
          <div className="bg-card border rounded-2xl p-4 md:p-5 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Outstanding</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-lg md:text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono">
              {formatCurrency(summary?.totalOutstanding || 0)}
            </div>
            <span className="text-[11px] text-muted-foreground block">Pending credit balance</span>
          </div>
        </div>

        {/* Linked Shops Filter Chips */}
        {linkedShops.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-muted-foreground font-medium shrink-0 flex items-center gap-1 text-[11px]">
              <Store className="h-3.5 w-3.5" /> Filter by Shop:
            </span>
            <Button
              size="sm"
              variant={selectedShopId === 'ALL' ? 'default' : 'outline'}
              onClick={() => setSelectedShopId('ALL')}
              className={`h-7 px-3 text-xs rounded-full ${
                selectedShopId === 'ALL' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
              }`}
            >
              All Shops ({data?.bills.length || 0})
            </Button>
            {linkedShops.map((s) => (
              <Button
                key={s.id}
                size="sm"
                variant={selectedShopId === s.id ? 'default' : 'outline'}
                onClick={() => setSelectedShopId(s.id)}
                className={`h-7 px-3 text-xs rounded-full shrink-0 ${
                  selectedShopId === s.id ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
                }`}
              >
                {s.name} ({s.bill_count || 0})
              </Button>
            ))}
          </div>
        )}

        {/* Purchase History Section */}
        <div className="bg-card border rounded-2xl shadow-xs overflow-hidden space-y-4 p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Purchase History</h3>
              <p className="text-xs text-muted-foreground">
                Showing {filteredBills.length} of {data?.bills.length || 0} purchase invoices
              </p>
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboardData}
              className="h-8 gap-1 text-xs self-start md:self-auto"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>

          {/* Search and Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice or store..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Shop Selector */}
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="h-9 px-3 text-xs rounded-md border bg-background text-foreground"
            >
              <option value="ALL">All Stores</option>
              {linkedShops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 px-3 text-xs rounded-md border bg-background text-foreground"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PARTIAL">Partial</option>
              <option value="CREDIT">Credit / Udhar</option>
              <option value="RETURNED">Returned</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {/* Date Filter */}
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              className="h-9 px-3 text-xs rounded-md border bg-background text-foreground"
            >
              <option value="ALL">All Time</option>
              <option value="30_DAYS">Last 30 Days</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="THIS_YEAR">This Year</option>
            </select>
          </div>

          {/* Bills Content */}
          {filteredBills.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Receipt className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-foreground">No Purchase Bills Found</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {data?.bills.length === 0
                  ? 'No purchases are currently linked to your customer mobile number. Ensure the shopkeeper bills using your registered mobile number.'
                  : 'No bills match your active search and filter criteria. Try resetting filters.'}
              </p>
              {data?.bills.length === 0 && !customer?.mobile && (
                <Button
                  size="sm"
                  onClick={handleOpenMobileDialog}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Mobile to Link Bills
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Cards View (< 768px) */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filteredBills.map((bill) => {
                  const isCancelled = bill.status === 'CANCELLED';
                  const isReturned = bill.status === 'RETURNED';
                  const isPartiallyReturned = bill.status === 'PARTIALLY_RETURNED';
                  const isCredit = bill.payment_status === 'CREDIT' || bill.payment_status === 'UNPAID';
                  const isPartial = bill.payment_status === 'PARTIAL';

                  const dateFormatted = bill.sale_date
                    ? new Date(bill.sale_date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—';

                  return (
                    <div
                      key={bill.id}
                      className="bg-card border rounded-xl p-4 space-y-3 shadow-xs hover:border-emerald-500/40 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-mono font-bold text-sm text-foreground">
                            {bill.invoice_number}
                          </span>
                          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                            <Store className="h-3 w-3 text-emerald-600" /> {bill.shop_name}
                          </p>
                        </div>

                        {/* Status Badge */}
                        <div className="text-right">
                          {bill.payment_status === 'PAID' && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] uppercase font-bold">
                              Paid
                            </Badge>
                          )}
                          {isPartial && (
                            <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[10px] uppercase font-bold">
                              Partial
                            </Badge>
                          )}
                          {isCredit && (
                            <Badge variant="outline" className="border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10 text-[10px] uppercase font-bold">
                              Credit
                            </Badge>
                          )}
                          {isCancelled && (
                            <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                              Cancelled
                            </Badge>
                          )}
                          {isReturned && (
                            <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                              Returned
                            </Badge>
                          )}
                          {isPartiallyReturned && (
                            <Badge variant="outline" className="border-amber-500/30 text-amber-600 text-[10px] uppercase font-bold">
                              Part. Return
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {dateFormatted}
                        </span>
                        <div className="text-right">
                          <span className="font-mono font-bold text-foreground text-sm">
                            {formatCurrency(bill.total_amount)}
                          </span>
                          {bill.balance_due > 0 && (
                            <span className="block text-[10px] text-rose-600 font-mono font-semibold">
                              Due: {formatCurrency(bill.balance_due)}
                            </span>
                          )}
                        </div>
                      </div>

                      <Link href={`/customer/bills/${bill.id}`} className="block">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-8 text-xs font-semibold justify-between border-emerald-600/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                        >
                          <span>View Invoice & Download</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (>= 768px) */}
              <div className="hidden md:block overflow-x-auto rounded-xl border">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-3">Store</th>
                      <th className="px-4 py-3">Invoice #</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Total Amount</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredBills.map((bill) => {
                      const isCancelled = bill.status === 'CANCELLED';
                      const isReturned = bill.status === 'RETURNED';
                      const isPartiallyReturned = bill.status === 'PARTIALLY_RETURNED';
                      const isCredit = bill.payment_status === 'CREDIT' || bill.payment_status === 'UNPAID';
                      const isPartial = bill.payment_status === 'PARTIAL';

                      const dateFormatted = bill.sale_date
                        ? new Date(bill.sale_date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—';

                      return (
                        <tr key={bill.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3.5 font-semibold text-foreground">
                            <div className="flex items-center gap-1.5">
                              <Store className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="truncate max-w-[150px]">{bill.shop_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-foreground">
                            {bill.invoice_number}
                          </td>
                          <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                            {dateFormatted}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-foreground">
                            {formatCurrency(bill.total_amount)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            {formatCurrency(bill.paid_amount || 0)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-muted-foreground">
                            {bill.balance_due > 0 ? (
                              <span className="text-rose-600 font-semibold font-mono">
                                {formatCurrency(bill.balance_due)}
                              </span>
                            ) : (
                              '₹0.00'
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {bill.payment_status === 'PAID' && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] uppercase font-bold">
                                Paid
                              </Badge>
                            )}
                            {isPartial && (
                              <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[10px] uppercase font-bold">
                                Partial
                              </Badge>
                            )}
                            {isCredit && (
                              <Badge variant="outline" className="border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10 text-[10px] uppercase font-bold">
                                Credit
                              </Badge>
                            )}
                            {isCancelled && (
                              <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                                Cancelled
                              </Badge>
                            )}
                            {isReturned && (
                              <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                                Returned
                              </Badge>
                            )}
                            {isPartiallyReturned && (
                              <Badge variant="outline" className="border-amber-500/30 text-amber-600 text-[10px] uppercase font-bold">
                                Part. Return
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <Link href={`/customer/bills/${bill.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5 text-xs font-semibold border-emerald-600/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                              >
                                View Bill
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Add / Edit Mobile Dialog */}
      <Dialog open={isMobileDialogOpen} onOpenChange={setIsMobileDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveMobile}>
            <DialogHeader>
              <DialogTitle>
                {customer?.mobile ? 'Update Mobile Number' : 'Add Mobile Number'}
              </DialogTitle>
              <DialogDescription>
                Enter your 10-digit mobile number to automatically link your bills and purchase history from Krushi OS stores.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="dialogMobile">Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dialogMobile"
                    type="tel"
                    placeholder="9876543210"
                    value={mobileInput}
                    onChange={(e) => setMobileInput(e.target.value)}
                    className="pl-9 font-mono"
                    disabled={isSavingMobile}
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Used for bill linking across Krushi OS stores. Not SMS-verified.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsMobileDialogOpen(false)}
                disabled={isSavingMobile}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                disabled={isSavingMobile}
              >
                {isSavingMobile ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save & Link Bills'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Notifications Dialog */}
      <Dialog open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-emerald-600" /> Notifications
            </DialogTitle>
            <DialogDescription>
              Updates regarding new bills, payments, and store notices.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1">
            {!data?.notifications || data.notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No notifications found.
              </div>
            ) : (
              data.notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 rounded-xl border text-xs space-y-1.5 transition-colors ${
                    n.is_read
                      ? 'bg-muted/20 border-border/60 opacity-80'
                      : 'bg-emerald-500/5 border-emerald-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-foreground">{n.title}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {n.created_at
                        ? new Date(n.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                          })
                        : ''}
                    </span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{n.message}</p>

                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                    <span className="text-muted-foreground text-[10px]">
                      Store: {n.shop_name || 'Krushi Kendra'}
                    </span>
                    {!n.is_read && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkNotificationRead(n.id)}
                        disabled={markingNotificationId === n.id}
                        className="h-6 px-2 text-[10px] text-emerald-600 hover:text-emerald-700"
                      >
                        {markingNotificationId === n.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <CheckCheck className="h-3 w-3 mr-1" /> Mark as read
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNotificationsOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
