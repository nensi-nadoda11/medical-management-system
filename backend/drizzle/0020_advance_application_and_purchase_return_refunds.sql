ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS advance_applied_amount numeric(14, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS advance_applied_amount numeric(14, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE purchase_returns
  ADD COLUMN IF NOT EXISTS refund_amount numeric(14, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS refund_method sale_return_refund_method,
  ADD COLUMN IF NOT EXISTS refund_status sale_return_refund_status NOT NULL DEFAULT 'not_required';

CREATE INDEX IF NOT EXISTS purchase_returns_refund_status_idx
  ON purchase_returns (refund_status);
