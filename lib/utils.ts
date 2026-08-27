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

export function numberToWords(numInput: number): string {
  const num = Math.floor(Math.abs(numInput || 0));
  if (num === 0) return 'Zero Rupees Only';

  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const numStr = num.toString();
  if (numStr.length > 9) return `${formatCurrency(numInput)} Only`;

  const n = ('000000000' + numStr).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';

  let str = '';
  const n1 = parseInt(n[1], 10);
  const n2 = parseInt(n[2], 10);
  const n3 = parseInt(n[3], 10);
  const n4 = parseInt(n[4], 10);
  const n5 = parseInt(n[5], 10);

  str += (n1 !== 0) ? (a[n1] || b[parseInt(n[1][0], 10)] + ' ' + a[parseInt(n[1][1], 10)]) + 'Crore ' : '';
  str += (n2 !== 0) ? (a[n2] || b[parseInt(n[2][0], 10)] + ' ' + a[parseInt(n[2][1], 10)]) + 'Lakh ' : '';
  str += (n3 !== 0) ? (a[n3] || b[parseInt(n[3][0], 10)] + ' ' + a[parseInt(n[3][1], 10)]) + 'Thousand ' : '';
  str += (n4 !== 0) ? (a[n4] || b[parseInt(n[4][0], 10)] + ' ' + a[parseInt(n[4][1], 10)]) + 'Hundred ' : '';
  str += (n5 !== 0) ? ((str !== '') ? 'and ' : '') + (a[n5] || b[parseInt(n[5][0], 10)] + ' ' + a[parseInt(n[5][1], 10)]) + 'Rupees ' : '';

  return (str.trim() || 'Zero') + ' Only';
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
