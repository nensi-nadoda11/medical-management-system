DO $$
BEGIN
  CREATE TYPE master_status AS ENUM ('active', 'inactive');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE medicine_form AS ENUM (
    'tablet',
    'capsule',
    'syrup',
    'injection',
    'ointment',
    'cream',
    'drops',
    'inhaler',
    'powder',
    'gel',
    'lotion',
    'solution',
    'suspension',
    'spray',
    'vial',
    'sachet',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE medicine_unit AS ENUM (
    'strip',
    'bottle',
    'piece',
    'box',
    'vial',
    'tube',
    'sachet',
    'ampoule',
    'packet',
    'kit',
    'container',
    'canister',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS medicine_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  normalized_name varchar(120) NOT NULL,
  description varchar(255),
  status master_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS medicine_categories_shop_name_unique_idx
  ON medicine_categories (shop_id, normalized_name);
CREATE INDEX IF NOT EXISTS medicine_categories_shop_id_idx
  ON medicine_categories (shop_id);
CREATE INDEX IF NOT EXISTS medicine_categories_status_idx
  ON medicine_categories (status);
CREATE INDEX IF NOT EXISTS medicine_categories_normalized_name_idx
  ON medicine_categories (normalized_name);

CREATE TABLE IF NOT EXISTS manufacturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  normalized_name varchar(160) NOT NULL,
  status master_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS manufacturers_shop_name_unique_idx
  ON manufacturers (shop_id, normalized_name);
CREATE INDEX IF NOT EXISTS manufacturers_shop_id_idx
  ON manufacturers (shop_id);
CREATE INDEX IF NOT EXISTS manufacturers_status_idx
  ON manufacturers (status);
CREATE INDEX IF NOT EXISTS manufacturers_normalized_name_idx
  ON manufacturers (normalized_name);

CREATE TABLE IF NOT EXISTS medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  medicine_name varchar(180) NOT NULL,
  medicine_name_normalized varchar(180) NOT NULL,
  generic_name varchar(180) NOT NULL,
  generic_name_normalized varchar(180) NOT NULL,
  brand_name varchar(160),
  brand_name_normalized varchar(160),
  strength varchar(80),
  strength_normalized varchar(80) NOT NULL DEFAULT '',
  form medicine_form NOT NULL,
  unit medicine_unit NOT NULL,
  category_id uuid NOT NULL REFERENCES medicine_categories(id) ON DELETE RESTRICT,
  manufacturer_id uuid NOT NULL REFERENCES manufacturers(id) ON DELETE RESTRICT,
  hsn_code varchar(20),
  gst_percent integer NOT NULL,
  barcode varchar(100),
  reorder_level integer NOT NULL DEFAULT 0,
  prescription_required boolean NOT NULL DEFAULT false,
  notes text,
  status master_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS medicines_shop_duplicate_unique_idx
  ON medicines (
    shop_id,
    medicine_name_normalized,
    strength_normalized,
    form,
    manufacturer_id
  );
CREATE UNIQUE INDEX IF NOT EXISTS medicines_shop_barcode_unique_idx
  ON medicines (shop_id, barcode)
  WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS medicines_shop_id_idx
  ON medicines (shop_id);
CREATE INDEX IF NOT EXISTS medicines_category_id_idx
  ON medicines (category_id);
CREATE INDEX IF NOT EXISTS medicines_manufacturer_id_idx
  ON medicines (manufacturer_id);
CREATE INDEX IF NOT EXISTS medicines_status_idx
  ON medicines (status);
CREATE INDEX IF NOT EXISTS medicines_medicine_name_normalized_idx
  ON medicines (medicine_name_normalized);
CREATE INDEX IF NOT EXISTS medicines_generic_name_normalized_idx
  ON medicines (generic_name_normalized);
CREATE INDEX IF NOT EXISTS medicines_barcode_idx
  ON medicines (barcode);

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  supplier_name varchar(180) NOT NULL,
  supplier_name_normalized varchar(180) NOT NULL,
  company_name varchar(180),
  company_name_normalized varchar(180),
  contact_person varchar(160),
  mobile_number varchar(20) NOT NULL,
  alternate_mobile_number varchar(20),
  email varchar(320),
  gst_number varchar(15),
  drug_license_number varchar(100),
  address_line1 varchar(255),
  address_line2 varchar(255),
  city varchar(100),
  state varchar(100),
  pincode varchar(20),
  opening_balance numeric(14, 2) NOT NULL DEFAULT 0.00,
  notes text,
  status master_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_shop_mobile_unique_idx
  ON suppliers (shop_id, mobile_number);
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_shop_email_unique_idx
  ON suppliers (shop_id, lower(email))
  WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_shop_gst_unique_idx
  ON suppliers (shop_id, gst_number)
  WHERE gst_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS suppliers_shop_id_idx
  ON suppliers (shop_id);
CREATE INDEX IF NOT EXISTS suppliers_status_idx
  ON suppliers (status);
CREATE INDEX IF NOT EXISTS suppliers_supplier_name_normalized_idx
  ON suppliers (supplier_name_normalized);
CREATE INDEX IF NOT EXISTS suppliers_mobile_number_idx
  ON suppliers (mobile_number);
CREATE INDEX IF NOT EXISTS suppliers_email_idx
  ON suppliers (email);
CREATE INDEX IF NOT EXISTS suppliers_gst_number_idx
  ON suppliers (gst_number);
