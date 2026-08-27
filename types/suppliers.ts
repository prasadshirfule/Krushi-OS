import { Supplier } from './database';

export * from './database';

export type SupplierWithBalance = Supplier & {
  total_purchases: number;
  total_paid: number;
  outstanding: number;
};

export type SupplierFormData = Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'shop_id'>;
