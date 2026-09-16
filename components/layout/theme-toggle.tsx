'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Moon, Sun, Laptop, Check } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`h-9 w-9 text-muted-foreground ${className}`}
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-9 w-9 text-muted-foreground hover:text-foreground relative ${className}`}
          title={t('settings.theme', 'Theme')}
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0 text-amber-500" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100 text-blue-400" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 p-1">
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className={`flex items-center justify-between py-2 px-2.5 text-sm cursor-pointer rounded-md ${
            theme === 'system' ? 'bg-primary/10 font-bold text-primary' : 'text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Laptop className="h-4 w-4 text-muted-foreground" />
            <span>Default</span>
          </div>
          {theme === 'system' && <Check className="h-4 w-4 text-primary stroke-[2.5]" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className={`flex items-center justify-between py-2 px-2.5 text-sm cursor-pointer rounded-md ${
            theme === 'light' ? 'bg-primary/10 font-bold text-primary' : 'text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-500" />
            <span>Light</span>
          </div>
          {theme === 'light' && <Check className="h-4 w-4 text-primary stroke-[2.5]" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className={`flex items-center justify-between py-2 px-2.5 text-sm cursor-pointer rounded-md ${
            theme === 'dark' ? 'bg-primary/10 font-bold text-primary' : 'text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-blue-400" />
            <span>Dark</span>
          </div>
          {theme === 'dark' && <Check className="h-4 w-4 text-primary stroke-[2.5]" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
