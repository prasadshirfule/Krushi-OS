import { BillingCartItem } from '../types/sales';

export function calculateGST(amount: number, gstRate: number) {
  const totalTax = (amount * (gstRate || 0)) / 100;
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;
  const igst = totalTax;
  const totalWithTax = amount + totalTax;

  return { cgst, sgst, igst, totalTax, totalWithTax };
}

export function calculateItemTotal(quantity: number, rate: number, discount: number, gstRate: number, isTaxInclusive = true) {
  const q = quantity || 0;
  const r = rate || 0;
  const d = discount || 0;
  const g = gstRate || 0;

  const grossAmount = q * r;
  const discountAmount = (grossAmount * d) / 100;
  const netAmount = grossAmount - discountAmount;

  if (isTaxInclusive && g > 0) {
    const taxableAmount = Math.round((netAmount / (1 + g / 100)) * 100) / 100;
    const totalTax = Math.round((netAmount - taxableAmount) * 100) / 100;
    const cgst = Math.round((totalTax / 2) * 100) / 100;
    const sgst = Math.round((totalTax - cgst) * 100) / 100;

    return {
      subtotal: grossAmount,
      discountAmount,
      taxableAmount,
      cgst,
      sgst,
      totalTax,
      total: netAmount,
    };
  } else {
    const taxableAmount = netAmount;
    const { cgst, sgst, totalTax } = calculateGST(taxableAmount, g);
    const total = taxableAmount + totalTax;

    return {
      subtotal: grossAmount,
      discountAmount,
      taxableAmount,
      cgst,
      sgst,
      totalTax,
      total,
    };
  }
}

export function roundOff(amount: number) {
  const rounded = Math.round(amount || 0);
  const roundOffAmount = rounded - (amount || 0);
  return { rounded, roundOff: roundOffAmount };
}

export function calculateBillTotal(items: BillingCartItem[]) {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const item of (items || [])) {
    const q = item.quantity || 1;
    const r = item.rate ?? item.unit_price ?? 0;
    const d = item.discount || 0;
    const g = item.gst_rate ?? item.gst ?? 0;

    const itemCalc = calculateItemTotal(q, r, d, g);
    subtotal += itemCalc.subtotal;
    totalDiscount += itemCalc.discountAmount;
    totalCGST += itemCalc.cgst;
    totalSGST += itemCalc.sgst;
    totalTax += itemCalc.totalTax;
    grandTotal += itemCalc.total;
  }

  const { rounded: payableAmount, roundOff: roundOffAmount } = roundOff(grandTotal);

  return {
    subtotal,
    totalDiscount,
    totalCGST,
    totalSGST,
    totalTax,
    grandTotal,
    roundOff: roundOffAmount,
    payableAmount,
  };
}

export function calculateProfit(sellingPrice: number, costPrice: number, quantity: number) {
  const q = quantity || 0;
  const totalRevenue = (sellingPrice || 0) * q;
  const totalCost = (costPrice || 0) * q;
  const grossProfit = totalRevenue - totalCost;
  const margin = totalCost > 0 ? (grossProfit / totalCost) * 100 : 100;

  return { grossProfit, margin };
}
