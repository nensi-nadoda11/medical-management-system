DO $$
BEGIN
  CREATE TYPE sale_status AS ENUM ('held', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE sale_payment_method AS ENUM (
    'cash',
    'upi',
    'card',
    'bank_transfer',
    'split'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE stock_transaction_type ADD VALUE IF NOT EXISTS 'sale_out';
ALTER TYPE stock_reference_type ADD VALUE IF NOT EXISTS 'sale_item';

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  bill_sequence integer NOT NULL,
  bill_number varchar(40) NOT NULL,
  bill_number_normalized varchar(40) NOT NULL,
  customer_id uuid,
  customer_name varchar(160),
  customer_phone varchar(20),
  status sale_status NOT NULL DEFAULT 'held',
  payment_status purchase_payment_status NOT NULL DEFAULT 'unpaid',
  payment_method sale_payment_method NOT NULL DEFAULT 'cash',
  subtotal numeric(14, 2) NOT NULL DEFAULT 0.00,
  discount_amount numeric(14, 2) NOT NULL DEFAULT 0.00,
  tax_amount numeric(14, 2) NOT NULL DEFAULT 0.00,
  round_off_amount numeric(12, 2) NOT NULL DEFAULT 0.00,
  grand_total numeric(14, 2) NOT NULL DEFAULT 0.00,
  paid_amount numeric(14, 2) NOT NULL DEFAULT 0.00,
  due_amount numeric(14, 2) NOT NULL DEFAULT 0.00,
  notes text,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sales_shop_bill_sequence_unique_idx
  ON sales (shop_id, bill_sequence);
CREATE UNIQUE INDEX IF NOT EXISTS sales_shop_bill_number_unique_idx
  ON sales (shop_id, bill_number_normalized);
CREATE INDEX IF NOT EXISTS sales_shop_id_idx
  ON sales (shop_id);
CREATE INDEX IF NOT EXISTS sales_status_idx
  ON sales (status);
CREATE INDEX IF NOT EXISTS sales_payment_status_idx
  ON sales (payment_status);
CREATE INDEX IF NOT EXISTS sales_completed_at_idx
  ON sales (completed_at);
CREATE INDEX IF NOT EXISTS sales_created_by_user_id_idx
  ON sales (created_by_user_id);

CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES medicine_batches(id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  rate numeric(14, 2) NOT NULL DEFAULT 0.00,
  mrp numeric(14, 2) NOT NULL DEFAULT 0.00,
  gst_percent integer NOT NULL DEFAULT 0,
  discount_percent numeric(7, 2) NOT NULL DEFAULT 0.00,
  discount_amount numeric(14, 2) NOT NULL DEFAULT 0.00,
  line_subtotal numeric(14, 2) NOT NULL DEFAULT 0.00,
  line_tax_amount numeric(14, 2) NOT NULL DEFAULT 0.00,
  line_total numeric(14, 2) NOT NULL DEFAULT 0.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sale_items_shop_id_idx
  ON sale_items (shop_id);
CREATE INDEX IF NOT EXISTS sale_items_sale_id_idx
  ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS sale_items_medicine_id_idx
  ON sale_items (medicine_id);
CREATE INDEX IF NOT EXISTS sale_items_batch_id_idx
  ON sale_items (batch_id);
