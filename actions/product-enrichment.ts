'use server';

import { ProductEnrichmentService } from '@/services/product-enrichment.service';
import { ProductScanResult } from '@/lib/scanner/types';

/**
 * Server Action: Safely enriches product metadata from a trusted manufacturer URL.
 * Enforces SSRF protection, strict timeouts, and HTTPS restrictions on the server.
 */
export async function enrichProductFromUrlAction(
  targetUrl: string
): Promise<{ success: boolean; data?: Partial<ProductScanResult> | null; error?: string }> {
  try {
    console.log('[SERVER ACTION] enrichProductFromUrlAction invoked with targetUrl:', targetUrl);
    if (!targetUrl || typeof targetUrl !== 'string') {
      return { success: false, error: 'Target URL is required' };
    }

    const enriched = await ProductEnrichmentService.enrichFromUrl(targetUrl);
    console.log('[SERVER ACTION] ProductEnrichmentService result:', enriched);
    if (!enriched) {
      return { success: false, error: 'Product enrichment metadata unavailable' };
    }

    return { success: true, data: enriched };
  } catch (err: any) {
    console.error('[SERVER ACTION] enrichProductFromUrlAction error:', err);
    return { success: false, error: err?.message || 'Failed to enrich product from URL' };
  }
}
