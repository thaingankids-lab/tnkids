import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigError =
  !SUPABASE_URL || !SUPABASE_ANON_KEY
    ? 'Thiếu cấu hình VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY. Vui lòng khai báo trong biến môi trường deploy.'
    : null;

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'missing-anon-key',
);

// Helper to check if tables exist and are accessible
export async function checkDatabaseSetup(): Promise<{ success: boolean; missingTables: string[]; error?: string }> {
  const tables = ['products', 'size_sets', 'inventory_batches', 'customers', 'invoices', 'invoice_items', 'payments'];
  const missingTables: string[] = [];

  try {
    if (supabaseConfigError) {
      return {
        success: false,
        missingTables: [],
        error: supabaseConfigError,
      };
    }

    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error) {
        // Code 42P01 means table does not exist in PostgreSQL
        if (error.code === '42P01') {
          missingTables.push(table);
        } else {
          // If it's a permission issue or something else, but table exists
          console.warn(`Error checking table ${table}:`, error.message);
        }
      }
    }
    return {
      success: missingTables.length === 0,
      missingTables,
    };
  } catch (err: any) {
    return {
      success: false,
      missingTables: tables,
      error: err.message || 'Không thể kết nối đến Supabase',
    };
  }
}

// SQL Script to create tables in Supabase SQL Editor
export const INITIAL_SQL_SCRIPT = `-- SCRIPT KHỞI TẠO DATABASE CHO SHOP QUẢN LÝ KHO RI/SIZE
-- Hãy copy toàn bộ script này dán vào SQL Editor của Supabase và nhấn RUN.

-- 1. Bảng products (Sản phẩm)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    colors TEXT[] DEFAULT '{}',
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE OR REPLACE FUNCTION add_table_to_realtime(table_name TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('alter publication supabase_realtime add table %I', table_name);
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Enable Realtime for products
SELECT add_table_to_realtime('products');

-- 2. Bảng size_sets (Bộ size mẫu)
CREATE TABLE IF NOT EXISTS size_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sizes TEXT[] DEFAULT '{}',
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Realtime for size_sets
SELECT add_table_to_realtime('size_sets');

-- Chèn dữ liệu mẫu cho size_sets
INSERT INTO size_sets (name, sizes, is_default) VALUES 
('Ri nhí (Size 3-10)', ARRAY['3', '4', '5', '6', '7', '8', '9', '10'], true),
('Ri đại (Size 11-16)', ARRAY['11', '12', '13', '14', '15', '16'], true)
ON CONFLICT DO NOTHING;

-- 3. Bảng inventory_batches (Tồn kho và lô nhập)
CREATE TABLE IF NOT EXISTS inventory_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    product_code TEXT NOT NULL,
    color TEXT NOT NULL,
    size_set_id UUID REFERENCES size_sets(id) ON DELETE SET NULL,
    size TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    unit_type TEXT NOT NULL, -- 'Ri nhí', 'Ri đại', hoặc 'Tuỳ chọn'
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Realtime for inventory_batches
SELECT add_table_to_realtime('inventory_batches');

-- 4. Bảng customers (Khách hàng)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    note TEXT,
    tracking_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Realtime for customers
SELECT add_table_to_realtime('customers');

-- 5. Bảng invoices (Hoá đơn)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_code TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name_snapshot TEXT NOT NULL,
    customer_phone_snapshot TEXT,
    customer_address_snapshot TEXT,
    total_amount BIGINT NOT NULL DEFAULT 0,
    paid_amount BIGINT NOT NULL DEFAULT 0,
    debt_amount BIGINT NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL, -- 'đã thu', 'chưa thu', 'thu một phần'
    sale_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Realtime for invoices
SELECT add_table_to_realtime('invoices');

-- 6. Bảng invoice_items (Chi tiết hoá đơn)
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_code TEXT NOT NULL,
    product_name TEXT,
    color TEXT NOT NULL,
    size TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    unit_price BIGINT NOT NULL DEFAULT 0,
    subtotal BIGINT NOT NULL DEFAULT 0,
    unit_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Realtime for invoice_items
SELECT add_table_to_realtime('invoice_items');

-- 7. Bảng payments (Lịch sử thanh toán công nợ)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    amount BIGINT NOT NULL DEFAULT 0,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Realtime for payments
SELECT add_table_to_realtime('payments');

-- 8. Ràng buộc bảo vệ dữ liệu và tăng tốc truy vấn
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_batches_quantity_non_negative') THEN
    ALTER TABLE inventory_batches ADD CONSTRAINT inventory_batches_quantity_non_negative CHECK (quantity >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_quantity_positive') THEN
    ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_quantity_positive CHECK (quantity > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_price_non_negative') THEN
    ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_price_non_negative CHECK (unit_price >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_subtotal_non_negative') THEN
    ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_subtotal_non_negative CHECK (subtotal >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_amounts_non_negative') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_amounts_non_negative CHECK (total_amount >= 0 AND paid_amount >= 0 AND debt_amount >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_amount_positive') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_batches_unique_variant
ON inventory_batches (
  product_id,
  lower(trim(color)),
  lower(trim(size)),
  COALESCE(size_set_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_product_id ON inventory_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_product_code ON inventory_batches(product_code);
CREATE INDEX IF NOT EXISTS idx_invoices_sale_date ON invoices(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_customers_tracking_token ON customers(tracking_token);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_products_updated_at ON products;
CREATE TRIGGER set_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_inventory_batches_updated_at ON inventory_batches;
CREATE TRIGGER set_inventory_batches_updated_at
BEFORE UPDATE ON inventory_batches
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_customers_updated_at ON customers;
CREATE TRIGGER set_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_invoices_updated_at ON invoices;
CREATE TRIGGER set_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION sync_inventory_product_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    UPDATE inventory_batches
    SET product_code = NEW.code
    WHERE product_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_inventory_product_code_trigger ON products;
CREATE TRIGGER sync_inventory_product_code_trigger
AFTER UPDATE OF code ON products
FOR EACH ROW EXECUTE FUNCTION sync_inventory_product_code();

-- Reload schema cache
notify pgrst, 'reload schema';
`;
