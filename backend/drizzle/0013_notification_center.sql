CREATE TYPE notification_type AS ENUM (
  'low_stock',
  'near_expiry',
  'expired_stock',
  'customer_due',
  'supplier_payable',
  'system_alert'
);

CREATE TYPE notification_severity AS ENUM ('info', 'warning', 'critical');

CREATE TYPE notification_entity_type AS ENUM (
  'medicine',
  'medicine_batch',
  'customer',
  'supplier',
  'system'
);

CREATE TYPE notification_email_status AS ENUM (
  'pending',
  'sent',
  'failed',
  'skipped'
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title varchar(180) NOT NULL,
  message text NOT NULL,
  severity notification_severity NOT NULL,
  entity_type notification_entity_type NOT NULL,
  entity_id uuid,
  condition_key varchar(220) NOT NULL,
  metadata jsonb,
  delivery_channels jsonb NOT NULL DEFAULT '["in_app"]'::jsonb,
  email_status notification_email_status NOT NULL DEFAULT 'skipped',
  read_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_shop_id_idx ON notifications(shop_id);
CREATE INDEX notifications_type_idx ON notifications(type);
CREATE INDEX notifications_severity_idx ON notifications(severity);
CREATE INDEX notifications_entity_idx ON notifications(entity_type, entity_id);
CREATE INDEX notifications_condition_key_idx ON notifications(condition_key);
CREATE INDEX notifications_is_active_idx ON notifications(is_active);
CREATE INDEX notifications_read_at_idx ON notifications(read_at);
CREATE INDEX notifications_acknowledged_at_idx ON notifications(acknowledged_at);
CREATE INDEX notifications_email_status_idx ON notifications(email_status);
CREATE INDEX notifications_created_at_idx ON notifications(created_at);
