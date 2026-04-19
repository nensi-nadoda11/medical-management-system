DO $$
BEGIN
  CREATE TYPE customer_gender AS ENUM ('male', 'female', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE customer_payment_method AS ENUM (
    'cash',
    'upi',
    'card',
    'bank_transfer',
    'cheque'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS customer_counters (
  shop_id uuid PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  last_sequence integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_sequence integer NOT NULL,
  customer_code varchar(40) NOT NULL,
  full_name varchar(160) NOT NULL,
  full_name_normalized varchar(160) NOT NULL,
  mobile_number varchar(20) NOT NULL,
  alternate_mobile_number varchar(20),
  email varchar(320),
  email_normalized varchar(320),
  gender customer_gender,
  age integer,
  date_of_birth timestamptz,
  address_line1 varchar(255),
  address_line2 varchar(255),
  city varchar(100),
  state varchar(100),
  pincode varchar(20),
  notes text,
  status master_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_shop_customer_code_unique_idx
  ON customers (shop_id, customer_code);
CREATE UNIQUE INDEX IF NOT EXISTS customers_shop_customer_sequence_unique_idx
  ON customers (shop_id, customer_sequence);
CREATE UNIQUE INDEX IF NOT EXISTS customers_shop_mobile_unique_idx
  ON customers (shop_id, mobile_number);
CREATE UNIQUE INDEX IF NOT EXISTS customers_shop_email_unique_idx
  ON customers (shop_id, email_normalized);
CREATE INDEX IF NOT EXISTS customers_shop_id_idx
  ON customers (shop_id);
CREATE INDEX IF NOT EXISTS customers_status_idx
  ON customers (status);
CREATE INDEX IF NOT EXISTS customers_full_name_normalized_idx
  ON customers (full_name_normalized);
CREATE INDEX IF NOT EXISTS customers_mobile_number_idx
  ON customers (mobile_number);

CREATE INDEX IF NOT EXISTS sales_customer_id_idx
  ON sales (customer_id);

CREATE TABLE IF NOT EXISTS customer_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  amount numeric(14, 2) NOT NULL DEFAULT 0.00,
  payment_method customer_payment_method NOT NULL,
  reference_number varchar(120),
  notes text,
  received_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  payment_date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_payments_shop_id_idx
  ON customer_payments (shop_id);
CREATE INDEX IF NOT EXISTS customer_payments_customer_id_idx
  ON customer_payments (customer_id);
CREATE INDEX IF NOT EXISTS customer_payments_sale_id_idx
  ON customer_payments (sale_id);
CREATE INDEX IF NOT EXISTS customer_payments_payment_date_idx
  ON customer_payments (payment_date);
CREATE INDEX IF NOT EXISTS customer_payments_received_by_user_id_idx
  ON customer_payments (received_by_user_id);

CREATE TABLE IF NOT EXISTS customer_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_payment_id uuid NOT NULL REFERENCES customer_payments(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL DEFAULT 0.00,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_payment_allocations_payment_sale_unique_idx
  ON customer_payment_allocations (customer_payment_id, sale_id);
CREATE INDEX IF NOT EXISTS customer_payment_allocations_shop_id_idx
  ON customer_payment_allocations (shop_id);
CREATE INDEX IF NOT EXISTS customer_payment_allocations_payment_id_idx
  ON customer_payment_allocations (customer_payment_id);
CREATE INDEX IF NOT EXISTS customer_payment_allocations_customer_id_idx
  ON customer_payment_allocations (customer_id);
CREATE INDEX IF NOT EXISTS customer_payment_allocations_sale_id_idx
  ON customer_payment_allocations (sale_id);
