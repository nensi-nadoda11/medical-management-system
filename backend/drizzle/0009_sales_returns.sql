DO $$
BEGIN
  CREATE TYPE sale_return_status AS ENUM ('draft', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE sale_return_refund_method AS ENUM (
    'cash',
    'upi',
    'card',
    'bank_transfer',
    'adjustment'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE sale_return_refund_status AS ENUM (
    'pending',
    'processed',
    'not_required'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE stock_transaction_type ADD VALUE IF NOT EXISTS 'sales_return_in';
ALTER TYPE stock_reference_type ADD VALUE IF NOT EXISTS 'sale_return_item';

CREATE TABLE IF NOT EXISTS sale_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  return_sequence integer NOT NULL,
  return_number varchar(40) NOT NULL,
  return_number_normalized varchar(40) NOT NULL,
  status sale_return_status NOT NULL DEFAULT 'draft',
  total_return_amount numeric(14, 2) NOT NULL DEFAULT 0.00,
  refund_amount numeric(14, 2) NOT NULL DEFAULT 0.00,
  refund_method sale_return_refund_method,
  refund_status sale_return_refund_status NOT NULL DEFAULT 'not_required',
  notes text,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  completed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sale_returns_shop_return_sequence_unique_idx
  ON sale_returns (shop_id, return_sequence);
CREATE UNIQUE INDEX IF NOT EXISTS sale_returns_shop_return_number_unique_idx
  ON sale_returns (shop_id, return_number_normalized);
CREATE INDEX IF NOT EXISTS sale_returns_shop_id_idx
  ON sale_returns (shop_id);
CREATE INDEX IF NOT EXISTS sale_returns_sale_id_idx
  ON sale_returns (sale_id);
CREATE INDEX IF NOT EXISTS sale_returns_status_idx
  ON sale_returns (status);
CREATE INDEX IF NOT EXISTS sale_returns_refund_status_idx
  ON sale_returns (refund_status);
CREATE INDEX IF NOT EXISTS sale_returns_created_at_idx
  ON sale_returns (created_at);
CREATE INDEX IF NOT EXISTS sale_returns_completed_at_idx
  ON sale_returns (completed_at);
CREATE INDEX IF NOT EXISTS sale_returns_created_by_user_id_idx
  ON sale_returns (created_by_user_id);
CREATE INDEX IF NOT EXISTS sale_returns_completed_by_user_id_idx
  ON sale_returns (completed_by_user_id);

CREATE TABLE IF NOT EXISTS sale_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  return_id uuid NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
  sale_item_id uuid NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES medicine_batches(id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  rate numeric(14, 2) NOT NULL DEFAULT 0.00,
  tax_percent integer NOT NULL DEFAULT 0,
  discount_amount numeric(14, 2) NOT NULL DEFAULT 0.00,
  line_return_amount numeric(14, 2) NOT NULL DEFAULT 0.00,
  reason varchar(160) NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sale_return_items_shop_id_idx
  ON sale_return_items (shop_id);
CREATE INDEX IF NOT EXISTS sale_return_items_return_id_idx
  ON sale_return_items (return_id);
CREATE INDEX IF NOT EXISTS sale_return_items_sale_item_id_idx
  ON sale_return_items (sale_item_id);
CREATE INDEX IF NOT EXISTS sale_return_items_medicine_id_idx
  ON sale_return_items (medicine_id);
CREATE INDEX IF NOT EXISTS sale_return_items_batch_id_idx
  ON sale_return_items (batch_id);
