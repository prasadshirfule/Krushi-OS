'use client';

import { useEffect, useState, useRef } from 'react';
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
};

export function GlobalNavigationIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [isNavigating, setIsNavigating] = useState(false);
  const [indicatorText, setIndicatorText] = useState('Rendering...');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Detect route / searchParam changes to complete loading
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    setIsNavigating(false);
  }, [pathname, searchParams]);

  // Non-blocking, passive click observer for internal links
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      // Ignore if event was already prevented or non-standard click (modifier keys, right click, etc.)
      if (
        e.defaultPrevented ||
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

      // Ignore external, download, or blank target links
      if (target.target && target.target !== '_self') return;
      if (target.hasAttribute('download')) return;
      
      const href = target.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || href.startsWith('tel:')) return;

      const targetPath = href.split('?')[0];
      if (targetPath === pathname) return; // Same page click

      // Determine label
      let label = 'Rendering...';
      for (const [route, routeLabel] of Object.entries(ROUTE_LABELS)) {
        if (targetPath === route || targetPath.startsWith(`${route}/`)) {
          label = routeLabel;
          break;
        }
      }
      
      setIndicatorText(label);

      // Debounce 150ms before showing indicator
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setIsNavigating(true);

        // Safety fallback timer: guarantee auto-dismissal after 3.0s
        if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = setTimeout(() => {
          setIsNavigating(false);
        }, 3000);
      }, 150);
    };

    // Use passive bubbling listener (false) to never intercept or block Next.js router
    document.addEventListener('click', handleAnchorClick, false);
    return () => {
      document.removeEventListener('click', handleAnchorClick, false);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, [pathname]);

  if (!isNavigating) return null;

  return (
    <div 
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full bg-slate-900/90 text-white px-4 py-2 text-xs font-semibold shadow-xl border border-slate-700/60 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin text-green-400" />
      <span>{indicatorText}</span>
    </div>
  );
}
