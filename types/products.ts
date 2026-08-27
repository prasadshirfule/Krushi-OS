import { Product, ProductBatch, Category, Brand } from './database';
import { ProductInput } from '@/lib/validations';

export type CreateProductInput = ProductInput & {
  opening_stock?: number | null;
  batch_tracking?: boolean;
  expiry_tracking?: boolean;
  batch_number?: string | null;
  mfd_date?: string | null;
  expiry_date?: string | null;
};

export type UpdateProductInput = Partial<Omit<ProductInput, 'opening_stock' | 'current_stock'>>;

export type ProductWithRelations = Product & {
  category?: Category | null;
  brand?: Brand | null;
  batches?: ProductBatch[];
};

export interface ProductListResponse {
  products: ProductWithRelations[];
  total: number;
  pages: number;
}
