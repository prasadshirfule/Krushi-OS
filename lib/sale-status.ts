/**
 * Shared sale lifecycle helpers for Sales History / Sale Detail UI.
 * Prefers db_status (raw DB value) when present, then falls back to display status.
 * Does not invent business rules — only maps existing statuses for action visibility.
 */

export type SaleLifecycle =
  | 'completed'
  | 'partially_returned'
  | 'returned'
  | 'cancelled';

function normalizeStatusToken(value: unknown): string {
  return (value ?? '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
}

export function resolveSaleLifecycle(saleOrStatus: any): SaleLifecycle {
  const raw = normalizeStatusToken(
    typeof saleOrStatus === 'string'
      ? saleOrStatus
      : saleOrStatus?.db_status || saleOrStatus?.status
  );

  if (raw === 'cancelled' || raw === 'cancel') return 'cancelled';
  if (raw === 'returned' || raw === 'fully_returned') return 'returned';
  if (raw === 'partially_returned') return 'partially_returned';
  return 'completed';
}

export function getSaleActionAvailability(saleOrStatus: any) {
  const lifecycle = resolveSaleLifecycle(saleOrStatus);
  const isCancelled = lifecycle === 'cancelled';
  const isFullyReturned = lifecycle === 'returned';
  const isPartiallyReturned = lifecycle === 'partially_returned';
  const isCompleted = lifecycle === 'completed';

  return {
    lifecycle,
    isCancelled,
    isFullyReturned,
    isPartiallyReturned,
    isCompleted,
    displayStatus: isCancelled
      ? 'CANCELLED'
      : isFullyReturned
        ? 'FULLY RETURNED'
        : isPartiallyReturned
          ? 'PARTIALLY RETURNED'
          : 'COMPLETED',
    // Backend allows cancel/return for completed and partially_returned only
    canReturn: (isCompleted || isPartiallyReturned) && !isCancelled && !isFullyReturned,
    canCancel: (isCompleted || isPartiallyReturned) && !isCancelled && !isFullyReturned,
  };
}

export function formatSaleLifecycleLabel(lifecycle: SaleLifecycle): string {
  switch (lifecycle) {
    case 'cancelled':
      return 'Cancelled';
    case 'returned':
      return 'Returned';
    case 'partially_returned':
      return 'Partially Returned';
    default:
      return 'Completed';
  }
}
