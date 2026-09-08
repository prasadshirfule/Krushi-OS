'use client'

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
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

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant='outline' size='icon' className='shrink-0 sm:hidden'>
          <Menu className='h-5 w-5' />
          <span className='sr-only'>Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side='left' className='w-72 p-0 flex flex-col h-full max-h-[100dvh] overflow-hidden gap-0'>
        <div className='flex h-14 items-center border-b px-4 shrink-0'>
          <Link href='/dashboard' className='flex items-center gap-2 font-semibold text-primary' onClick={() => setOpen(false)}>
            <span className='text-xl'>🌾</span>
            <span className='text-xl font-bold tracking-tight'>KRUSHI OS</span>
          </Link>
        </div>
        <div className='flex-1 min-h-0 overflow-y-auto overscroll-contain py-2 px-2'>
          <nav className='grid items-start gap-1 text-sm font-medium pb-10'>
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                    isActive ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted'
                  )}
                >
                  <Icon className='h-4 w-4 shrink-0' />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  )
}
