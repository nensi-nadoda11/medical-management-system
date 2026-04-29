DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'notification_type'
  ) THEN
    CREATE TYPE notification_type AS ENUM (
      'low_stock',
      'near_expiry',
      'expired_stock',
      'customer_due',
      'supplier_payable',
      'system_alert'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'notification_severity'
  ) THEN
    CREATE TYPE notification_severity AS ENUM ('info', 'warning', 'critical');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'notification_entity_type'
  ) THEN
    CREATE TYPE notification_entity_type AS ENUM (
      'medicine',
      'medicine_batch',
      'customer',
      'supplier',
      'system'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'notification_email_status'
  ) THEN
    CREATE TYPE notification_email_status AS ENUM (
      'pending',
      'sent',
      'failed',
      'skipped'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
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

CREATE INDEX IF NOT EXISTS notifications_shop_id_idx ON notifications(shop_id);
CREATE INDEX IF NOT EXISTS notifications_type_idx ON notifications(type);
CREATE INDEX IF NOT EXISTS notifications_severity_idx ON notifications(severity);
CREATE INDEX IF NOT EXISTS notifications_entity_idx ON notifications(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS notifications_condition_key_idx ON notifications(condition_key);
CREATE INDEX IF NOT EXISTS notifications_is_active_idx ON notifications(is_active);
CREATE INDEX IF NOT EXISTS notifications_read_at_idx ON notifications(read_at);
CREATE INDEX IF NOT EXISTS notifications_acknowledged_at_idx ON notifications(acknowledged_at);
CREATE INDEX IF NOT EXISTS notifications_email_status_idx ON notifications(email_status);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at);
