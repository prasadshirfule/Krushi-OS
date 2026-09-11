'use client';

import React from 'react';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, Check } from 'lucide-react';

interface LanguageSwitcherProps {
  variant?: 'header' | 'select' | 'compact';
  className?: string;
}

export function LanguageSwitcher({ variant = 'header', className = '' }: LanguageSwitcherProps) {
  const { language, setLanguage, languages } = useLanguage();

  const currentLang = languages.find((l) => l.code === language) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-9 gap-1.5 font-medium border-border/80 bg-background/80 hover:bg-accent text-xs sm:text-sm ${className}`}
          aria-label="Select Language"
        >
          <Globe className="h-4 w-4 text-primary" />
          <span className="font-semibold">{currentLang.nativeLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 p-1">
        {languages.map((item) => {
          const isSelected = item.code === language;
          return (
            <DropdownMenuItem
              key={item.code}
              onClick={() => setLanguage(item.code)}
              className={`flex items-center justify-between py-2 px-2.5 text-sm cursor-pointer rounded-md ${
                isSelected ? 'bg-primary/10 font-bold text-primary' : 'text-foreground'
              }`}
            >
              <span className="text-sm font-medium">{item.nativeLabel}</span>
              {isSelected && <Check className="h-4 w-4 text-primary ml-2 stroke-[2.5]" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
