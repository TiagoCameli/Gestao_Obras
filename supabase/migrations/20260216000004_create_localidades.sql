-- Create localidades table for Frete origin/destination lookup
CREATE TABLE IF NOT EXISTS localidades (
  id text PRIMARY KEY,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true
);

ALTER TABLE localidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON localidades FOR ALL TO authenticated USING (true) WITH CHECK (true);
