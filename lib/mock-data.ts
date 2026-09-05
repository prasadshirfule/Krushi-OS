export interface MockProduct {
  id: string;
  name: string;
  category_id: string;
  category: { id: string; name: string };
  brand: { id: string; name: string };
  unit: string;
  hsn_code: string;
  gst_rate: number;
  purchase_price: number;
  selling_price: number;
  mrp: number;
  current_stock: number;
  min_stock: number;
  barcode: string;
  is_active: boolean;
  batches?: any[];
}

export const MOCK_CATEGORIES = [
  { id: 'cat-1', name: 'Fertilizers', description: 'Chemical & Organic Fertilizers', count: 12 },
  { id: 'cat-2', name: 'Pesticides', description: 'Insecticides, Fungicides, Herbicides', count: 24 },
  { id: 'cat-3', name: 'Seeds', description: 'Hybrid & High-Yield Seeds', count: 18 },
  { id: 'cat-4', name: 'Agro Tools', description: 'Sprayers, Cutters & Equipment', count: 8 },
];

export const MOCK_BRANDS = [
  { id: 'b-1', name: 'IFFCO', manufacturer: 'Indian Farmers Fertiliser Cooperative' },
  { id: 'b-2', name: 'Bayer CropScience', manufacturer: 'Bayer India' },
  { id: 'b-3', name: 'Syngenta', manufacturer: 'Syngenta Agro' },
  { id: 'b-4', name: 'UPL Limited', manufacturer: 'UPL' },
  { id: 'b-5', name: 'Coromandel', manufacturer: 'Coromandel International' },
  { id: 'b-6', name: 'BASF', manufacturer: 'BASF India' },
  { id: 'b-7', name: 'FMC', manufacturer: 'FMC India' },
  { id: 'b-8', name: 'Rallis India', manufacturer: 'Tata Rallis' },
  { id: 'b-9', name: 'Dhanuka', manufacturer: 'Dhanuka Agritech' },
  { id: 'b-10', name: 'PI Industries', manufacturer: 'PI Industries Ltd' },
  { id: 'b-11', name: 'Adama', manufacturer: 'Adama India' },
  { id: 'b-12', name: 'Sumitomo Chemical', manufacturer: 'Sumitomo Chemical India' },
  { id: 'b-13', name: 'Mahyco', manufacturer: 'Maharashtra Hybrid Seeds' },
  { id: 'b-14', name: 'Kaveri Seeds', manufacturer: 'Kaveri Seed Company' },
  { id: 'b-15', name: 'Nuziveedu Seeds', manufacturer: 'Nuziveedu Seeds Ltd' },
];

export const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: 'p-101',
    name: 'Confidor Insecticide 100ml',
    category_id: 'cat-2',
    category: { id: 'cat-2', name: 'Pesticides' },
    brand: { id: 'b-1', name: 'Bayer CropScience' },
    unit: '100ml Bottle',
    hsn_code: '3808',
    gst_rate: 18,
    purchase_price: 420,
    selling_price: 550,
    mrp: 600,
    current_stock: 45,
    min_stock: 10,
    barcode: '890123456701',
    is_active: true,
    batches: [
      { id: 'batch-1', batch_number: 'B-2026-01', expiry_date: '2026-11-30', quantity_available: 45, selling_price: 550, purchase_price: 420 }
    ]
  },
  {
    id: 'p-102',
    name: 'DAP Fertilizer 50kg (IFFCO)',
    category_id: 'cat-1',
    category: { id: 'cat-1', name: 'Fertilizers' },
    brand: { id: 'b-4', name: 'IFFCO' },
    unit: '50kg Bag',
    hsn_code: '3105',
    gst_rate: 5,
    purchase_price: 1300,
    selling_price: 1350,
    mrp: 1350,
    current_stock: 120,
    min_stock: 25,
    barcode: '890123456702',
    is_active: true,
    batches: [
      { id: 'batch-2', batch_number: 'IFFCO-992', expiry_date: '2027-06-30', quantity_available: 120, selling_price: 1350, purchase_price: 1300 }
    ]
  },
  {
    id: 'p-103',
    name: 'Urea 45kg Neem Coated',
    category_id: 'cat-1',
    category: { id: 'cat-1', name: 'Fertilizers' },
    brand: { id: 'b-4', name: 'IFFCO' },
    unit: '45kg Bag',
    hsn_code: '3102',
    gst_rate: 5,
    purchase_price: 242,
    selling_price: 266,
    mrp: 266,
    current_stock: 4,
    min_stock: 30,
    barcode: '890123456703',
    is_active: true,
    batches: [
      { id: 'batch-3', batch_number: 'UREA-2026', expiry_date: '2026-12-31', quantity_available: 4, selling_price: 266, purchase_price: 242 }
    ]
  },
  {
    id: 'p-104',
    name: 'Syngenta Quantis Biostimulant 1L',
    category_id: 'cat-2',
    category: { id: 'cat-2', name: 'Pesticides' },
    brand: { id: 'b-2', name: 'Syngenta' },
    unit: '1 Litre',
    hsn_code: '3808',
    gst_rate: 18,
    purchase_price: 780,
    selling_price: 950,
    mrp: 1050,
    current_stock: 18,
    min_stock: 5,
    barcode: '890123456704',
    is_active: true,
    batches: [
      { id: 'batch-4', batch_number: 'SYN-Q11', expiry_date: '2026-09-15', quantity_available: 18, selling_price: 950, purchase_price: 780 }
    ]
  },
  {
    id: 'p-105',
    name: 'Mahyco Hybrid Cotton Seeds (Bollgard II)',
    category_id: 'cat-3',
    category: { id: 'cat-3', name: 'Seeds' },
    brand: { id: 'b-5', name: 'Mahyco' },
    unit: 'Packet (475g)',
    hsn_code: '1209',
    gst_rate: 0,
    purchase_price: 750,
    selling_price: 864,
    mrp: 864,
    current_stock: 65,
    min_stock: 15,
    barcode: '890123456705',
    is_active: true,
    batches: [
      { id: 'batch-5', batch_number: 'MAHY-BG2', expiry_date: '2027-01-31', quantity_available: 65, selling_price: 864, purchase_price: 750 }
    ]
  }
];

export const MOCK_CUSTOMERS = [
  {
    id: 'cust-1',
    name: 'Ramesh Patel',
    phone: '9876543210',
    village: 'Pipariya',
    land_acres: 12,
    credit_limit: 50000,
    outstanding_balance: 14500,
    crop_details: 'Wheat, Soybean',
    created_at: '2026-01-15T10:00:00Z'
  },
  {
    id: 'cust-2',
    name: 'Suresh Kumar Sharma',
    phone: '9826112233',
    village: 'Bhopal Rural',
    land_acres: 8,
    credit_limit: 30000,
    outstanding_balance: 6200,
    crop_details: 'Paddy, Cotton',
    created_at: '2026-02-01T11:30:00Z'
  },
  {
    id: 'cust-3',
    name: 'Vijay Singh Tomar',
    phone: '9755443322',
    village: 'Sehore',
    land_acres: 25,
    credit_limit: 100000,
    outstanding_balance: 0,
    crop_details: 'Gram, Wheat, Sugarcane',
    created_at: '2026-02-10T14:15:00Z'
  }
];

export const MOCK_SUPPLIERS = [
  {
    id: 'sup-1',
    name: 'Bayer CropScience Ltd',
    contact_person: 'Anil Mehta',
    phone: '9988776655',
    gstin: '23AAACB1234F1Z1',
    outstanding_balance: 45000,
    address: 'Indore Warehouse, MP'
  },
  {
    id: 'sup-2',
    name: 'IFFCO District Depot',
    contact_person: 'Rajesh Verma',
    phone: '9893001122',
    gstin: '23AAATI0987K1Z4',
    outstanding_balance: 12000,
    address: 'Sehore Marketing Yard'
  }
];

export const MOCK_SALES = [
  {
    id: 'sale-1001',
    invoice_number: 'KOS-2026-001',
    customer_id: 'cust-1',
    customer: { id: 'cust-1', name: 'Ramesh Patel', phone: '9876543210' },
    total_amount: 2780,
    paid_amount: 2780,
    payment_mode: 'Cash',
    payment_status: 'PAID',
    created_at: new Date(Date.now() - 3600000 * 28).toISOString(),
    sale_date: new Date(Date.now() - 3600000 * 28).toISOString(),
    sale_items: [
      { 
        id: 'si-1', 
        product_name: 'Confidor Insecticide 100ml', 
        quantity: 2, 
        unit_price: 550, 
        rate: 550,
        total_price: 1100,
        manufacturer: 'Bayer CropScience',
        hsn_code: '3808',
        batch_number: 'BAY-CF-882',
        expiry_date: '10/2027',
        pack_size: '100',
        unit: 'ml',
        gst_rate: 18
      },
      { 
        id: 'si-2', 
        product_name: 'DAP Fertilizer 50kg (IFFCO)', 
        quantity: 1, 
        unit_price: 1350, 
        rate: 1350,
        total_price: 1350,
        manufacturer: 'IFFCO Ltd',
        hsn_code: '3105',
        batch_number: 'IF-DAP-419',
        expiry_date: '03/2028',
        pack_size: '50',
        unit: 'kg',
        gst_rate: 5
      }
    ]
  },
  {
    id: 'sale-1002',
    invoice_number: 'KOS-2026-002',
    customer_id: 'cust-2',
    customer: { id: 'cust-2', name: 'Suresh Kumar Sharma', phone: '9826112233' },
    total_amount: 6200,
    paid_amount: 0,
    payment_mode: 'Credit',
    payment_status: 'UNPAID',
    created_at: new Date(Date.now() - 3600000 * 52).toISOString(),
    sale_date: new Date(Date.now() - 3600000 * 52).toISOString(),
    sale_items: [
      { 
        id: 'si-3', 
        product_name: 'Syngenta Quantis Biostimulant 1L', 
        quantity: 4, 
        unit_price: 950, 
        rate: 950,
        total_price: 3800,
        manufacturer: 'Syngenta India',
        hsn_code: '3808',
        batch_number: 'SYN-Q11',
        expiry_date: '04/2027',
        pack_size: '1',
        unit: 'L',
        gst_rate: 18
      },
      { 
        id: 'si-4', 
        product_name: 'DAP Fertilizer 50kg (IFFCO)', 
        quantity: 2, 
        unit_price: 1350, 
        rate: 1350,
        total_price: 2700,
        manufacturer: 'IFFCO Ltd',
        hsn_code: '3105',
        batch_number: 'IF-DAP-419',
        expiry_date: '03/2028',
        pack_size: '50',
        unit: 'kg',
        gst_rate: 5
      }
    ]
  }
];

export const MOCK_EMPLOYEES = [
  { id: 'emp-1', name: 'Rajesh Kumar', email: 'rajesh@krushios.com', role: 'Manager', phone: '9811223344', status: 'ACTIVE', joined_at: '2025-06-01' },
  { id: 'emp-2', name: 'Vikas Sharma', email: 'vikas@krushios.com', role: 'Cashier', phone: '9822334455', status: 'ACTIVE', joined_at: '2025-09-15' },
  { id: 'emp-3', name: 'Sunil Verma', email: 'sunil@krushios.com', role: 'Sales Staff', phone: '9833445566', status: 'ACTIVE', joined_at: '2026-01-10' }
];

export const MOCK_AUDIT_LOGS = [
  { id: 'log-1', user_name: 'Demo Admin', action: 'SALE_CREATE', module: 'POS Billing', details: 'Created Tax Invoice #KOS-2026-001 (₹2,780)', created_at: new Date(Date.now() - 3600000 * 2).toISOString() },
  { id: 'log-2', user_name: 'Rajesh Kumar', action: 'STOCK_ADJUST', module: 'Inventory', details: 'Adjusted stock for Urea 45kg (-2 bags damaged)', created_at: new Date(Date.now() - 3600000 * 6).toISOString() },
  { id: 'log-3', user_name: 'Demo Admin', action: 'CUSTOMER_PAYMENT', module: 'Credit Khata', details: 'Received ₹5,000 credit repayment from Ramesh Patel', created_at: new Date(Date.now() - 3600000 * 24).toISOString() }
];

export const MOCK_NOTIFICATIONS = [
  { id: 'notif-1', title: 'Low Stock Alert', message: 'Urea 45kg Neem Coated stock is below minimum threshold (4 left, min 30).', type: 'warning', created_at: '10 mins ago', read: false },
  { id: 'notif-2', title: 'Batch Expiry Warning', message: 'Syngenta Quantis Batch SYN-Q11 expires in 19 days.', type: 'critical', created_at: '2 hours ago', read: false },
  { id: 'notif-3', title: 'Credit Repayment Received', message: 'Ramesh Patel paid ₹5,000 via UPI.', type: 'info', created_at: '1 day ago', read: true }
];
