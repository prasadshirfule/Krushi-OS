'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Package,
  Receipt,
  Scan,
  BarChart3,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';

interface NavItem {
  href: string;
  key: string;
  defaultLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  isCenter?: boolean;
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  // Navigation Items Layout:
  // 1. Sales (Sales history & invoices)
  // 2. Products (Product list & catalog)
  // 3. Billing (Primary Prominent Center Action)
  // 4. Reports (Analytics & reports)
  // 5. Credits (Credit / Udhār ledger)
  const navItems: NavItem[] = [
    {
      href: '/sales',
      key: 'sales',
      defaultLabel: 'Sales',
      icon: Receipt,
    },
    {
      href: '/products',
      key: 'products',
      defaultLabel: 'Products',
      icon: Package,
    },
    {
      href: '/billing',
      key: 'billing',
      defaultLabel: 'Billing',
      icon: Scan,
      isCenter: true,
    },
    {
      href: '/reports',
      key: 'reports',
      defaultLabel: 'Reports',
      icon: BarChart3,
    },
    {
      href: '/credit',
      key: 'credit',
      defaultLabel: 'Credits',
      icon: CreditCard,
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 sm:hidden border-t border-border/70 bg-background/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.5)] pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] pt-1 select-none"
    >
      <div className="grid grid-cols-5 items-end justify-items-center max-w-md mx-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
          const label = t(`nav.${item.key}`, item.defaultLabel);

          // ─── Center Billing Prominent Action ───
          if (item.isCenter) {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className="group relative -top-3 flex flex-col items-center justify-center focus-visible:outline-hidden"
              >
                {/* Elevated Circular Button */}
                <div
                  className={cn(
                    'relative h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 border-2',
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary-foreground/30 shadow-primary/40 ring-4 ring-primary/20 scale-105'
                      : 'bg-primary text-primary-foreground border-background shadow-primary/25 hover:scale-105'
                  )}
                >
                  <Icon className="h-6 w-6 stroke-[2.5] transition-transform group-hover:scale-110" />
                  {/* Subtle active glow indicator */}
                  {isActive && (
                    <span className="absolute -top-1 right-1 h-2.5 w-2.5 rounded-full bg-emerald-300 ring-2 ring-primary animate-pulse" />
                  )}
                </div>

                {/* Short Billing Label */}
                <span
                  className={cn(
                    'mt-1 text-[11px] font-black tracking-tight transition-colors',
                    isActive ? 'text-primary' : 'text-foreground font-bold'
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          }

          // ─── Standard Outer Navigation Tabs ───
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center w-full py-1.5 px-1 rounded-xl transition-all active:scale-95 focus-visible:outline-hidden',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div
                className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'bg-transparent text-muted-foreground group-hover:text-foreground'
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 transition-transform',
                    isActive && 'stroke-[2.5]'
                  )}
                />
              </div>

              <span
                className={cn(
                  'text-[10px] mt-0.5 tracking-tight truncate max-w-full font-medium transition-all',
                  isActive && 'font-bold text-primary'
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
