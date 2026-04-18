DO $$
BEGIN
  CREATE TYPE purchase_status AS ENUM ('draft', 'finalized', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE purchase_payment_status AS ENUM ('unpaid', 'partial', 'paid');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE batch_status AS ENUM ('active', 'exhausted', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE stock_transaction_type AS ENUM (
    'purchase_in',
    'adjustment_in',
    'adjustment_out'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE stock_reference_type AS ENUM ('purchase_item', 'stock_adjustment');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE stock_adjustment_type AS ENUM ('in', 'out');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_number varchar(40) NOT NULL,
  purchase_number_normalized varchar(40) NOT NULL,
  supplier_invoice_number varchar(80),
  supplier_invoice_number_normalized varchar(80),
  supplier_invoice_date timestamptz,
  purchase_date timestamptz NOT NULL,
  status purchase_status NOT NULL DEFAULT 'draft',
  payment_status purchase_payment_status NOT NULL DEFAULT 'unpaid',
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
  finalized_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS purchases_shop_purchase_number_unique_idx
  ON purchases (shop_id, purchase_number_normalized);
CREATE UNIQUE INDEX IF NOT EXISTS purchases_shop_supplier_invoice_unique_idx
  ON purchases (shop_id, supplier_id, supplier_invoice_number_normalized);
CREATE INDEX IF NOT EXISTS purchases_shop_id_idx
  ON purchases (shop_id);
CREATE INDEX IF NOT EXISTS purchases_supplier_id_idx
  ON purchases (supplier_id);
CREATE INDEX IF NOT EXISTS purchases_purchase_date_idx
  ON purchases (purchase_date);
CREATE INDEX IF NOT EXISTS purchases_status_idx
  ON purchases (status);
CREATE INDEX IF NOT EXISTS purchases_payment_status_idx
  ON purchases (payment_status);

CREATE TABLE IF NOT EXISTS medicine_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  batch_number varchar(80) NOT NULL,
  batch_number_normalized varchar(80) NOT NULL,
  expiry_date timestamptz NOT NULL,
  purchase_rate numeric(14, 2) NOT NULL DEFAULT 0.00,
  sale_rate numeric(14, 2) NOT NULL DEFAULT 0.00,
  mrp numeric(14, 2) NOT NULL DEFAULT 0.00,
  gst_percent integer NOT NULL DEFAULT 0,
  quantity_received integer NOT NULL DEFAULT 0,
  quantity_available integer NOT NULL DEFAULT 0,
  status batch_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS medicine_batches_shop_batch_unique_idx
  ON medicine_batches (shop_id, medicine_id, batch_number_normalized, expiry_date);
CREATE INDEX IF NOT EXISTS medicine_batches_shop_id_idx
  ON medicine_batches (shop_id);
CREATE INDEX IF NOT EXISTS medicine_batches_medicine_id_idx
  ON medicine_batches (medicine_id);
CREATE INDEX IF NOT EXISTS medicine_batches_expiry_date_idx
  ON medicine_batches (expiry_date);
CREATE INDEX IF NOT EXISTS medicine_batches_status_idx
  ON medicine_batches (status);

CREATE TABLE IF NOT EXISTS purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  medicine_batch_id uuid REFERENCES medicine_batches(id) ON DELETE SET NULL,
  batch_number varchar(80) NOT NULL,
  batch_number_normalized varchar(80) NOT NULL,
  expiry_date timestamptz NOT NULL,
  quantity integer NOT NULL,
  free_quantity integer NOT NULL DEFAULT 0,
  purchase_rate numeric(14, 2) NOT NULL DEFAULT 0.00,
  sale_rate numeric(14, 2) NOT NULL DEFAULT 0.00,
  mrp numeric(14, 2) NOT NULL DEFAULT 0.00,
  gst_percent integer NOT NULL DEFAULT 0,
  discount_percent numeric(7, 2) NOT NULL DEFAULT 0.00,
  line_subtotal numeric(14, 2) NOT NULL DEFAULT 0.00,
  line_tax_amount numeric(14, 2) NOT NULL DEFAULT 0.00,
  line_total numeric(14, 2) NOT NULL DEFAULT 0.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS purchase_items_purchase_batch_unique_idx
  ON purchase_items (purchase_id, medicine_id, batch_number_normalized, expiry_date);
CREATE INDEX IF NOT EXISTS purchase_items_shop_id_idx
  ON purchase_items (shop_id);
CREATE INDEX IF NOT EXISTS purchase_items_purchase_id_idx
  ON purchase_items (purchase_id);
CREATE INDEX IF NOT EXISTS purchase_items_medicine_id_idx
  ON purchase_items (medicine_id);
CREATE INDEX IF NOT EXISTS purchase_items_medicine_batch_id_idx
  ON purchase_items (medicine_batch_id);

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES medicine_batches(id) ON DELETE RESTRICT,
  adjustment_type stock_adjustment_type NOT NULL,
  quantity integer NOT NULL,
  reason varchar(160) NOT NULL,
  notes text,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_adjustments_shop_id_idx
  ON stock_adjustments (shop_id);
CREATE INDEX IF NOT EXISTS stock_adjustments_medicine_id_idx
  ON stock_adjustments (medicine_id);
CREATE INDEX IF NOT EXISTS stock_adjustments_batch_id_idx
  ON stock_adjustments (batch_id);
CREATE INDEX IF NOT EXISTS stock_adjustments_created_at_idx
  ON stock_adjustments (created_at);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES medicine_batches(id) ON DELETE RESTRICT,
  transaction_type stock_transaction_type NOT NULL,
  quantity_in integer NOT NULL DEFAULT 0,
  quantity_out integer NOT NULL DEFAULT 0,
  balance_after integer NOT NULL,
  reference_type stock_reference_type NOT NULL,
  reference_id uuid NOT NULL,
  notes text,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_transactions_shop_id_idx
  ON stock_transactions (shop_id);
CREATE INDEX IF NOT EXISTS stock_transactions_medicine_id_idx
  ON stock_transactions (medicine_id);
CREATE INDEX IF NOT EXISTS stock_transactions_batch_id_idx
  ON stock_transactions (batch_id);
CREATE INDEX IF NOT EXISTS stock_transactions_type_idx
  ON stock_transactions (transaction_type);
CREATE INDEX IF NOT EXISTS stock_transactions_reference_idx
  ON stock_transactions (reference_type, reference_id);
CREATE INDEX IF NOT EXISTS stock_transactions_created_at_idx
  ON stock_transactions (created_at);

CREATE TABLE IF NOT EXISTS low_stock_alert_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  is_low_stock boolean NOT NULL DEFAULT false,
  current_available_quantity integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 0,
  entered_low_stock_at timestamptz,
  resolved_at timestamptz,
  last_alert_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS low_stock_alert_states_shop_medicine_unique_idx
  ON low_stock_alert_states (shop_id, medicine_id);
CREATE INDEX IF NOT EXISTS low_stock_alert_states_shop_id_idx
  ON low_stock_alert_states (shop_id);
CREATE INDEX IF NOT EXISTS low_stock_alert_states_medicine_id_idx
  ON low_stock_alert_states (medicine_id);
CREATE INDEX IF NOT EXISTS low_stock_alert_states_is_low_stock_idx
  ON low_stock_alert_states (is_low_stock);
