import { MOCK_SALES, MOCK_CUSTOMERS, MOCK_PRODUCTS } from '@/lib/mock-data';

// In-memory server-side fallback that NEVER touches the filesystem.
// This ensures Vercel serverless functions never throw ENOENT or attempt filesystem writes.
const globalStore = globalThis as unknown as {
  _krushi_demo_sales?: any[];
  _krushi_demo_customers?: any[];
  _krushi_demo_products?: any[];
};

/** Read demo sales safely from server memory, initializing from MOCK_SALES */
export function getStoredDemoSales(normalizeSaleFn: (sale: any) => any): any[] {
  if (!globalStore._krushi_demo_sales || !Array.isArray(globalStore._krushi_demo_sales)) {
    globalStore._krushi_demo_sales = MOCK_SALES.map(normalizeSaleFn);
  }
  return globalStore._krushi_demo_sales.map(normalizeSaleFn);
}

/** Save demo sales safely to server memory */
export function saveStoredDemoSales(sales: any[]): void {
  globalStore._krushi_demo_sales = sales;
}

/** Read demo customers safely from server memory, initializing from MOCK_CUSTOMERS */
export function getStoredDemoCustomers(normalizeCustFn: (cust: any) => any): any[] {
  if (!globalStore._krushi_demo_customers || !Array.isArray(globalStore._krushi_demo_customers)) {
    globalStore._krushi_demo_customers = MOCK_CUSTOMERS.map(normalizeCustFn);
  }
  return globalStore._krushi_demo_customers.map(normalizeCustFn);
}

/** Save demo customers safely to server memory */
export function saveStoredDemoCustomers(customers: any[]): void {
  globalStore._krushi_demo_customers = customers;
}

/** Read demo products safely from server memory, initializing from MOCK_PRODUCTS */
export function getStoredDemoProducts(normalizeProdFn: (prod: any) => any): any[] {
  if (!globalStore._krushi_demo_products || !Array.isArray(globalStore._krushi_demo_products)) {
    globalStore._krushi_demo_products = MOCK_PRODUCTS.map(normalizeProdFn);
  }
  return globalStore._krushi_demo_products.map(normalizeProdFn);
}

/** Save demo products safely to server memory */
export function saveStoredDemoProducts(products: any[]): void {
  globalStore._krushi_demo_products = products;
}
