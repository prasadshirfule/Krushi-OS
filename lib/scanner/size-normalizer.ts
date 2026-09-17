/**
 * Agricultural Pack Size & Unit Normalizer
 * Normalizes pack sizes (e.g. "60 g", "1 kg", "500 ml", "1000 tablets")
 * while strictly ignoring active ingredient formulation concentrations (e.g. "5% w/w", "40% WG", "250 g/L").
 */

export interface NormalizedSize {
  sizeValue: number;
  sizeUnit: string;
  packSize: string;
}

// Known formulation suffixes and concentration patterns that MUST NEVER be treated as pack size
const FORMULATION_PATTERNS = [
  /%\s*(w\/w|w\/v|v\/v)/i,
  /%\s*(wg|wp|ec|sc|sl|sp|fs|cs|gr|sg|od|ew|me|zc|df|wdg|ws|as|ulv|fl)\b/i,
  /\b\d+(?:\.\d+)?\s*%\b/i,
  /\b\d+(?:\.\d+)?\s*(?:g|mg|gm)\s*\/\s*(?:l|ltr|litre|kg|g)\b/i, // e.g. 250 g/L or 500 g/kg
];

/**
 * Checks if a string represents an active ingredient concentration or formulation (e.g. "5% w/w", "40% WG", "250 g/L").
 */
export function isFormulationConcentration(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();
  return FORMULATION_PATTERNS.some((pattern) => pattern.test(trimmed));
}

// Common agricultural units mapping
const UNIT_MAP: Record<string, string> = {
  g: 'g',
  gm: 'g',
  gms: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kgs: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  mg: 'mg',
  ml: 'ml',
  mls: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  l: 'L',
  ltr: 'L',
  liter: 'L',
  litre: 'L',
  litres: 'L',
  q: 'q',
  quintal: 'q',
  tonne: 'tonne',
  tonnes: 'tonne',
  t: 'tonne',
  pc: 'pcs',
  pcs: 'pcs',
  piece: 'pcs',
  pieces: 'pcs',
  nos: 'pcs',
  pack: 'pack',
  packs: 'pack',
  packet: 'pack',
  packets: 'pack',
  tablet: 'tablets',
  tablets: 'tablets',
  bag: 'bags',
  bags: 'bags',
  bottle: 'bottles',
  bottles: 'bottles',
  can: 'cans',
  cans: 'cans',
  drum: 'drums',
  drums: 'drums',
  box: 'boxes',
  boxes: 'boxes',
};

/**
 * Normalizes raw size strings into structured sizeValue, sizeUnit, and clean packSize.
 *
 * Examples:
 * - "60 g" -> { sizeValue: 60, sizeUnit: "g", packSize: "60 g" }
 * - "1 KG" -> { sizeValue: 1, sizeUnit: "kg", packSize: "1 kg" }
 * - "500 ML" -> { sizeValue: 500, sizeUnit: "ml", packSize: "500 ml" }
 * - "1000 tablets" -> { sizeValue: 1000, sizeUnit: "tablets", packSize: "1000 tablets" }
 * - "1 pack" -> { sizeValue: 1, sizeUnit: "pack", packSize: "1 pack" }
 */
export function normalizeProductSize(rawSize: string | null | undefined): NormalizedSize | null {
  if (!rawSize || typeof rawSize !== 'string') return null;
  const trimmed = rawSize.trim();
  if (!trimmed) return null;

  // Filter out pure formulation percentages
  if (isFormulationConcentration(trimmed)) {
    return null;
  }

  // Regex matching: (number) (unit)
  // e.g. "60 g", "1.5 kg", "500ml", "1000 tablets", "Net Qty: 60g", "Pack Size: 10 kg"
  const cleanInput = trimmed.replace(/^(?:net\s*(?:qty|quantity|wt|weight|vol|volume|content)|pack\s*size)\s*[:=-]?\s*/i, '').trim();

  const regex = /^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/i;
  const match = cleanInput.match(regex);

  if (match) {
    const val = parseFloat(match[1]);
    const rawUnit = match[2].toLowerCase();

    if (isNaN(val) || val <= 0) return null;

    // Check if unit is in known unit map
    const mappedUnit = UNIT_MAP[rawUnit];
    if (mappedUnit) {
      return {
        sizeValue: val,
        sizeUnit: mappedUnit,
        packSize: `${val} ${mappedUnit}`,
      };
    }
  }

  // If input contains multiple words, attempt to find a valid size token inside (excluding formulation tokens)
  const tokenMatch = cleanInput.match(/\b(\d+(?:\.\d+)?)\s*(kg|g|gm|gram|grams|mg|ml|ltr|litre|liter|l|pcs|tablets?|packs?|bags?|bottles?)\b/i);
  if (tokenMatch) {
    const val = parseFloat(tokenMatch[1]);
    const rawUnit = tokenMatch[2].toLowerCase();
    const mappedUnit = UNIT_MAP[rawUnit];
    if (mappedUnit && !isNaN(val) && val > 0) {
      return {
        sizeValue: val,
        sizeUnit: mappedUnit,
        packSize: `${val} ${mappedUnit}`,
      };
    }
  }

  return null;
}
