'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { ComponentProps } from 'react'
import { LanguageProvider } from '@/lib/i18n'

export function Providers({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider attribute='class' defaultTheme='dark' enableSystem {...props}>
      <LanguageProvider>
        {children}
      </LanguageProvider>
    </NextThemesProvider>
  )
}
