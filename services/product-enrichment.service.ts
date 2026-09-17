import { ProductScanResult } from '@/lib/scanner/types';
import { normalizeProductSize, isFormulationConcentration } from '@/lib/scanner/size-normalizer';
import { ManufacturerSourceResolver } from './manufacturer-resolver.service';

/**
 * SSRF Protection: Checks if a hostname or IP address belongs to private, loopback, or link-local ranges.
 */
export function isPrivateOrReservedHost(hostname: string): boolean {
  if (!hostname) return true;
  const cleanHost = hostname.toLowerCase().trim();

  // Block localhost, internal, local, etc.
  if (
    cleanHost === 'localhost' ||
    cleanHost.endsWith('.localhost') ||
    cleanHost.endsWith('.local') ||
    cleanHost.endsWith('.internal') ||
    cleanHost.endsWith('.lan') ||
    cleanHost.endsWith('.test') ||
    cleanHost.endsWith('.invalid')
  ) {
    return true;
  }

  // IPv4 Checks
  const ipv4Match = cleanHost.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = [
      parseInt(ipv4Match[1], 10),
      parseInt(ipv4Match[2], 10),
      parseInt(ipv4Match[3], 10),
      parseInt(ipv4Match[4], 10),
    ];

    if (octets.some((o) => o > 255)) return true;

    // 0.0.0.0/8
    if (octets[0] === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (octets[0] === 127) return true;
    // 10.0.0.0/8 (Private)
    if (octets[0] === 10) return true;
    // 172.16.0.0/12 (Private: 172.16.x.x - 172.31.x.x)
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (octets[0] === 192 && octets[1] === 168) return true;
    // 169.254.0.0/16 (Link-Local / AWS Metadata / Cloud metadata)
    if (octets[0] === 169 && octets[1] === 254) return true;
    // 224.0.0.0/4 (Multicast)
    if (octets[0] >= 224) return true;
  }

  // IPv6 Checks
  if (
    cleanHost === '::1' ||
    cleanHost === '0:0:0:0:0:0:0:1' ||
    cleanHost.startsWith('fe80:') ||
    cleanHost.startsWith('fc00:') ||
    cleanHost.startsWith('fd00:')
  ) {
    return true;
  }

  return false;
}

/**
 * Validates a target URL against SSRF rules.
 * Must be HTTPS and point to a public host.
 */
export function validateSafePublicUrl(rawUrl: string): { isValid: boolean; parsedUrl?: URL; error?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, error: 'URL is required' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'https:') {
    return { isValid: false, error: 'Only HTTPS URLs are permitted for product enrichment' };
  }

  if (isPrivateOrReservedHost(parsed.hostname)) {
    return { isValid: false, error: 'Private, internal, or loopback hosts are forbidden' };
  }

  // Reject non-standard ports commonly used for internal services
  if (parsed.port && parsed.port !== '443') {
    return { isValid: false, error: 'Non-standard HTTPS ports are forbidden' };
  }

  return { isValid: true, parsedUrl: parsed };
}

/**
 * Known agricultural manufacturer domains for reliable entity attribution.
 */
export const KNOWN_MANUFACTURER_DOMAINS: Array<{ pattern: RegExp; manufacturer: string; brand: string }> = [
  { pattern: /(?:www\.)?syngenta\.(?:co\.in|com|in)/i, manufacturer: 'Syngenta India Ltd', brand: 'Syngenta' },
  { pattern: /(?:www\.)?bayer\.(?:co\.in|com|in)/i, manufacturer: 'Bayer CropScience Ltd', brand: 'Bayer' },
  { pattern: /(?:www\.)?upl-ltd\.com|(?:www\.)?uplonline\.com/i, manufacturer: 'UPL Limited', brand: 'UPL' },
  { pattern: /(?:www\.)?dhanuka\.com/i, manufacturer: 'Dhanuka Agritech Ltd', brand: 'Dhanuka' },
  { pattern: /(?:www\.)?coromandel\.biz|(?:www\.)?coromandelinternational\.com/i, manufacturer: 'Coromandel International Ltd', brand: 'Gromor' },
  { pattern: /(?:www\.)?rallis\.(?:co\.in|com)/i, manufacturer: 'Rallis India Ltd (Tata Enterprise)', brand: 'Rallis' },
  { pattern: /(?:www\.)?indofil\.com/i, manufacturer: 'Indofil Industries Ltd', brand: 'Indofil' },
  { pattern: /(?:www\.)?iffco\.(?:in|coop)/i, manufacturer: 'IFFCO', brand: 'IFFCO' },
  { pattern: /(?:www\.)?adama\.com/i, manufacturer: 'ADAMA India Pvt Ltd', brand: 'ADAMA' },
  { pattern: /(?:www\.)?sumitomo-chem\.co\.in/i, manufacturer: 'Sumitomo Chemical India Ltd', brand: 'Sumitomo' },
  { pattern: /(?:www\.)?fmc\.(?:com|in)/i, manufacturer: 'FMC India Pvt Ltd', brand: 'FMC' },
  { pattern: /(?:www\.)?basf\.(?:com|in)/i, manufacturer: 'BASF India Ltd', brand: 'BASF' },
  { pattern: /(?:www\.)?corteva\.(?:com|in)/i, manufacturer: 'Corteva Agriscience', brand: 'Corteva' },
];

/**
 * Checks if raw HTML is a Cloudflare or Bot Challenge page rather than actual product content.
 */
export function isBotChallengePage(html: string): boolean {
  if (!html || typeof html !== 'string') return false;
  const lower = html.toLowerCase();
  return (
    lower.includes('just a moment...') ||
    lower.includes('cf-mitigated') ||
    lower.includes('attention required! | cloudflare') ||
    lower.includes('challenges.cloudflare.com') ||
    lower.includes('enable javascript and cookies to continue')
  );
}

/**
 * Normalizes multi-ingredient active formulations into standard KRUSHI OS format.
 * Examples:
 * - "5% w/w Emamectin benzoate + 40% w/w WG Lufenuron" -> "Emamectin benzoate 5% w/w + Lufenuron 40% w/w WG"
 * - "Emamectin benzoate 5% w/w + Lufenuron 40% w/w WG" -> "Emamectin benzoate 5% w/w + Lufenuron 40% w/w WG"
 */
export function normalizeComposition(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const cleaned = raw
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Split on '+', 'and', ',', or ';'
  const parts = cleaned.split(/\s*(?:\+|\band\b|;|,)\s*/i).map((p) => p.trim()).filter(Boolean);
  const normalizedParts: string[] = [];

  for (const part of parts) {
    // Percentage / concentration prefix: e.g. "5% w/w Emamectin benzoate"
    const prefixMatch = part.match(
      /^(\d+(?:\.\d+)?\s*%\s*(?:w\/w|w\/v|v\/v)?(?:\s*(?:WG|WP|EC|SC|SL|SP|FS|CS|GR|SG|OD|EW|ME|ZC|DF|WDG))?)\s+([A-Za-z0-9\s\-]+)$/i
    );
    if (prefixMatch) {
      const conc = prefixMatch[1].trim();
      const name = prefixMatch[2].trim();
      normalizedParts.push(`${name} ${conc}`);
      continue;
    }

    // Name followed by concentration: e.g. "Emamectin benzoate 5% w/w"
    const postfixMatch = part.match(
      /^([A-Za-z0-9\s\-]+)\s+(\d+(?:\.\d+)?\s*%\s*(?:w\/w|w\/v|v\/v)?(?:\s*(?:WG|WP|EC|SC|SL|SP|FS|CS|GR|SG|OD|EW|ME|ZC|DF|WDG))?)$/i
    );
    if (postfixMatch) {
      const name = postfixMatch[1].trim();
      const conc = postfixMatch[2].trim();
      normalizedParts.push(`${name} ${conc}`);
      continue;
    }

    normalizedParts.push(part);
  }

  return normalizedParts.length > 0 ? normalizedParts.join(' + ') : cleaned;
}

/**
 * Extracts a labeled value from unstructured or CMS/Drupal HTML layouts.
 */
export function extractLabeledValue(html: string, labels: string[]): string | undefined {
  if (!html || typeof html !== 'string') return undefined;

  for (const label of labels) {
    // 1. Direct label pattern: "Label: Value" or "Label - Value"
    const directRegex = new RegExp(`${label}\\s*[:–-]\\s*([^<\\n\\r]{2,200})`, 'i');
    const directMatch = html.match(directRegex);
    if (directMatch && directMatch[1].trim()) {
      return directMatch[1].trim();
    }

    // 2. Tag-separated pattern: <tag>Label</tag>\s*<tag>Value</tag>
    const tagRegex = new RegExp(`${label}\\s*<\\/[^>]+>\\s*<[^>]+>\\s*([^<\\n\\r]{2,200})`, 'i');
    const tagMatch = html.match(tagRegex);
    if (tagMatch && tagMatch[1].trim()) {
      return tagMatch[1].trim();
    }

    // 3. Nested/class attribute pattern: class="...label...">Label</div>...class="...item...">Value</div>
    const classRegex = new RegExp(
      `${label}[\\s\\S]{0,140}?<[^>]*class=["'][^"']*(?:item|value|content|desc)[^"']*["'][^>]*>\\s*([^<\\n\\r]{2,200})`,
      'i'
    );
    const classMatch = html.match(classRegex);
    if (classMatch && classMatch[1].trim()) {
      return classMatch[1].trim();
    }
  }

  return undefined;
}

/**
 * Extracts structured product metadata from manufacturer HTML pages (JSON-LD, Meta Tags, and HTML text).
 */
export function extractProductMetadataFromHtml(html: string, sourceUrl: string): Partial<ProductScanResult> {
  const result: Partial<ProductScanResult> = {
    sourceUrl,
    source: 'manufacturer_url',
    detectedFields: [],
    confidence: {},
    fieldSources: {},
  };

  const detectedFields: string[] = [];
  const confidence: Record<string, number> = {};
  const fieldSources: Record<string, 'manufacturer_url'> = {};

  // 1. Always evaluate known manufacturer domain for default entity identification
  try {
    const parsedUrl = new URL(sourceUrl);
    const domainMatch = KNOWN_MANUFACTURER_DOMAINS.find((d) => d.pattern.test(parsedUrl.hostname));
    if (domainMatch) {
      result.manufacturer = domainMatch.manufacturer;
      result.brand = domainMatch.brand;
      detectedFields.push('manufacturer', 'brand');
      confidence['manufacturer'] = 0.95;
      confidence['brand'] = 0.95;
      fieldSources['manufacturer'] = 'manufacturer_url';
      fieldSources['brand'] = 'manufacturer_url';
    }
  } catch {}

  // If no HTML or bot challenge page, return domain-level identification safely
  if (!html || typeof html !== 'string' || isBotChallengePage(html)) {
    result.detectedFields = Array.from(new Set(detectedFields));
    result.confidence = confidence;
    result.fieldSources = fieldSources;
    return result;
  }

  // 2. Extract JSON-LD (<script type="application/ld+json">...</script>)
  const jsonLdRegex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const jsonContent = JSON.parse(match[1].trim());
      const items = Array.isArray(jsonContent) ? jsonContent : [jsonContent];

      for (const item of items) {
        const type = item['@type'] || item['type'];
        if (type === 'Product' || type === 'IndividualProduct' || type === 'ItemPage') {
          if (item.name && typeof item.name === 'string') {
            result.productName = item.name.trim();
            detectedFields.push('productName');
            confidence['productName'] = 0.98;
            fieldSources['productName'] = 'manufacturer_url';
          }

          if (item.brand) {
            const brandName = typeof item.brand === 'object' ? item.brand.name : item.brand;
            if (typeof brandName === 'string' && brandName.trim()) {
              result.brand = brandName.trim();
              detectedFields.push('brand');
              confidence['brand'] = 0.95;
              fieldSources['brand'] = 'manufacturer_url';
            }
          }

          if (item.manufacturer) {
            const mfgName = typeof item.manufacturer === 'object' ? item.manufacturer.name : item.manufacturer;
            if (typeof mfgName === 'string' && mfgName.trim()) {
              result.manufacturer = mfgName.trim();
              detectedFields.push('manufacturer');
              confidence['manufacturer'] = 0.95;
              fieldSources['manufacturer'] = 'manufacturer_url';
            }
          }

          if (item.description && typeof item.description === 'string') {
            result.productDescription = item.description.trim();
            detectedFields.push('productDescription');
            confidence['productDescription'] = 0.9;
            fieldSources['productDescription'] = 'manufacturer_url';
          }

          if (item.gtin13 || item.gtin14 || item.gtin) {
            const g = (item.gtin13 || item.gtin14 || item.gtin).trim();
            result.gtin = g;
            detectedFields.push('gtin');
            confidence['gtin'] = 0.95;
            fieldSources['gtin'] = 'manufacturer_url';
          }

          if (item.category && typeof item.category === 'string') {
            result.category = item.category.trim();
            detectedFields.push('category');
            confidence['category'] = 0.9;
            fieldSources['category'] = 'manufacturer_url';
          }

          if (item.offers) {
            const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            if (offer && offer.price) {
              const p = parseFloat(offer.price);
              if (!isNaN(p) && p > 0) {
                result.mrp = p;
                detectedFields.push('mrp');
                confidence['mrp'] = 0.9;
                fieldSources['mrp'] = 'manufacturer_url';
              }
            }
          }
        }
      }
    } catch {
      // Ignore invalid JSON in individual blocks
    }
  }

  // 3. OpenGraph and Standard Meta Tags
  if (!result.productName) {
    const ogTitleMatch = html.match(/<meta\s+(?:property|name)=["'](?:og:title|twitter:title)["']\s+content=["']([^"']+)["']/i);
    if (ogTitleMatch) {
      const cleanTitle = ogTitleMatch[1].replace(/\|.*$/g, '').replace(/–.*$/g, '').trim();
      if (cleanTitle && cleanTitle.length < 120 && !isBotChallengePage(cleanTitle)) {
        result.productName = cleanTitle;
        detectedFields.push('productName');
        confidence['productName'] = 0.85;
        fieldSources['productName'] = 'manufacturer_url';
      }
    }
  }

  if (!result.productName) {
    const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleTagMatch) {
      const cleanTitle = titleTagMatch[1].replace(/\|.*$/g, '').replace(/–.*$/g, '').replace(/-.*$/g, '').trim();
      if (cleanTitle && cleanTitle.length < 120 && !isBotChallengePage(cleanTitle)) {
        result.productName = cleanTitle;
        detectedFields.push('productName');
        confidence['productName'] = 0.75;
        fieldSources['productName'] = 'manufacturer_url';
      }
    }
  }

  if (!result.brand) {
    const ogBrandMatch = html.match(/<meta\s+(?:property|name)=["'](?:product:brand|og:site_name)["']\s+content=["']([^"']+)["']/i);
    if (ogBrandMatch) {
      const brandVal = ogBrandMatch[1].trim();
      if (brandVal && brandVal.length < 60) {
        result.brand = brandVal;
        detectedFields.push('brand');
        confidence['brand'] = 0.8;
        fieldSources['brand'] = 'manufacturer_url';
      }
    }
  }

  // 4. Extract Registrant / Manufacturer from Text if not set
  const mfgText = extractLabeledValue(html, ['Registrant', 'Manufacturer', 'Marketed by', 'Manufactured by', 'Company']);
  if (mfgText && mfgText.length > 2 && mfgText.length < 100) {
    result.manufacturer = mfgText;
    detectedFields.push('manufacturer');
    confidence['manufacturer'] = 0.95;
    fieldSources['manufacturer'] = 'manufacturer_url';
  }

  // 5. Extract Composition / Active Ingredients from Text / Elements
  if (!result.composition) {
    const rawComp = extractLabeledValue(html, [
      'Composition',
      'Active Ingredient',
      'Active Ingredients',
      'Technical Name',
      'Contains',
      'Technical Content',
    ]);
    if (rawComp) {
      const normalizedComp = normalizeComposition(rawComp);
      if (normalizedComp && normalizedComp.length > 3 && normalizedComp.length < 250 && !isBotChallengePage(normalizedComp)) {
        result.composition = normalizedComp;
        detectedFields.push('composition');
        confidence['composition'] = 0.9;
        fieldSources['composition'] = 'manufacturer_url';
      }
    }
  }

  // 6. Extract Category from Text / Elements
  if (!result.category) {
    const rawCat = extractLabeledValue(html, ['Category', 'Product Type', 'Crop Protection', 'Segment']);
    if (rawCat) {
      const catText = rawCat.trim();
      if (
        ['Insecticide', 'Fungicide', 'Herbicide', 'Fertilizer', 'Seeds', 'Bio-stimulant', 'PGR', 'Plant Growth Regulator', 'Nematicide'].some(
          (c) => catText.toLowerCase().includes(c.toLowerCase())
        )
      ) {
        result.category = catText;
        detectedFields.push('category');
        confidence['category'] = 0.85;
        fieldSources['category'] = 'manufacturer_url';
      }
    }
  }

  // 7. Extract Pack Size Normalization (with multi-pack detection rules)
  if (!result.packSize) {
    const packText = extractLabeledValue(html, [
      'Pack sizes',
      'Pack Sizes',
      'Available Packs',
      'Packing',
      'Net Weight',
      'Net Quantity',
      'Net Qty',
      'Net Volume',
      'Packaging',
    ]);
    if (packText) {
      // Check if packText contains multiple discrete size options
      const matches = Array.from(
        packText.matchAll(
          /\b(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms?|g|gm|gms|grams?|mg|mgs|milligrams?|ml|mls|milliliters?|ltr|ltrs|litres?|liters?|l|pcs|tablets?|packs?|packets?|bags?|bottles?|cans?|drums?|boxes?)\b/gi
        )
      );
      const uniqueNormalized = new Set<string>();
      for (const m of matches) {
        const norm = normalizeProductSize(m[0]);
        if (norm && !isFormulationConcentration(m[0])) {
          uniqueNormalized.add(norm.packSize);
        }
      }

      // If exactly 1 pack size is listed, use it deterministically
      if (uniqueNormalized.size === 1) {
        const singleSize = Array.from(uniqueNormalized)[0];
        const parsedSize = normalizeProductSize(singleSize);
        if (parsedSize) {
          result.sizeValue = parsedSize.sizeValue;
          result.sizeUnit = parsedSize.sizeUnit;
          result.packSize = parsedSize.packSize;
          result.size = parsedSize.packSize;
          detectedFields.push('sizeValue', 'sizeUnit', 'packSize');
          confidence['packSize'] = 0.85;
          fieldSources['packSize'] = 'manufacturer_url';
        }
      }
      // If multiple distinct sizes are listed without GTIN association, leave packSize unresolved for manual/OCR verification
    } else {
      // Fallback scan of product title or description if only a single size is explicitly in title
      const titleScan = normalizeProductSize(result.productName || '');
      if (titleScan) {
        result.sizeValue = titleScan.sizeValue;
        result.sizeUnit = titleScan.sizeUnit;
        result.packSize = titleScan.packSize;
        result.size = titleScan.packSize;
        detectedFields.push('sizeValue', 'sizeUnit', 'packSize');
        confidence['packSize'] = 0.8;
        fieldSources['packSize'] = 'manufacturer_url';
      }
    }
  }

  // 8. Explicit MRP (only if explicitly stated)
  if (result.mrp === undefined) {
    const rawMrp = extractLabeledValue(html, ['MRP', 'Maximum Retail Price', 'Price']);
    if (rawMrp) {
      const parsedMrp = parseFloat(rawMrp.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsedMrp) && parsedMrp > 0) {
        result.mrp = parsedMrp;
        detectedFields.push('mrp');
        confidence['mrp'] = 0.85;
        fieldSources['mrp'] = 'manufacturer_url';
      }
    }
  }

  // 9. Explicit HSN (only if explicitly present)
  const hsnMatch = extractLabeledValue(html, ['HSN', 'HSN Code']);
  if (hsnMatch && /^\d{4,8}$/.test(hsnMatch.trim())) {
    result.hsnCode = hsnMatch.trim();
    detectedFields.push('hsnCode');
    confidence['hsnCode'] = 0.9;
    fieldSources['hsnCode'] = 'manufacturer_url';
  }

  // 10. Explicit GST (only if explicitly present)
  const gstMatch = extractLabeledValue(html, ['GST', 'GST Rate']);
  if (gstMatch) {
    const parsedGst = parseFloat(gstMatch.replace(/[^0-9.]/g, ''));
    if (!isNaN(parsedGst) && parsedGst >= 0 && parsedGst <= 28) {
      result.gstRate = parsedGst;
      detectedFields.push('gstRate');
      confidence['gstRate'] = 0.9;
      fieldSources['gstRate'] = 'manufacturer_url';
    }
  }

  result.detectedFields = Array.from(new Set(detectedFields));
  result.confidence = confidence;
  result.fieldSources = fieldSources;

  return result;
}

/**
 * Service to safely fetch product enrichment metadata from public manufacturer URLs.
 */
export class ProductEnrichmentService {
  /**
   * Fetches and parses structured product data from a manufacturer product URL.
   * Enforces strict timeout, size limits, redirect checks, and SSRF restrictions.
   */
  static async enrichFromUrl(targetUrl: string): Promise<Partial<ProductScanResult> | null> {
    console.log('[KRUSHI ENRICHMENT] START');
    console.log('[KRUSHI ENRICHMENT] URL:', targetUrl);
    console.log('[KRUSHI ENRICHMENT] DIRECT SOURCE:', targetUrl);

    const validation = validateSafePublicUrl(targetUrl);
    console.log('[KRUSHI ENRICHMENT] SSRF CHECK:', validation.isValid ? 'PASSED' : `FAILED (${validation.error})`);

    if (!validation.isValid || !validation.parsedUrl) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      let currentUrl = targetUrl;
      let redirectCount = 0;
      let response: Response | null = null;

      console.log('[KRUSHI ENRICHMENT] FETCH: Initiating HTTP request');

      // Handle up to 3 redirects manually to validate each target URL against SSRF
      while (redirectCount <= 3) {
        response = await fetch(currentUrl, {
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,application/ld+json;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
          },
          signal: controller.signal,
          redirect: 'manual',
        });

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (!location) break;

          const resolvedRedirect = new URL(location, currentUrl).toString();
          const redirectValidation = validateSafePublicUrl(resolvedRedirect);
          if (!redirectValidation.isValid) {
            clearTimeout(timeoutId);
            console.log('[KRUSHI ENRICHMENT] SSRF CHECK: Redirect target rejected');
            return null;
          }

          currentUrl = resolvedRedirect;
          redirectCount++;
          continue;
        }

        break;
      }

      clearTimeout(timeoutId);

      const status = response?.status || 0;
      console.log(`[KRUSHI ENRICHMENT] HTTP STATUS: ${status} ${response?.statusText || ''}`);

      if (!response || !response.ok) {
        console.log(`[KRUSHI ENRICHMENT] DIRECT SOURCE BLOCKED (Status: ${status})`);

        // SOURCE 2: Fallback to Official Manufacturer Source Discovery on the trusted domain
        const discovered = await ManufacturerSourceResolver.resolveOfficialSource({
          sourceUrl: targetUrl,
        });

        if (discovered && (discovered.productName || discovered.composition)) {
          console.log('[KRUSHI ENRICHMENT] OFFICIAL SOURCE FOUND via resolver');
          console.log('[KRUSHI ENRICHMENT] PARSED FIELDS:', discovered.detectedFields || []);
          return discovered;
        }

        // Domain-level fallback entity attribution
        console.log('[KRUSHI ENRICHMENT] PARSE: Non-200 response; extracting domain attribution');
        const fallbackResult = extractProductMetadataFromHtml('', targetUrl);
        console.log('[KRUSHI ENRICHMENT] FIELDS FOUND:', fallbackResult.detectedFields || []);
        console.log('[KRUSHI ENRICHMENT] RESULT:', fallbackResult);
        return fallbackResult;
      }

      // Limit response size to 512 KB
      const reader = response.body?.getReader();
      if (!reader) {
        const fallbackResult = extractProductMetadataFromHtml('', targetUrl);
        return fallbackResult;
      }

      let receivedBytes = 0;
      const chunks: Uint8Array[] = [];
      const MAX_BYTES = 512 * 1024;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          receivedBytes += value.length;
          chunks.push(value);
          if (receivedBytes >= MAX_BYTES) {
            reader.cancel();
            break;
          }
        }
      }

      const totalBuffer = new Uint8Array(receivedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        totalBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      const decoder = new TextDecoder('utf-8');
      const htmlContent = decoder.decode(totalBuffer);

      console.log(`[KRUSHI ENRICHMENT] BODY RECEIVED: ${receivedBytes} bytes`);

      if (isBotChallengePage(htmlContent)) {
        console.log('[KRUSHI ENRICHMENT] DIRECT SOURCE BLOCKED (Cloudflare Challenge)');
        const discovered = await ManufacturerSourceResolver.resolveOfficialSource({
          sourceUrl: targetUrl,
        });

        if (discovered && (discovered.productName || discovered.composition)) {
          console.log('[KRUSHI ENRICHMENT] OFFICIAL SOURCE FOUND via resolver');
          return discovered;
        }

        const fallbackResult = extractProductMetadataFromHtml('', targetUrl);
        return fallbackResult;
      }

      console.log('[KRUSHI ENRICHMENT] PARSE: Parsing HTML metadata');
      const parsedResult = extractProductMetadataFromHtml(htmlContent, targetUrl);
      console.log('[KRUSHI ENRICHMENT] FIELDS FOUND:', parsedResult.detectedFields || []);
      console.log('[KRUSHI ENRICHMENT] RESULT:', parsedResult);

      return parsedResult;
    } catch (err: any) {
      console.error('[KRUSHI ENRICHMENT] Error during fetch/parse:', err?.message || err);
      try {
        const fallbackResult = extractProductMetadataFromHtml('', targetUrl);
        console.log('[KRUSHI ENRICHMENT] RESULT (fallback):', fallbackResult);
        return fallbackResult;
      } catch {
        return null;
      }
    }
  }
}
