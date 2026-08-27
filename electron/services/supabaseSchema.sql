-- ============================================================================
-- SUPABASE CLOUD POSTGRESQL SCHEMA FOR MECHANICAL SHOP POS (PHASE 5)
-- Multi-tenant schema with Shop Isolation via Row Level Security (RLS)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SHOPS & TENANTS TABLE
CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  owner_email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  device_id TEXT
);

-- 3. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  barcode TEXT,
  name TEXT NOT NULL,
  name_bn TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  brand TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs',
  cost_price_paisa BIGINT NOT NULL DEFAULT 0,
  sell_price_paisa BIGINT NOT NULL DEFAULT 0,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  is_serial_tracked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  device_id TEXT
);

-- 4. SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  total_payable_paisa BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  device_id TEXT
);

-- 5. PURCHASES & PURCHASE ITEMS
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  invoice_ref TEXT,
  total_paisa BIGINT NOT NULL DEFAULT 0,
  paid_paisa BIGINT NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  device_id TEXT
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL,
  unit_cost_paisa BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  device_id TEXT
);

-- 6. STOCK TRANSACTIONS (Event-Sourced Inventory Ledger)
CREATE TABLE IF NOT EXISTS stock_transactions (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK(type IN ('purchase', 'sale', 'return_in', 'return_out', 'adjustment', 'initial')),
  qty_delta INTEGER NOT NULL,
  ref_table TEXT,
  ref_id TEXT,
  reason TEXT,
  user_id TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 7. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  note TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 8. SALES & SALE ITEMS
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  invoice_no TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('completed', 'held', 'refunded', 'partial_refund')),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  subtotal_paisa BIGINT NOT NULL DEFAULT 0,
  discount_paisa BIGINT NOT NULL DEFAULT 0,
  total_paisa BIGINT NOT NULL DEFAULT 0,
  user_id TEXT NOT NULL,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_sales_shop_invoice UNIQUE(shop_id, invoice_no)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL,
  unit_price_paisa BIGINT NOT NULL,
  discount_paisa BIGINT NOT NULL DEFAULT 0,
  serial_number_id TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 9. PAYMENTS (Ledger for all monetary movements)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK(direction IN ('in', 'out')),
  method TEXT NOT NULL CHECK(method IN ('cash', 'bkash', 'nagad', 'card')),
  amount_paisa BIGINT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('sale_payment', 'due_collection', 'refund', 'supplier_payment')),
  user_id TEXT NOT NULL,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 10. RETURNS & RETURN ITEMS
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL,
  reason TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL,
  amount_paisa BIGINT NOT NULL,
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 11. AUDIT LOG (Immutable)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  detail_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Scoped automatically to auth.jwt() ->> 'shop_id'
-- ============================================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function to extract shop_id from JWT token
CREATE OR REPLACE FUNCTION current_shop_id() RETURNS UUID AS $$
  SELECT (auth.jwt() ->> 'shop_id')::UUID;
$$ LANGUAGE SQL STABLE;

-- Generic RLS Policy Macro for Tables
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'categories', 'products', 'suppliers', 'purchases', 'purchase_items',
    'stock_transactions', 'customers', 'sales', 'sale_items', 'payments',
    'returns', 'return_items', 'audit_log'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS "Shop Isolation Policy" ON %I;
      CREATE POLICY "Shop Isolation Policy" ON %I
        FOR ALL USING (shop_id = current_shop_id())
        WITH CHECK (shop_id = current_shop_id());
    ', tbl, tbl);
  END LOOP;
END $$;
