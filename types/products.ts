import { Product, ProductBatch, Category } from './database';

export * from './database';

export type ProductWithBatches = Product & {
  batches: ProductBatch[];
};

export type ProductWithStock = Product & {
  current_stock: number;
  batch_count: number;
};

export type ProductFormData = Omit<Product, 'id' | 'created_at' | 'updated_at' | 'shop_id'>;

export type CategoryWithCount = Category & {
  product_count: number;
};
