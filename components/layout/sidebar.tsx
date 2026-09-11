'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, ShoppingCart, Receipt, Package, Grid3X3, Warehouse,
  TruckIcon, Users, Building2, CreditCard, Wallet, IndianRupee,
  BarChart3, UserCog, Bell, Settings 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/lib/i18n'

const navItemConfigs = [
  { href: '/dashboard', key: 'dashboard', defaultLabel: 'Dashboard', icon: LayoutDashboard },
  { href: '/billing', key: 'billing', defaultLabel: 'Billing / POS', icon: ShoppingCart },
  { href: '/sales', key: 'sales', defaultLabel: 'Sales', icon: Receipt },
  { href: '/products', key: 'products', defaultLabel: 'Products', icon: Package },
  { href: '/categories', key: 'categories', defaultLabel: 'Categories', icon: Grid3X3 },
  { href: '/inventory', key: 'inventory', defaultLabel: 'Inventory', icon: Warehouse },
  { href: '/purchases', key: 'purchases', defaultLabel: 'Purchases', icon: TruckIcon },
  { href: '/customers', key: 'customers', defaultLabel: 'Customers / Farmers', icon: Users },
  { href: '/suppliers', key: 'suppliers', defaultLabel: 'Suppliers', icon: Building2 },
  { href: '/credit', key: 'credit', defaultLabel: 'Credit / Udhar', icon: CreditCard },
  { href: '/payments', key: 'payments', defaultLabel: 'Payments', icon: Wallet },
  { href: '/expenses', key: 'expenses', defaultLabel: 'Expenses', icon: IndianRupee },
  { href: '/reports', key: 'reports', defaultLabel: 'Reports', icon: BarChart3 },
  { href: '/employees', key: 'employees', defaultLabel: 'Employees', icon: UserCog },
  { href: '/notifications', key: 'notifications', defaultLabel: 'Notifications', icon: Bell },
  { href: '/settings', key: 'settings', defaultLabel: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { t } = useLanguage()

  return (
    <aside className='fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-background sm:flex'>
      <div className='flex h-14 items-center border-b px-4 lg:h-[60px]'>
        <Link href='/dashboard' className='flex items-center gap-2 font-semibold text-primary'>
          <span className='text-xl'>🌾</span>
          <span className='text-xl font-bold tracking-tight'>KRUSHI OS</span>
        </Link>
      </div>
      <div className='flex-1 overflow-auto py-2'>
        <nav className='grid items-start px-2 text-sm font-medium'>
          {navItemConfigs.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const label = t(`nav.${item.key}`, item.defaultLabel)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                  isActive ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted'
                )}
              >
                <Icon className='h-4 w-4 shrink-0' />
                <span className="truncate">{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
