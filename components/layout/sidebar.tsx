'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, ShoppingCart, Receipt, Package, Grid3X3, Warehouse,
  TruckIcon, Users, Building2, CreditCard, Wallet, IndianRupee,
  BarChart3, UserCog, Bell, Settings 
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/billing', label: 'Billing / POS', icon: ShoppingCart },
  { href: '/sales', label: 'Sales', icon: Receipt },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/categories', label: 'Categories', icon: Grid3X3 },
  { href: '/inventory', label: 'Inventory', icon: Warehouse },
  { href: '/purchases', label: 'Purchases', icon: TruckIcon },
  { href: '/customers', label: 'Customers / Farmers', icon: Users },
  { href: '/suppliers', label: 'Suppliers', icon: Building2 },
  { href: '/credit', label: 'Credit / Udhar', icon: CreditCard },
  { href: '/payments', label: 'Payments', icon: Wallet },
  { href: '/expenses', label: 'Expenses', icon: IndianRupee },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/employees', label: 'Employees', icon: UserCog },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

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
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                  isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                )}
              >
                <Icon className='h-4 w-4' />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
