DO $$
BEGIN
  CREATE TYPE payment_record_status AS ENUM ('completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ledger_entity_type AS ENUM ('customer', 'supplier');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ledger_transaction_type AS ENUM (
    'opening_balance',
    'sale',
    'sale_return',
    'payment_received',
    'purchase',
    'purchase_return',
    'payment_made'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ledger_reference_type AS ENUM (
    'opening_balance',
    'sale',
    'sale_return',
    'customer_payment',
    'supplier_payment',
    'purchase',
    'purchase_return'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS initial_paid_amount numeric(14, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS initial_paid_amount numeric(14, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE customer_payments
  ADD COLUMN IF NOT EXISTS status payment_record_status NOT NULL DEFAULT 'completed';

CREATE INDEX IF NOT EXISTS customer_payments_status_idx
  ON customer_payments (status);

WITH customer_allocations AS (
  SELECT
    cpa.sale_id,
    COALESCE(SUM(cpa.amount), 0.00) AS allocated_amount
  FROM customer_payment_allocations cpa
  INNER JOIN customer_payments cp
    ON cp.id = cpa.customer_payment_id
  WHERE cp.status = 'completed'
  GROUP BY cpa.sale_id
)
UPDATE sales
SET initial_paid_amount = GREATEST(
  sales.paid_amount - COALESCE(customer_allocations.allocated_amount, 0.00),
  0.00
)
FROM customer_allocations
WHERE sales.id = customer_allocations.sale_id;

UPDATE sales
SET initial_paid_amount = paid_amount
WHERE initial_paid_amount = 0.00
  AND paid_amount > 0.00;

UPDATE purchases
SET initial_paid_amount = paid_amount
WHERE initial_paid_amount = 0.00
  AND paid_amount > 0.00;

CREATE TABLE IF NOT EXISTS supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_id uuid REFERENCES purchases(id) ON DELETE SET NULL,
  amount numeric(14, 2) NOT NULL DEFAULT 0.00,
  payment_method customer_payment_method NOT NULL,
  status payment_record_status NOT NULL DEFAULT 'completed',
  reference_number varchar(120),
  notes text,
  payment_date timestamptz NOT NULL,
  paid_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_payments_shop_id_idx
  ON supplier_payments (shop_id);
CREATE INDEX IF NOT EXISTS supplier_payments_supplier_id_idx
  ON supplier_payments (supplier_id);
CREATE INDEX IF NOT EXISTS supplier_payments_purchase_id_idx
  ON supplier_payments (purchase_id);
CREATE INDEX IF NOT EXISTS supplier_payments_status_idx
  ON supplier_payments (status);
CREATE INDEX IF NOT EXISTS supplier_payments_payment_date_idx
  ON supplier_payments (payment_date);
CREATE INDEX IF NOT EXISTS supplier_payments_paid_by_user_id_idx
  ON supplier_payments (paid_by_user_id);

CREATE TABLE IF NOT EXISTS supplier_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  supplier_payment_id uuid NOT NULL REFERENCES supplier_payments(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL DEFAULT 0.00,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_payment_allocations_payment_purchase_unique_idx
  ON supplier_payment_allocations (supplier_payment_id, purchase_id);
CREATE INDEX IF NOT EXISTS supplier_payment_allocations_shop_id_idx
  ON supplier_payment_allocations (shop_id);
CREATE INDEX IF NOT EXISTS supplier_payment_allocations_payment_id_idx
  ON supplier_payment_allocations (supplier_payment_id);
CREATE INDEX IF NOT EXISTS supplier_payment_allocations_supplier_id_idx
  ON supplier_payment_allocations (supplier_id);
CREATE INDEX IF NOT EXISTS supplier_payment_allocations_purchase_id_idx
  ON supplier_payment_allocations (purchase_id);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  entity_type ledger_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  transaction_type ledger_transaction_type NOT NULL,
  debit numeric(14, 2) NOT NULL DEFAULT 0.00,
  credit numeric(14, 2) NOT NULL DEFAULT 0.00,
  balance_after numeric(14, 2) NOT NULL DEFAULT 0.00,
  entry_date timestamptz NOT NULL,
  reference_type ledger_reference_type NOT NULL,
  reference_id uuid NOT NULL,
  notes text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_entries_shop_id_idx
  ON ledger_entries (shop_id);
CREATE INDEX IF NOT EXISTS ledger_entries_entity_idx
  ON ledger_entries (shop_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ledger_entries_transaction_type_idx
  ON ledger_entries (transaction_type);
CREATE INDEX IF NOT EXISTS ledger_entries_entry_date_idx
  ON ledger_entries (entry_date);
CREATE INDEX IF NOT EXISTS ledger_entries_reference_idx
  ON ledger_entries (reference_type, reference_id);
