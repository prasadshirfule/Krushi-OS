import { BillingCartItem, BillAdjustment } from '../types/sales';

export function calculateGST(amount: number, gstRate: number) {
  const totalTax = (amount * (gstRate || 0)) / 100;
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;
  const igst = totalTax;
  const totalWithTax = amount + totalTax;

  return { cgst, sgst, igst, totalTax, totalWithTax };
}

export interface ItemCalculationOptions {
  discountType?: 'FIXED' | 'PERCENT';
  discountAmount?: number;
}

export function calculateItemTotal(
  quantity: number,
  rate: number,
  discount: number,
  gstRate: number,
  isTaxInclusive = true,
  options?: ItemCalculationOptions
) {
  const q = Math.max(0, quantity || 0);
  const r = Math.max(0, rate || 0);
  const g = Math.max(0, gstRate || 0);

  const grossAmount = q * r;

  let calculatedDiscountAmount = 0;
  if (options?.discountAmount !== undefined) {
    calculatedDiscountAmount = Number(options.discountAmount) || 0;
  } else if (options?.discountType === 'PERCENT') {
    calculatedDiscountAmount = (grossAmount * (Number(discount) || 0)) / 100;
  } else {
    // Default: Fixed rupee amount discount
    calculatedDiscountAmount = Number(discount) || 0;
  }

  // Ensure discount cannot exceed grossAmount and cannot be negative
  const discountAmount = Math.min(grossAmount, Math.max(0, calculatedDiscountAmount));
  const netAmount = Math.max(0, grossAmount - discountAmount);

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
  const roundOffAmount = Math.round((rounded - (amount || 0)) * 100) / 100;
  return { rounded, roundOff: roundOffAmount };
}

export function calculateBillTotal(items: BillingCartItem[], adjustments: BillAdjustment[] = []) {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalTax = 0;
  let taxableAmount = 0;
  let productsTotal = 0;

  for (const item of (items || [])) {
    const q = item.quantity || 1;
    const r = item.rate ?? item.unit_price ?? 0;
    const disc = item.discount_amount !== undefined ? item.discount_amount : (item.discount || 0);
    const g = item.gst_rate ?? item.gst ?? 0;

    const itemCalc = calculateItemTotal(q, r, disc, g, true, {
      discountAmount: item.discount_amount !== undefined ? item.discount_amount : undefined,
    });
    subtotal += itemCalc.subtotal;
    totalDiscount += itemCalc.discountAmount;
    taxableAmount += itemCalc.taxableAmount;
    totalCGST += itemCalc.cgst;
    totalSGST += itemCalc.sgst;
    totalTax += itemCalc.totalTax;
    productsTotal += itemCalc.total;
  }

  // Calculate bill adjustments
  let totalAdditions = 0;
  let totalDeductions = 0;
  let taxableAdditions = 0;

  for (const adj of (adjustments || [])) {
    const amt = Math.max(0, Number(adj.amount) || 0);
    if (adj.type === 'ADD') {
      totalAdditions += amt;
      if (adj.taxTreatment === 'TAXABLE') {
        taxableAdditions += amt;
      }
    } else if (adj.type === 'DEDUCT') {
      totalDeductions += amt;
    }
  }

  // Raw grand total after additions and deductions (cannot be negative)
  const rawGrandTotal = Math.max(0, productsTotal + totalAdditions - totalDeductions);
  const { rounded: payableAmount, roundOff: roundOffAmount } = roundOff(rawGrandTotal);

  return {
    subtotal,
    totalDiscount,
    taxableAmount: taxableAmount + taxableAdditions,
    totalCGST,
    totalSGST,
    totalTax,
    productsTotal,
    totalAdditions,
    totalDeductions,
    adjustments: adjustments || [],
    grandTotal: rawGrandTotal,
    roundOff: roundOffAmount,
    payableAmount: Math.max(0, payableAmount),
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
