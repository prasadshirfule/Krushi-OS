import { Sale, SaleItem, Customer, Payment, Product, ProductBatch } from './database';

export * from './database';

export type SaleItemWithProduct = SaleItem & {
  product: Product;
  batch: ProductBatch | null;
};

export type SaleWithItems = Sale & {
  items: SaleItemWithProduct[];
  customer: Customer | null;
  payments: Payment[];
  // Compatibility fields for printing / UI
  invoiceNumber?: string;
  createdAt?: string;
  totalAmount?: number;
  discountAmount?: number;
  cgstTotal?: number;
  sgstTotal?: number;
  paymentMethod?: string;
  total_amount?: number;
  discount_amount?: number;
  tax_amount?: number;
};

export interface BillingCartItem {
  id?: string;
  product_id?: string;
  product?: Product;
  product_name: string;
  batch_id?: string | null;
  batch_number?: string | null;
  batch?: ProductBatch | null;
  unit?: string;
  pack_size?: string;
  product_size_value?: number | null;
  product_size_unit?: string | null;
  quantity: number;
  rate: number; // selling price
  unit_price?: number;
  discount: number;
  gst_rate: number;
  gst?: number;
  available_stock?: number;
  subtotal?: number;
  total?: number;
}

export type SaleFormData = Omit<Sale, 'id' | 'created_at' | 'updated_at' | 'shop_id' | 'user_id' | 'invoice_number'> & {
  items: Omit<SaleItem, 'id' | 'created_at' | 'updated_at' | 'sale_id'>[];
  payments: PaymentSplit[];
};

export interface PaymentSplit {
  method: string;
  amount: number;
  reference?: string;
}
