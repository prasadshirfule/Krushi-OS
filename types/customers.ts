import { Customer, CustomerLedger } from './database';

export * from './database';

export type CustomerWithBalance = Customer & {
  total_purchases: number;
  total_paid: number;
  outstanding: number;
};

export type CustomerFormData = Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'shop_id'>;

export type LedgerEntry = CustomerLedger & {
  running_balance: number;
};
