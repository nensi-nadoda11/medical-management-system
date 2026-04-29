ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS purchase_order_approved_at timestamptz;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS purchase_order_approved_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS supplier_notified_at timestamptz;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS supplier_notified_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
