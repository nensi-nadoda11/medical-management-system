DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'stock_transfer_status'
  ) THEN
    CREATE TYPE stock_transfer_status AS ENUM ('draft', 'completed', 'cancelled');
  END IF;
END $$;

ALTER TYPE stock_transaction_type ADD VALUE IF NOT EXISTS 'transfer_out';
ALTER TYPE stock_transaction_type ADD VALUE IF NOT EXISTS 'transfer_in';
ALTER TYPE stock_reference_type ADD VALUE IF NOT EXISTS 'stock_transfer_item';

CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  code varchar(40) NOT NULL,
  address text,
  contact_number varchar(20),
  status master_status NOT NULL DEFAULT 'active',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS branches_shop_name_unique_idx
  ON branches (shop_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS branches_shop_code_unique_idx
  ON branches (shop_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS branches_shop_default_unique_idx
  ON branches (shop_id)
  WHERE is_default = true;
CREATE INDEX IF NOT EXISTS branches_shop_id_idx ON branches (shop_id);
CREATE INDEX IF NOT EXISTS branches_status_idx ON branches (status);

INSERT INTO branches (shop_id, name, code, address, contact_number, status, is_default)
SELECT
  s.id,
  COALESCE(NULLIF(trim(s.name), ''), 'Main Branch'),
  'MAIN',
  concat_ws(', ', s.address_line1, s.address_line2, s.city, s.state, s.pincode),
  s.phone,
  'active',
  true
FROM shops s
WHERE NOT EXISTS (
  SELECT 1
  FROM branches b
  WHERE b.shop_id = s.id
    AND b.is_default = true
);

CREATE TABLE IF NOT EXISTS user_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_branches_user_branch_unique_idx
  ON user_branches (user_id, branch_id);
CREATE INDEX IF NOT EXISTS user_branches_shop_id_idx ON user_branches (shop_id);
CREATE INDEX IF NOT EXISTS user_branches_user_id_idx ON user_branches (user_id);
CREATE INDEX IF NOT EXISTS user_branches_branch_id_idx ON user_branches (branch_id);

INSERT INTO user_branches (shop_id, user_id, branch_id)
SELECT u.shop_id, u.id, b.id
FROM users u
INNER JOIN branches b
  ON b.shop_id = u.shop_id
 AND b.is_default = true
WHERE NOT EXISTS (
  SELECT 1
  FROM user_branches ub
  WHERE ub.user_id = u.id
    AND ub.branch_id = b.id
);

CREATE TABLE IF NOT EXISTS branch_settings (
  branch_id uuid PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
  low_stock_threshold integer,
  low_stock_alerts_enabled boolean,
  low_stock_email_alerts_enabled boolean,
  near_expiry_alert_days integer,
  expiry_alerts_enabled boolean,
  expiry_email_alerts_enabled boolean,
  invoice_prefix varchar(20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  from_branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  to_branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  status stock_transfer_status NOT NULL DEFAULT 'draft',
  notes text,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_transfers_shop_id_idx ON stock_transfers (shop_id);
CREATE INDEX IF NOT EXISTS stock_transfers_from_branch_id_idx ON stock_transfers (from_branch_id);
CREATE INDEX IF NOT EXISTS stock_transfers_to_branch_id_idx ON stock_transfers (to_branch_id);
CREATE INDEX IF NOT EXISTS stock_transfers_status_idx ON stock_transfers (status);
CREATE INDEX IF NOT EXISTS stock_transfers_created_at_idx ON stock_transfers (created_at);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  source_batch_id uuid NOT NULL REFERENCES medicine_batches(id) ON DELETE RESTRICT,
  destination_batch_id uuid REFERENCES medicine_batches(id) ON DELETE SET NULL,
  quantity integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_transfer_items_transfer_id_idx ON stock_transfer_items (transfer_id);
CREATE INDEX IF NOT EXISTS stock_transfer_items_shop_id_idx ON stock_transfer_items (shop_id);
CREATE INDEX IF NOT EXISTS stock_transfer_items_medicine_id_idx ON stock_transfer_items (medicine_id);
CREATE INDEX IF NOT EXISTS stock_transfer_items_source_batch_id_idx ON stock_transfer_items (source_batch_id);

CREATE OR REPLACE FUNCTION get_default_branch_id(target_shop_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT id
  FROM branches
  WHERE shop_id = target_shop_id
    AND is_default = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION ensure_default_branch_for_shop()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO branches (shop_id, name, code, address, contact_number, status, is_default)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.name), ''), 'Main Branch'),
    'MAIN',
    concat_ws(', ', NEW.address_line1, NEW.address_line2, NEW.city, NEW.state, NEW.pincode),
    NEW.phone,
    'active',
    true
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shops_default_branch_trigger ON shops;
CREATE TRIGGER shops_default_branch_trigger
AFTER INSERT ON shops
FOR EACH ROW
EXECUTE FUNCTION ensure_default_branch_for_shop();

CREATE OR REPLACE FUNCTION ensure_default_user_branch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  default_branch_id uuid;
BEGIN
  SELECT get_default_branch_id(NEW.shop_id) INTO default_branch_id;

  IF default_branch_id IS NOT NULL THEN
    INSERT INTO user_branches (shop_id, user_id, branch_id)
    VALUES (NEW.shop_id, NEW.id, default_branch_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_default_branch_trigger ON users;
CREATE TRIGGER users_default_branch_trigger
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION ensure_default_user_branch();

CREATE OR REPLACE FUNCTION assign_default_branch_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.branch_id IS NULL AND NEW.shop_id IS NOT NULL THEN
    SELECT get_default_branch_id(NEW.shop_id) INTO NEW.branch_id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE medicine_batches ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE customer_payment_allocations ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE supplier_payment_allocations ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE sale_returns ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE sale_return_items ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE purchase_returns ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE purchase_return_items ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;
ALTER TABLE low_stock_alert_states ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT;

UPDATE admin_audit_logs a
SET branch_id = b.id
FROM branches b
WHERE a.branch_id IS NULL
  AND b.shop_id = a.shop_id
  AND b.is_default = true;

UPDATE notifications n
SET branch_id = b.id
FROM branches b
WHERE n.branch_id IS NULL
  AND b.shop_id = n.shop_id
  AND b.is_default = true;

UPDATE audit_logs a
SET branch_id = b.id
FROM branches b
WHERE a.branch_id IS NULL
  AND b.shop_id = a.shop_id
  AND b.is_default = true;

UPDATE purchases p
SET branch_id = b.id
FROM branches b
WHERE p.branch_id IS NULL
  AND b.shop_id = p.shop_id
  AND b.is_default = true;

UPDATE medicine_batches mb
SET branch_id = COALESCE(
  p.branch_id,
  b.id
)
FROM branches b
LEFT JOIN purchase_items pi
  ON pi.medicine_batch_id = mb.id
LEFT JOIN purchases p
  ON p.id = pi.purchase_id
WHERE mb.branch_id IS NULL
  AND b.shop_id = mb.shop_id
  AND b.is_default = true;

UPDATE sales s
SET branch_id = b.id
FROM branches b
WHERE s.branch_id IS NULL
  AND b.shop_id = s.shop_id
  AND b.is_default = true;

UPDATE customer_payments cp
SET branch_id = COALESCE(s.branch_id, b.id)
FROM branches b
LEFT JOIN sales s
  ON s.id = cp.sale_id
WHERE cp.branch_id IS NULL
  AND b.shop_id = cp.shop_id
  AND b.is_default = true;

UPDATE customer_payment_allocations cpa
SET branch_id = COALESCE(s.branch_id, cp.branch_id, b.id)
FROM branches b
LEFT JOIN sales s
  ON s.id = cpa.sale_id
LEFT JOIN customer_payments cp
  ON cp.id = cpa.customer_payment_id
WHERE cpa.branch_id IS NULL
  AND b.shop_id = cpa.shop_id
  AND b.is_default = true;

UPDATE supplier_payments sp
SET branch_id = COALESCE(p.branch_id, b.id)
FROM branches b
LEFT JOIN purchases p
  ON p.id = sp.purchase_id
WHERE sp.branch_id IS NULL
  AND b.shop_id = sp.shop_id
  AND b.is_default = true;

UPDATE supplier_payment_allocations spa
SET branch_id = COALESCE(p.branch_id, sp.branch_id, b.id)
FROM branches b
LEFT JOIN purchases p
  ON p.id = spa.purchase_id
LEFT JOIN supplier_payments sp
  ON sp.id = spa.supplier_payment_id
WHERE spa.branch_id IS NULL
  AND b.shop_id = spa.shop_id
  AND b.is_default = true;

UPDATE ledger_entries le
SET branch_id = COALESCE(s.branch_id, p.branch_id, sr.branch_id, pr.branch_id, cp.branch_id, sp.branch_id, b.id)
FROM branches b
LEFT JOIN sales s
  ON le.reference_type = 'sale'
 AND s.id = le.reference_id
LEFT JOIN purchases p
  ON le.reference_type = 'purchase'
 AND p.id = le.reference_id
LEFT JOIN sale_returns sr
  ON le.reference_type = 'sale_return'
 AND sr.id = le.reference_id
LEFT JOIN purchase_returns pr
  ON le.reference_type = 'purchase_return'
 AND pr.id = le.reference_id
LEFT JOIN customer_payments cp
  ON le.reference_type = 'customer_payment'
 AND cp.id = le.reference_id
LEFT JOIN supplier_payments sp
  ON le.reference_type = 'supplier_payment'
 AND sp.id = le.reference_id
WHERE le.branch_id IS NULL
  AND b.shop_id = le.shop_id
  AND b.is_default = true;

UPDATE sale_items si
SET branch_id = s.branch_id
FROM sales s
WHERE si.branch_id IS NULL
  AND s.id = si.sale_id;

UPDATE sale_returns sr
SET branch_id = s.branch_id
FROM sales s
WHERE sr.branch_id IS NULL
  AND s.id = sr.sale_id;

UPDATE sale_return_items sri
SET branch_id = COALESCE(sr.branch_id, s.branch_id)
FROM sale_returns sr
LEFT JOIN sales s
  ON s.id = sr.sale_id
WHERE sri.branch_id IS NULL
  AND sr.id = sri.return_id;

UPDATE purchase_items pi
SET branch_id = p.branch_id
FROM purchases p
WHERE pi.branch_id IS NULL
  AND p.id = pi.purchase_id;

UPDATE purchase_returns pr
SET branch_id = p.branch_id
FROM purchases p
WHERE pr.branch_id IS NULL
  AND p.id = pr.purchase_id;

UPDATE purchase_return_items pri
SET branch_id = COALESCE(pr.branch_id, p.branch_id)
FROM purchase_returns pr
LEFT JOIN purchases p
  ON p.id = pr.purchase_id
WHERE pri.branch_id IS NULL
  AND pr.id = pri.return_id;

UPDATE stock_adjustments sa
SET branch_id = mb.branch_id
FROM medicine_batches mb
WHERE sa.branch_id IS NULL
  AND mb.id = sa.batch_id;

UPDATE stock_transactions st
SET branch_id = mb.branch_id
FROM medicine_batches mb
WHERE st.branch_id IS NULL
  AND mb.id = st.batch_id;

UPDATE low_stock_alert_states ls
SET branch_id = COALESCE(mb.branch_id, b.id)
FROM branches b
LEFT JOIN medicine_batches mb
  ON mb.shop_id = ls.shop_id
 AND mb.medicine_id = ls.medicine_id
 AND mb.quantity_available > 0
WHERE ls.branch_id IS NULL
  AND b.shop_id = ls.shop_id
  AND b.is_default = true;

ALTER TABLE purchases ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE medicine_batches ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE sales ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE customer_payments ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE customer_payment_allocations ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE supplier_payments ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE supplier_payment_allocations ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE ledger_entries ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE sale_items ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE sale_returns ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE sale_return_items ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE purchase_items ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE purchase_returns ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE purchase_return_items ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE stock_adjustments ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE stock_transactions ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE low_stock_alert_states ALTER COLUMN branch_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS admin_audit_logs_branch_id_idx ON admin_audit_logs (branch_id);
CREATE INDEX IF NOT EXISTS notifications_branch_id_idx ON notifications (branch_id);
CREATE INDEX IF NOT EXISTS audit_logs_branch_id_idx ON audit_logs (branch_id);
CREATE INDEX IF NOT EXISTS purchases_branch_id_idx ON purchases (shop_id, branch_id);
CREATE INDEX IF NOT EXISTS medicine_batches_branch_id_idx ON medicine_batches (shop_id, branch_id);
CREATE INDEX IF NOT EXISTS sales_branch_id_idx ON sales (shop_id, branch_id);
CREATE INDEX IF NOT EXISTS customer_payments_branch_id_idx ON customer_payments (shop_id, branch_id);
CREATE INDEX IF NOT EXISTS customer_payment_allocations_branch_id_idx ON customer_payment_allocations (shop_id, branch_id);
CREATE INDEX IF NOT EXISTS supplier_payments_branch_id_idx ON supplier_payments (shop_id, branch_id);
CREATE INDEX IF NOT EXISTS supplier_payment_allocations_branch_id_idx ON supplier_payment_allocations (shop_id, branch_id);
CREATE INDEX IF NOT EXISTS ledger_entries_branch_id_idx ON ledger_entries (shop_id, branch_id);
CREATE INDEX IF NOT EXISTS sale_items_branch_id_idx ON sale_items (shop_id, branch_id);
CREATE INDEX IF NOT EXISTS sale_returns_branch_id_idx ON sale_returns (shop_id, branch_id);
CREATE INDEX IF NOT EXISTS sale_return_items_branch_id_idx ON sale_return_items (shop_id, branch_id);
CREATE INDEX IF NOT EXISTS purchase_items_branch_id_idx ON purchase_items (shop_id, branch_id);
CREATE INDEX IF NOT EXISTS purchase_returns_branch_id_idx ON purchase_returns (shop_id, branch_id);
CREATE INDEX IF NOT EXISTS purchase_return_items_branch_id_idx ON purchase_return_items (shop_id, branch_id);
CREATE INDEX IF NOT EXISTS stock_adjustments_branch_id_idx ON stock_adjustments (shop_id, branch_id);
CREATE INDEX IF NOT EXISTS stock_transactions_branch_id_idx ON stock_transactions (shop_id, branch_id);
CREATE INDEX IF NOT EXISTS low_stock_alert_states_branch_id_idx ON low_stock_alert_states (shop_id, branch_id);

DROP INDEX IF EXISTS low_stock_alert_states_shop_medicine_unique_idx;
DROP INDEX IF EXISTS medicine_batches_shop_batch_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS medicine_batches_shop_batch_unique_idx
  ON medicine_batches (shop_id, branch_id, medicine_id, batch_number_normalized, expiry_date);
CREATE UNIQUE INDEX IF NOT EXISTS low_stock_alert_states_shop_branch_medicine_unique_idx
  ON low_stock_alert_states (shop_id, branch_id, medicine_id);

DROP TRIGGER IF EXISTS purchases_assign_branch_trigger ON purchases;
CREATE TRIGGER purchases_assign_branch_trigger
BEFORE INSERT ON purchases
FOR EACH ROW
EXECUTE FUNCTION assign_default_branch_id();

DROP TRIGGER IF EXISTS medicine_batches_assign_branch_trigger ON medicine_batches;
CREATE TRIGGER medicine_batches_assign_branch_trigger
BEFORE INSERT ON medicine_batches
FOR EACH ROW
EXECUTE FUNCTION assign_default_branch_id();

DROP TRIGGER IF EXISTS sales_assign_branch_trigger ON sales;
CREATE TRIGGER sales_assign_branch_trigger
BEFORE INSERT ON sales
FOR EACH ROW
EXECUTE FUNCTION assign_default_branch_id();

DROP TRIGGER IF EXISTS customer_payments_assign_branch_trigger ON customer_payments;
CREATE TRIGGER customer_payments_assign_branch_trigger
BEFORE INSERT ON customer_payments
FOR EACH ROW
EXECUTE FUNCTION assign_default_branch_id();

DROP TRIGGER IF EXISTS customer_payment_allocations_assign_branch_trigger ON customer_payment_allocations;
CREATE TRIGGER customer_payment_allocations_assign_branch_trigger
BEFORE INSERT ON customer_payment_allocations
FOR EACH ROW
EXECUTE FUNCTION assign_default_branch_id();

DROP TRIGGER IF EXISTS supplier_payments_assign_branch_trigger ON supplier_payments;
CREATE TRIGGER supplier_payments_assign_branch_trigger
BEFORE INSERT ON supplier_payments
FOR EACH ROW
EXECUTE FUNCTION assign_default_branch_id();

DROP TRIGGER IF EXISTS supplier_payment_allocations_assign_branch_trigger ON supplier_payment_allocations;
CREATE TRIGGER supplier_payment_allocations_assign_branch_trigger
BEFORE INSERT ON supplier_payment_allocations
FOR EACH ROW
EXECUTE FUNCTION assign_default_branch_id();

DROP TRIGGER IF EXISTS ledger_entries_assign_branch_trigger ON ledger_entries;
CREATE TRIGGER ledger_entries_assign_branch_trigger
BEFORE INSERT ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION assign_default_branch_id();

DROP TRIGGER IF EXISTS sale_items_assign_branch_trigger ON sale_items;
CREATE TRIGGER sale_items_assign_branch_trigger
BEFORE INSERT ON sale_items
FOR EACH ROW
EXECUTE FUNCTION assign_default_branch_id();

DROP TRIGGER IF EXISTS sale_returns_assign_branch_trigger ON sale_returns;
CREATE TRIGGER sale_returns_assign_branch_trigger
BEFORE INSERT ON sale_returns
FOR EACH ROW
EXECUTE FUNCTION assign_default_branch_id();

DROP TRIGGER IF EXISTS sale_return_items_assign_branch_trigger ON sale_return_items;
CREATE TRIGGER sale_return_items_assign_branch_trigger
BEFORE INSERT ON sale_return_items
FOR EACH ROW
EXECUTE FUNCTION assign_default_branch_id();

DROP TRIGGER IF EXISTS purchase_items_assign_branch_trigger ON purchase_items;
CREATE TRIGGER purchase_items_assign_branch_trigger
BEFORE INSERT ON purchase_items
FOR EACH ROW
EXECUTE FUNCTION assign_default_branch_id();

DROP TRIGGER IF EXISTS purchase_returns_assign_branch_trigger ON purchase_returns;
CREATE TRIGGER purchase_returns_assign_branch_trigger
BEFORE INSERT ON purchase_returns
FOR EACH ROW
EXECUTE FUNCTION assign_default_branch_id();

DROP TRIGGER IF EXISTS purchase_return_items_assign_branch_trigger ON purchase_return_items;
CREATE TRIGGER purchase_return_items_assign_branch_trigger
BEFORE INSERT ON purchase_return_items
FOR EACH ROW
EXECUTE FUNCTION assign_default_branch_id();

DROP TRIGGER IF EXISTS stock_adjustments_assign_branch_trigger ON stock_adjustments;
CREATE TRIGGER stock_adjustments_assign_branch_trigger
BEFORE INSERT ON stock_adjustments
FOR EACH ROW
EXECUTE FUNCTION assign_default_branch_id();

DROP TRIGGER IF EXISTS stock_transactions_assign_branch_trigger ON stock_transactions;
CREATE TRIGGER stock_transactions_assign_branch_trigger
BEFORE INSERT ON stock_transactions
FOR EACH ROW
EXECUTE FUNCTION assign_default_branch_id();

DROP TRIGGER IF EXISTS low_stock_alert_states_assign_branch_trigger ON low_stock_alert_states;
CREATE TRIGGER low_stock_alert_states_assign_branch_trigger
BEFORE INSERT ON low_stock_alert_states
FOR EACH ROW
EXECUTE FUNCTION assign_default_branch_id();
