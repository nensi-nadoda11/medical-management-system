DO $$
BEGIN
  CREATE TYPE permission_override_effect AS ENUM ('allow', 'deny');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE admin_audit_target_type AS ENUM (
    'role_permission',
    'user_permission_override',
    'shop_setting'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS shop_role_permission_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_role_permission_configs_shop_role_unique_idx
  ON shop_role_permission_configs (shop_id, role);
CREATE INDEX IF NOT EXISTS shop_role_permission_configs_shop_id_idx
  ON shop_role_permission_configs (shop_id);

CREATE TABLE IF NOT EXISTS shop_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  permission varchar(80) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_role_permissions_shop_role_permission_unique_idx
  ON shop_role_permissions (shop_id, role, permission);
CREATE INDEX IF NOT EXISTS shop_role_permissions_shop_id_idx
  ON shop_role_permissions (shop_id);
CREATE INDEX IF NOT EXISTS shop_role_permissions_role_idx
  ON shop_role_permissions (role);
CREATE INDEX IF NOT EXISTS shop_role_permissions_permission_idx
  ON shop_role_permissions (permission);

CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission varchar(80) NOT NULL,
  effect permission_override_effect NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_permission_overrides_user_permission_unique_idx
  ON user_permission_overrides (user_id, permission);
CREATE INDEX IF NOT EXISTS user_permission_overrides_shop_id_idx
  ON user_permission_overrides (shop_id);
CREATE INDEX IF NOT EXISTS user_permission_overrides_user_id_idx
  ON user_permission_overrides (user_id);
CREATE INDEX IF NOT EXISTS user_permission_overrides_effect_idx
  ON user_permission_overrides (effect);

CREATE TABLE IF NOT EXISTS shop_settings (
  shop_id uuid PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  default_low_stock_threshold integer NOT NULL DEFAULT 10,
  low_stock_alerts_enabled boolean NOT NULL DEFAULT true,
  low_stock_email_alerts_enabled boolean NOT NULL DEFAULT true,
  near_expiry_alert_days integer NOT NULL DEFAULT 30,
  expiry_alerts_enabled boolean NOT NULL DEFAULT true,
  expiry_email_alerts_enabled boolean NOT NULL DEFAULT true,
  invoice_prefix varchar(20) NOT NULL DEFAULT 'INV',
  allow_partial_payments boolean NOT NULL DEFAULT true,
  allow_held_bills boolean NOT NULL DEFAULT true,
  allow_staff_sales_return boolean NOT NULL DEFAULT true,
  allow_inventory_adjustment boolean NOT NULL DEFAULT true,
  allow_draft_purchases boolean NOT NULL DEFAULT true,
  prefer_fefo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO shop_settings (
  shop_id,
  invoice_prefix,
  created_at,
  updated_at
)
SELECT
  shops.id,
  COALESCE(NULLIF(shops.invoice_prefix, ''), 'INV'),
  now(),
  now()
FROM shops
ON CONFLICT (shop_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  target_type admin_audit_target_type NOT NULL,
  target_id varchar(120),
  action varchar(80) NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_shop_id_idx
  ON admin_audit_logs (shop_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_user_id_idx
  ON admin_audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_target_type_idx
  ON admin_audit_logs (target_type);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx
  ON admin_audit_logs (created_at);
