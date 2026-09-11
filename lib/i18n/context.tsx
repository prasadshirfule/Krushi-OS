'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Language, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './types';
import { en } from './translations/en';
import { mr } from './translations/mr';
import { hi } from './translations/hi';
import { createClient } from '@/lib/supabase/client';

const translations: Record<Language, any> = {
  en,
  mr,
  hi,
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, fallback?: string) => string;
  languages: typeof SUPPORTED_LANGUAGES;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const COOKIE_NAME = 'krushi_language';
const STORAGE_KEY = 'krushi_language';

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;

  try {
    // 1. Check cookie
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, val] = cookie.trim().split('=');
      if (name === COOKIE_NAME && (val === 'en' || val === 'mr' || val === 'hi')) {
        return val as Language;
      }
    }

    // 2. Check localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'mr' || saved === 'hi') {
      return saved as Language;
    }
  } catch (e) {
    console.warn('Could not read initial language preference:', e);
  }

  return DEFAULT_LANGUAGE;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initLang = getInitialLanguage();
    setLanguageState(initLang);
    setIsInitialized(true);

    // Also check Supabase authenticated user metadata if available
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const userLang = user?.user_metadata?.preferred_language;
      if (userLang === 'en' || userLang === 'mr' || userLang === 'hi') {
        setLanguageState(userLang);
        try {
          localStorage.setItem(STORAGE_KEY, userLang);
          document.cookie = `${COOKIE_NAME}=${userLang}; path=/; max-age=31536000; SameSite=Lax`;
        } catch {}
      }
    }).catch(() => {});

    const handleExternalChange = (e: any) => {
      if (e.detail && (e.detail === 'en' || e.detail === 'mr' || e.detail === 'hi')) {
        setLanguageState(e.detail);
      }
    };

    window.addEventListener('krushi-language-changed', handleExternalChange);
    return () => {
      window.removeEventListener('krushi-language-changed', handleExternalChange);
    };
  }, []);

  const setLanguage = useCallback((newLang: Language) => {
    if (newLang !== 'en' && newLang !== 'mr' && newLang !== 'hi') return;
    setLanguageState(newLang);

    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.cookie = `${COOKIE_NAME}=${newLang}; path=/; max-age=31536000; SameSite=Lax`;
    } catch (e) {
      console.warn('Could not write language to localStorage/cookies:', e);
    }

    // Persist to user profile metadata if authenticated
    try {
      const supabase = createClient();
      supabase.auth.updateUser({
        data: { preferred_language: newLang }
      }).catch(() => {});
    } catch {}

    window.dispatchEvent(new CustomEvent('krushi-language-changed', { detail: newLang }));
  }, []);

  const t = useCallback((path: string, fallback?: string): string => {
    if (!path) return fallback || '';
    const parts = path.split('.');

    // 1. Look up in active language
    let current: any = translations[language];
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        current = undefined;
        break;
      }
    }

    if (typeof current === 'string') return current;

    // 2. Fallback to English
    if (language !== 'en') {
      let enCurrent: any = translations.en;
      for (const part of parts) {
        if (enCurrent && typeof enCurrent === 'object' && part in enCurrent) {
          enCurrent = enCurrent[part];
        } else {
          enCurrent = undefined;
          break;
        }
      }
      if (typeof enCurrent === 'string') return enCurrent;
    }

    return fallback !== undefined ? fallback : path;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages: SUPPORTED_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      language: DEFAULT_LANGUAGE,
      setLanguage: () => {},
      t: (path: string, fallback?: string) => fallback || path,
      languages: SUPPORTED_LANGUAGES,
    };
  }
  return context;
}
