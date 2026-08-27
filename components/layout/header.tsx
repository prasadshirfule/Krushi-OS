'use client'

import { Bell, Search, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MobileNav } from '@/components/layout/mobile-nav'
import { CommandMenu } from '@/components/layout/command-menu'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

export function Header({ user }: { user: any }) {
  const [openCommand, setOpenCommand] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/dashboard')
  }

  return (
    <header className='sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-4'>
      <MobileNav />
      
      <div className='flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4'>
        <form className='ml-auto flex-1 sm:flex-initial' onSubmit={(e) => { e.preventDefault(); setOpenCommand(true); }}>
          <div className='relative'>
            <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
            <Button
              variant='outline'
              className='w-full sm:w-[300px] justify-start text-sm text-muted-foreground bg-background pl-8'
              onClick={() => setOpenCommand(true)}
            >
              Search (Ctrl+K)
            </Button>
          </div>
        </form>

        <CommandMenu open={openCommand} onOpenChange={setOpenCommand} />

        <div className="relative inline-flex items-center">
          <Button 
            variant='ghost' 
            size='icon' 
            onClick={() => router.push('/notifications')}
            title="Notifications"
          >
            <Bell className='h-5 w-5' />
            <span className='sr-only'>Toggle notifications</span>
          </Button>
          <Badge className='absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-bold bg-red-600 text-white border-2 border-background rounded-full pointer-events-none'>
            3
          </Badge>
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
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
