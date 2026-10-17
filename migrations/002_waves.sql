-- A wave is a hand-picked list of businesses prepared for outreach together, in list order.
CREATE TABLE waves (
  wave TEXT NOT NULL,
  business_id INTEGER NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('wave', 'reserve', 'dropped')),
  note TEXT,
  PRIMARY KEY (wave, business_id)
);

-- One fact about a business that may be put in front of its owner: where it was read and on what day.
CREATE TABLE facts (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  value TEXT NOT NULL,
  source_url TEXT,
  quote TEXT,
  flag TEXT,
  checked_on TEXT NOT NULL
);
CREATE INDEX facts_business ON facts (business_id, topic);

-- Which tool produced a finding. Plumbline's own checks re-measure only their own findings.
ALTER TABLE findings ADD COLUMN source TEXT NOT NULL DEFAULT 'plumbline';
