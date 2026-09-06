import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatDate(date: string | Date, formatStr: string = 'dd/MM/yyyy'): string {
  if (!date) return '';
  return format(new Date(date), formatStr);
}

export function formatDateTime(date: string | Date): string {
  if (!date) return '';
  return format(new Date(date), 'dd/MM/yyyy hh:mm a');
}

export function generateId(): string {
  return crypto.randomUUID();
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertUnderHundred(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  return `${TENS[ten]}${unit > 0 ? ' ' + ONES[unit] : ''}`;
}

function convertIntegerToWords(num: number): string {
  if (num === 0) return '';
  const numStr = num.toString();
  if (numStr.length > 9) return num.toLocaleString('en-IN');

  const n = ('000000000' + numStr).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';

  const crores = parseInt(n[1], 10);
  const lakhs = parseInt(n[2], 10);
  const thousands = parseInt(n[3], 10);
  const hundreds = parseInt(n[4], 10);
  const units = parseInt(n[5], 10);

  const parts: string[] = [];
  if (crores > 0) parts.push(`${convertUnderHundred(crores)} Crore`);
  if (lakhs > 0) parts.push(`${convertUnderHundred(lakhs)} Lakh`);
  if (thousands > 0) parts.push(`${convertUnderHundred(thousands)} Thousand`);
  if (hundreds > 0) parts.push(`${convertUnderHundred(hundreds)} Hundred`);
  if (units > 0) parts.push(convertUnderHundred(units));

  return parts.join(' ').trim();
}

export function numberToWords(numInput: number): string {
  if (numInput === undefined || numInput === null || isNaN(numInput)) return 'Zero Rupees Only';
  const rounded = Math.round(Number(numInput) * 100) / 100;
  const absVal = Math.abs(rounded);
  const rupees = Math.floor(absVal);
  const paise = Math.round((absVal - rupees) * 100);

  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';

  const rupeesWords = rupees > 0 ? convertIntegerToWords(rupees) : '';
  const paiseWords = paise > 0 ? convertUnderHundred(paise).trim() : '';

  if (rupees > 0 && paise > 0) {
    return `${rupeesWords} Rupees and ${paiseWords} Paise Only`.replace(/\s+/g, ' ').trim();
  } else if (rupees > 0) {
    return `${rupeesWords} Rupees Only`.replace(/\s+/g, ' ').trim();
  } else {
    return `${paiseWords} Paise Only`.replace(/\s+/g, ' ').trim();
  }
}

export function truncate(str: string, length: number): string {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getInitials(name: string): string {
  if (!name) return '';
  const parts = name.split(' ');
  let initials = '';
  for (let i = 0; i < Math.min(2, parts.length); i++) {
    if (parts[i].length > 0 && parts[i] !== '') {
      initials += parts[i][0];
    }
  }
  return initials.toUpperCase();
}

export function slugify(text: string): string {
  return (text || '')
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')           
    .replace(/[^\w\-]+/g, '')       
    .replace(/\-\-+/g, '-')         
    .replace(/^-+/, '')             
    .replace(/-+$/, '');
}

export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}
