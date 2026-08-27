import { ProductBatch, Product, StockTransactionTypeEnum } from './database';

export * from './database';

export type BatchWithProduct = ProductBatch & {
  product: Product;
};

export const ExpiryStatus = {
  NORMAL: 'NORMAL',
  EXPIRING_SOON: 'EXPIRING_SOON', // < 90 days
  WARNING: 'WARNING', // < 30 days
  URGENT: 'URGENT', // < 7 days
  EXPIRED: 'EXPIRED',
} as const;

export type ExpiryStatusEnum = typeof ExpiryStatus[keyof typeof ExpiryStatus];

export interface InventoryItem {
  product: Product;
  total_stock: number;
  batches: BatchWithProduct[];
  expiry_status: ExpiryStatusEnum;
}

export interface StockAdjustmentFormData {
  product_id: string;
  batch_id?: string;
  transaction_type: StockTransactionTypeEnum;
  quantity: number;
  notes?: string;
}
