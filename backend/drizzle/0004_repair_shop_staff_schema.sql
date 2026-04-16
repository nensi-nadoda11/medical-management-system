ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS phone varchar(20),
  ADD COLUMN IF NOT EXISTS email varchar(320),
  ADD COLUMN IF NOT EXISTS address_line1 varchar(255),
  ADD COLUMN IF NOT EXISTS address_line2 varchar(255),
  ADD COLUMN IF NOT EXISTS city varchar(100),
  ADD COLUMN IF NOT EXISTS state varchar(100),
  ADD COLUMN IF NOT EXISTS pincode varchar(20),
  ADD COLUMN IF NOT EXISTS gst_number varchar(50),
  ADD COLUMN IF NOT EXISTS license_number varchar(100),
  ADD COLUMN IF NOT EXISTS invoice_prefix varchar(20) NOT NULL DEFAULT 'INV';

ALTER TABLE users
  ALTER COLUMN mobile_number DROP NOT NULL;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_mobile_number_key;

CREATE TABLE IF NOT EXISTS user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  email varchar(320) NOT NULL,
  full_name varchar(160) NOT NULL,
  role user_role NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  invited_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_invitations_shop_id_idx ON user_invitations (shop_id);
CREATE INDEX IF NOT EXISTS user_invitations_email_idx ON user_invitations (email);
CREATE INDEX IF NOT EXISTS user_invitations_expires_at_idx ON user_invitations (expires_at);
CREATE INDEX IF NOT EXISTS user_invitations_invited_by_idx ON user_invitations (invited_by_user_id);
