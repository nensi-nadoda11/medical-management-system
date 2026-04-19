CREATE TYPE audit_log_severity AS ENUM ('normal', 'important', 'critical');

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_role user_role NOT NULL,
  action varchar(80) NOT NULL,
  module varchar(60) NOT NULL,
  entity_type varchar(80) NOT NULL,
  entity_id varchar(120) NOT NULL,
  severity audit_log_severity NOT NULL DEFAULT 'normal',
  title varchar(180) NOT NULL,
  description text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_shop_id_idx ON audit_logs(shop_id);
CREATE INDEX audit_logs_actor_user_id_idx ON audit_logs(actor_user_id);
CREATE INDEX audit_logs_module_idx ON audit_logs(module);
CREATE INDEX audit_logs_action_idx ON audit_logs(action);
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
CREATE INDEX audit_logs_severity_idx ON audit_logs(severity);
CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at);
