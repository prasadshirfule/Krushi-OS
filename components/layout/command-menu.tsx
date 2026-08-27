'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Package, Receipt, Users, Building2 } from 'lucide-react'

export function CommandMenu({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const router = useRouter()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(true)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [onOpenChange])

  const runCommand = React.useCallback((command: () => unknown) => {
    onOpenChange(false)
    command()
  }, [onOpenChange])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder='Type a command or search...' />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading='Quick Links'>
          <CommandItem onSelect={() => runCommand(() => router.push('/billing'))}>
            <Receipt className='mr-2 h-4 w-4' />
            <span>New Bill / POS</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/products/new'))}>
            <Package className='mr-2 h-4 w-4' />
            <span>Add Product</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/customers/new'))}>
            <Users className='mr-2 h-4 w-4' />
            <span>Add Customer</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/purchases/new'))}>
            <Building2 className='mr-2 h-4 w-4' />
            <span>Add Purchase</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
