export interface Product {
  id: string;
  code: string;
  name?: string;
  colors: string[];
  note?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SizeSet {
  id: string;
  name: string;
  sizes: string[];
  is_default?: boolean;
  created_at?: string;
}

export interface InventoryBatch {
  id: string;
  product_id: string;
  product_code: string;
  color: string;
  size_set_id: string | null;
  size: string;
  quantity: number;
  unit_type: string; // 'Ri nhí', 'Ri đại', 'Tuỳ chọn'
  note: string | null;
  created_at?: string;
  updated_at?: string;
  // Join properties
  product?: Product;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  note: string;
  tracking_token: string;
  created_at?: string;
  updated_at?: string;
}

export interface Invoice {
  id: string;
  invoice_code: string;
  customer_id: string | null;
  customer_name_snapshot: string;
  customer_phone_snapshot: string;
  customer_address_snapshot: string;
  total_amount: number;
  paid_amount: number;
  debt_amount: number;
  payment_status: string; // 'đã thu', 'chưa thu', 'thu một phần'
  sale_date: string;
  note: string;
  created_at?: string;
  updated_at?: string;
  // Joins
  customer?: Customer;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  product_code: string;
  product_name?: string;
  color: string;
  size: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  unit_type: string;
  created_at?: string;
}

export interface Payment {
  id: string;
  customer_id: string;
  invoice_id: string | null;
  amount: number;
  payment_date: string;
  note: string;
  created_at?: string;
  // Joins
  invoice?: Invoice;
}

export type ActiveTab = 'dashboard' | 'import' | 'inventory' | 'invoice' | 'today_invoices' | 'customers' | 'debt' | 'backup';
