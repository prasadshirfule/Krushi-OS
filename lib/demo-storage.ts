import fs from 'fs';
import path from 'path';
import { MOCK_SALES, MOCK_CUSTOMERS } from '@/lib/mock-data';

const DATA_DIR = path.join(process.cwd(), '.demo-store');
const SALES_FILE = path.join(DATA_DIR, 'sales.json');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/** Read demo sales from disk, initializing from MOCK_SALES if file does not exist */
export function getStoredDemoSales(normalizeSaleFn: (sale: any) => any): any[] {
  ensureDirectoryExists();
  try {
    if (fs.existsSync(SALES_FILE)) {
      const raw = fs.readFileSync(SALES_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeSaleFn);
      }
    }
  } catch (err) {
    console.error('Error reading demo sales store, resetting to initial mock data:', err);
  }

  // Initialize from MOCK_SALES
  const initial = MOCK_SALES.map(normalizeSaleFn);
  saveStoredDemoSales(initial);
  return initial;
}

/** Save demo sales to disk */
export function saveStoredDemoSales(sales: any[]): void {
  ensureDirectoryExists();
  try {
    const tempFile = `${SALES_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(sales, null, 2), 'utf-8');
    fs.renameSync(tempFile, SALES_FILE);
  } catch (err) {
    // Fallback to direct write if rename fails on Windows
    try {
      fs.writeFileSync(SALES_FILE, JSON.stringify(sales, null, 2), 'utf-8');
    } catch (writeErr) {
      console.error('Error saving demo sales store:', writeErr);
    }
  }
}

/** Read demo customers from disk, initializing from MOCK_CUSTOMERS if file does not exist */
export function getStoredDemoCustomers(normalizeCustFn: (cust: any) => any): any[] {
  ensureDirectoryExists();
  try {
    if (fs.existsSync(CUSTOMERS_FILE)) {
      const raw = fs.readFileSync(CUSTOMERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeCustFn);
      }
    }
  } catch (err) {
    console.error('Error reading demo customers store, resetting to initial mock data:', err);
  }

  // Initialize from MOCK_CUSTOMERS
  const initial = MOCK_CUSTOMERS.map(normalizeCustFn);
  saveStoredDemoCustomers(initial);
  return initial;
}

/** Save demo customers to disk */
export function saveStoredDemoCustomers(customers: any[]): void {
  ensureDirectoryExists();
  try {
    const tempFile = `${CUSTOMERS_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(customers, null, 2), 'utf-8');
    fs.renameSync(tempFile, CUSTOMERS_FILE);
  } catch (err) {
    try {
      fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2), 'utf-8');
    } catch (writeErr) {
      console.error('Error saving demo customers store:', writeErr);
    }
  }
}
