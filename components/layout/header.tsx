'use client'

import { Bell, Search, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MobileNav } from '@/components/layout/mobile-nav'
import { CommandMenu } from '@/components/layout/command-menu'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { useLanguage } from '@/lib/i18n'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getUnreadCountAction } from '@/actions/notifications'

export function Header({ user }: { user: any }) {
  const [openCommand, setOpenCommand] = useState(false)
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const { t } = useLanguage()
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let mounted = true
    async function loadUnreadCount() {
      try {
        const res = await getUnreadCountAction()
        if (mounted && res.success && typeof res.data === 'number') {
          setUnreadCount(res.data)
        }
      } catch (err) {
        // Ignore unread fetch errors gracefully
      }
    }
    loadUnreadCount()
    return () => {
      mounted = false
    }
  }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className='sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-4'>
      <MobileNav />
      
      <div className='flex w-full items-center gap-2 sm:gap-4 md:ml-auto md:gap-2 lg:gap-4'>
        <form className='ml-auto flex-1 sm:flex-initial' onSubmit={(e) => { e.preventDefault(); setOpenCommand(true); }}>
          <div className='relative'>
            <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
            <Button
              variant='outline'
              className='w-full sm:w-[260px] md:w-[300px] justify-start text-sm text-muted-foreground bg-background pl-8'
              onClick={() => setOpenCommand(true)}
            >
              {t('common.search', 'Search (Ctrl+K)')}
            </Button>
          </div>
        </form>

        <CommandMenu open={openCommand} onOpenChange={setOpenCommand} />

        <LanguageSwitcher />

        <div className="relative inline-flex items-center">
          <Button 
            variant='ghost' 
            size='icon' 
            onClick={() => router.push('/notifications')}
            title={t('nav.notifications', 'Notifications')}
          >
            <Bell className='h-5 w-5' />
            <span className='sr-only'>{t('nav.notifications', 'Toggle notifications')}</span>
          </Button>
          {unreadCount > 0 && (
            <Badge className='absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-bold bg-red-600 text-white border-2 border-background rounded-full pointer-events-none'>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' size='icon' className='rounded-full'>
              <Avatar className='h-8 w-8'>
                <AvatarFallback className='bg-primary/10 text-primary font-semibold'>
                  <User className='h-4 w-4' />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuLabel>{t('nav.myAccount', 'My Account')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>{t('nav.profile', 'Profile')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>{t('nav.settings', 'Settings')}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>{t('nav.logout', 'Logout')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
