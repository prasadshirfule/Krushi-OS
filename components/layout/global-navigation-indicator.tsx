'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Opening Dashboard...',
  '/billing': 'Opening Billing POS...',
  '/sales': 'Loading Sales...',
  '/products': 'Loading Products...',
  '/categories': 'Loading Categories...',
  '/inventory': 'Loading Inventory...',
  '/purchases': 'Loading Purchases...',
  '/customers': 'Loading Customers...',
  '/suppliers': 'Loading Suppliers...',
  '/credit': 'Loading Credit Ledger...',
  '/payments': 'Loading Payments Log...',
  '/expenses': 'Loading Expenses...',
  '/reports': 'Loading Reports...',
  '/employees': 'Loading Employees...',
  '/notifications': 'Loading Notifications...',
  '/settings': 'Loading Settings...',
  '/audit': 'Loading Audit Trail...',
  '/shop-details': 'Loading Shop Details...',
};

function getRouteLabel(targetPath: string): string {
  for (const [route, label] of Object.entries(ROUTE_LABELS)) {
    if (targetPath === route || targetPath.startsWith(`${route}/`)) {
      return label;
    }
  }
  const segment = targetPath.split('/')[1] || 'Page';
  const capitalized = segment.charAt(0).toUpperCase() + segment.slice(1);
  return `Loading ${capitalized}...`;
}

export function GlobalNavigationIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [isNavigating, setIsNavigating] = useState(false);
  const [indicatorText, setIndicatorText] = useState('Loading...');
  const safetyTimerRef = useRef<NodeJS.Timeout | null>(null);

  const stopNavigating = useCallback(() => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    setIsNavigating(false);
  }, []);

  // Dismiss immediately when route or search parameters change (navigation completed)
  useEffect(() => {
    stopNavigating();
  }, [pathname, searchParams, stopNavigating]);

  // Capture-phase non-blocking click observer for internal links
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      // Ignore non-primary clicks (middle click, right click) or modifier keys (Ctrl+click to open new tab)
      if (
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.shiftKey
      ) {
        return;
      }

      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      // Ignore external, download, javascript, or blank target links
      if (target.target && target.target !== '_self') return;
      if (target.hasAttribute('download')) return;
      
      const href = target.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;

      const targetPath = href.split('?')[0];
      if (targetPath === pathname) return; // Ignore same-page click

      // Immediately determine destination label and show indicator
      const label = getRouteLabel(targetPath);
      setIndicatorText(label);
      setIsNavigating(true);

      // Reset and start safety fallback timer (auto-dismiss after 4.5s maximum if navigation stalls)
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = setTimeout(() => {
        setIsNavigating(false);
      }, 4500);
    };

    // Listen for programmatic navigation start events
    const handleCustomNavStart = (e: Event) => {
      const customEvent = e as CustomEvent<{ path?: string; label?: string }>;
      const label = customEvent.detail?.label || (customEvent.detail?.path ? getRouteLabel(customEvent.detail.path) : 'Loading...');
      setIndicatorText(label);
      setIsNavigating(true);

      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = setTimeout(() => {
        setIsNavigating(false);
      }, 4500);
    };

    // Use capture phase (true) so the click is observed BEFORE Next.js Link handles SPA navigation
    document.addEventListener('click', handleAnchorClick, true);
    window.addEventListener('krushi:nav-start', handleCustomNavStart);

    return () => {
      document.removeEventListener('click', handleAnchorClick, true);
      window.removeEventListener('krushi:nav-start', handleCustomNavStart);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, [pathname]);

  if (!isNavigating) return null;

  return (
    <div 
      className="fixed bottom-5 right-5 z-[9999] flex items-center gap-3 rounded-xl bg-slate-900/95 text-white px-4 py-2.5 text-xs font-semibold shadow-2xl border border-slate-700/80 backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-150 pointer-events-none select-none tracking-wide"
      role="status"
      aria-live="polite"
    >
      <div className="relative flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-400 shrink-0" />
        <span className="absolute h-2 w-2 rounded-full bg-emerald-400/40 animate-ping" />
      </div>
      <span className="font-medium text-[13px]">{indicatorText}</span>
    </div>
  );
}


