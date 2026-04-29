DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'import_job_status'
  ) THEN
    CREATE TYPE import_job_status AS ENUM ('validated', 'processing', 'completed', 'failed');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'import_type'
  ) THEN
    CREATE TYPE import_type AS ENUM ('medicines', 'suppliers', 'customers');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'import_duplicate_mode'
  ) THEN
    CREATE TYPE import_duplicate_mode AS ENUM ('skip_duplicates', 'update_existing', 'fail_duplicates', 'upsert');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'import_row_status'
  ) THEN
    CREATE TYPE import_row_status AS ENUM ('valid', 'invalid', 'duplicate', 'skipped', 'imported', 'failed');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'backup_record_status'
  ) THEN
    CREATE TYPE backup_record_status AS ENUM ('ready', 'restored', 'failed');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'backup_record_type'
  ) THEN
    CREATE TYPE backup_record_type AS ENUM ('shop_snapshot');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  import_type import_type NOT NULL,
  file_name varchar(255) NOT NULL,
  file_format varchar(10) NOT NULL,
  status import_job_status NOT NULL DEFAULT 'validated',
  duplicate_mode import_duplicate_mode NOT NULL DEFAULT 'skip_duplicates',
  total_rows integer NOT NULL DEFAULT 0,
  valid_rows integer NOT NULL DEFAULT 0,
  invalid_rows integer NOT NULL DEFAULT 0,
  duplicate_rows integer NOT NULL DEFAULT 0,
  warning_rows integer NOT NULL DEFAULT 0,
  success_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  summary jsonb,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS import_jobs_shop_id_idx ON import_jobs(shop_id);
CREATE INDEX IF NOT EXISTS import_jobs_import_type_idx ON import_jobs(import_type);
CREATE INDEX IF NOT EXISTS import_jobs_status_idx ON import_jobs(status);
CREATE INDEX IF NOT EXISTS import_jobs_created_by_user_id_idx ON import_jobs(created_by_user_id);
CREATE INDEX IF NOT EXISTS import_jobs_created_at_idx ON import_jobs(created_at);

CREATE TABLE IF NOT EXISTS import_job_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  status import_row_status NOT NULL,
  action varchar(40),
  identifier varchar(255),
  raw_data jsonb NOT NULL,
  normalized_data jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_entity_id varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_job_rows_job_row_number_unique_idx UNIQUE(job_id, row_number)
);

CREATE INDEX IF NOT EXISTS import_job_rows_job_id_idx ON import_job_rows(job_id);
CREATE INDEX IF NOT EXISTS import_job_rows_shop_id_idx ON import_job_rows(shop_id);
CREATE INDEX IF NOT EXISTS import_job_rows_status_idx ON import_job_rows(status);

CREATE TABLE IF NOT EXISTS backup_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  type backup_record_type NOT NULL DEFAULT 'shop_snapshot',
  status backup_record_status NOT NULL DEFAULT 'ready',
  file_name varchar(255) NOT NULL,
  storage_path text NOT NULL,
  file_size_bytes integer NOT NULL DEFAULT 0,
  metadata jsonb,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  restored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backup_records_shop_id_idx ON backup_records(shop_id);
CREATE INDEX IF NOT EXISTS backup_records_status_idx ON backup_records(status);
CREATE INDEX IF NOT EXISTS backup_records_created_by_user_id_idx ON backup_records(created_by_user_id);
CREATE INDEX IF NOT EXISTS backup_records_created_at_idx ON backup_records(created_at);
