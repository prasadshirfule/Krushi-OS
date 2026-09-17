import { ProductScanResult } from '@/lib/scanner/types';
import {
  validateSafePublicUrl,
  extractProductMetadataFromHtml,
  isBotChallengePage,
  KNOWN_MANUFACTURER_DOMAINS,
} from './product-enrichment.service';

export interface ResolveProductSourceParams {
  sourceUrl: string;
  gtin?: string;
  brand?: string;
  productName?: string;
}

/**
 * Validates if a candidate URL strictly belongs to the trusted manufacturer domain
 * or its approved subdomains. Rejects 3rd party, retail, marketplace, or blog hosts.
 */
export function isTrustedManufacturerHost(candidateUrl: string, baseDomain: string): boolean {
  const validation = validateSafePublicUrl(candidateUrl);
  if (!validation.isValid || !validation.parsedUrl) {
    return false;
  }

  const cleanCandidateHost = validation.parsedUrl.hostname.toLowerCase().replace(/^www\./, '');
  const cleanBaseHost = baseDomain.toLowerCase().replace(/^www\./, '');

  if (cleanCandidateHost === cleanBaseHost || cleanCandidateHost.endsWith('.' + cleanBaseHost)) {
    return true;
  }

  // Check known manufacturer domain mappings
  const known = KNOWN_MANUFACTURER_DOMAINS.find((d) => d.pattern.test(cleanBaseHost));
  if (known && known.pattern.test(cleanCandidateHost)) {
    return true;
  }

  return false;
}

/**
 * Generic Manufacturer Source Discovery and Resolution Service.
 * Safely discovers and parses official manufacturer-owned product sources
 * without relying on third-party proxies, Google scraping, or bypasses.
 */
export class ManufacturerSourceResolver {
  /**
   * Generates candidate official source paths on the manufacturer's own trusted domain.
   */
  static generateOfficialCandidates(params: ResolveProductSourceParams): string[] {
    const candidates: string[] = [];
    let parsed: URL;

    try {
      parsed = new URL(params.sourceUrl);
    } catch {
      return candidates;
    }

    const origin = parsed.origin;
    const hostname = parsed.hostname;

    // 1. Direct product category / product detail endpoints
    if (params.productName) {
      const slug = params.productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      candidates.push(`${origin}/product/crop-protection/${slug}`);
      candidates.push(`${origin}/products/${slug}`);
      candidates.push(`${origin}/product/${slug}`);
      candidates.push(`${origin}/crop-protection/${slug}`);
    }

    // 2. GTIN search on manufacturer-owned public search endpoints
    if (params.gtin) {
      candidates.push(`${origin}/search?search_api_fulltext=${encodeURIComponent(params.gtin)}`);
      candidates.push(`${origin}/products/search?q=${encodeURIComponent(params.gtin)}`);
      candidates.push(`${origin}/api/products/${encodeURIComponent(params.gtin)}`);
    }

    // 3. Known official sitemap / catalog paths
    candidates.push(`${origin}/sitemap.xml`);

    return Array.from(new Set(candidates));
  }

  /**
   * Attempts to discover and extract product metadata from official manufacturer sources.
   */
  static async resolveOfficialSource(params: ResolveProductSourceParams): Promise<Partial<ProductScanResult> | null> {
    console.log('[KRUSHI ENRICHMENT] MANUFACTURER DISCOVERY: Starting generic official source discovery');

    let baseDomain: string;
    try {
      const parsed = new URL(params.sourceUrl);
      baseDomain = parsed.hostname;
    } catch {
      return null;
    }

    const candidateUrls = this.generateOfficialCandidates(params);

    for (const candidateUrl of candidateUrls) {
      console.log('[KRUSHI ENRICHMENT] CANDIDATE:', candidateUrl);

      // Strict trusted-host check & SSRF check
      const isTrusted = isTrustedManufacturerHost(candidateUrl, baseDomain);
      console.log('[KRUSHI ENRICHMENT] TRUST CHECK:', isTrusted ? 'TRUSTED (Manufacturer Domain)' : 'REJECTED (Untrusted Host)');

      if (!isTrusted) {
        continue;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

        const response = await fetch(candidateUrl, {
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,application/ld+json;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-IN,en;q=0.9',
          },
          signal: controller.signal,
          redirect: 'manual',
        });

        clearTimeout(timeoutId);

        if (!response || !response.ok) {
          continue;
        }

        const html = await response.text();
        if (isBotChallengePage(html)) {
          continue;
        }

        const metadata = extractProductMetadataFromHtml(html, candidateUrl);
        if (metadata.productName || metadata.composition || metadata.category) {
          console.log('[KRUSHI ENRICHMENT] OFFICIAL SOURCE FOUND:', candidateUrl);
          console.log('[KRUSHI ENRICHMENT] PARSED FIELDS:', metadata.detectedFields);
          return metadata;
        }
      } catch (err: any) {
        // Continue checking other official candidates
      }
    }

    return null;
  }
}
