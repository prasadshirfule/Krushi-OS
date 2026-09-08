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
      if (targetPath === pathname) return; // Ignore same-page click

      // Determine human-readable label
      let label = 'Loading...';
      for (const [route, routeLabel] of Object.entries(ROUTE_LABELS)) {
        if (targetPath === route || targetPath.startsWith(`${route}/`)) {
          label = routeLabel;
          break;
        }
      }
      
      setIndicatorText(label);
      setIsNavigating(true);

      // Reset and start safety fallback timer (auto-dismiss after 4s maximum if navigation stalls)
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = setTimeout(() => {
        setIsNavigating(false);
      }, 4000);
    };

    // Listen for programmatic navigation start events
    const handleCustomNavStart = (e: Event) => {
      const customEvent = e as CustomEvent<{ label?: string }>;
      if (customEvent.detail?.label) {
        setIndicatorText(customEvent.detail.label);
      } else {
        setIndicatorText('Loading...');
      }
      setIsNavigating(true);

      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = setTimeout(() => {
        setIsNavigating(false);
      }, 4000);
    };

    // Use passive bubbling listener (false) to never intercept, block, or delay Next.js navigation
    document.addEventListener('click', handleAnchorClick, false);
    window.addEventListener('krushi:nav-start', handleCustomNavStart);

    return () => {
      document.removeEventListener('click', handleAnchorClick, false);
      window.removeEventListener('krushi:nav-start', handleCustomNavStart);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, [pathname]);

  if (!isNavigating) return null;

  return (
    <>
      <style>{`
        @keyframes navProgressAnimation {
          0% { transform: translateX(-100%) scaleX(0.2); }
          50% { transform: translateX(30%) scaleX(0.7); }
          100% { transform: translateX(110%) scaleX(0.3); }
        }
      `}</style>

      {/* Top Instant Gradient Progress Bar */}
      <div 
        className="fixed top-0 left-0 right-0 z-50 h-[3px] pointer-events-none bg-emerald-500/20 overflow-hidden shadow-xs"
        aria-hidden="true"
      >
        <div 
          className="h-full w-full bg-gradient-to-r from-emerald-500 via-green-400 to-teal-400 shadow-sm shadow-emerald-500/50"
          style={{
            animation: 'navProgressAnimation 1.4s ease-in-out infinite',
            transformOrigin: '0% 50%',
          }}
        />
      </div>

      {/* Bottom Floating Status Badge */}
      <div 
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-full bg-slate-900/95 text-white px-4 py-2 text-xs font-semibold shadow-2xl border border-slate-700/70 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none select-none"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-green-400 shrink-0" />
        <span>{indicatorText}</span>
      </div>
    </>
  );
}

