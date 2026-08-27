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

  // Detect route / searchParam changes to complete loading
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setIsNavigating(false);
  }, [pathname, searchParams]);

  // Intercept click on internal links
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;
      
      const href = target.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;

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

      // Debounce 180ms before showing indicator
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setIsNavigating(true);
      }, 180);
    };

    document.addEventListener('click', handleAnchorClick, true);
    return () => {
      document.removeEventListener('click', handleAnchorClick, true);
      if (timerRef.current) clearTimeout(timerRef.current);
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
