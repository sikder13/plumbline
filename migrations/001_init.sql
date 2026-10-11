CREATE TABLE businesses (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  website TEXT,
  domain TEXT,
  country TEXT NOT NULL DEFAULT 'NZ',
  region TEXT,
  town TEXT,
  lat REAL,
  lng REAL,
  pack TEXT NOT NULL DEFAULT 'tourism',
  activity TEXT,
  source TEXT NOT NULL CHECK (source IN ('seed20', 'master76', 'discovered')),
  google_place_id TEXT,
  google_rating REAL,
  google_review_count INTEGER,
  google_business_status TEXT,
  phone TEXT,
  listing_urls TEXT NOT NULL DEFAULT '[]',
  seed TEXT,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'qualified', 'excluded', 'audited')),
  exclude_reason TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX businesses_domain ON businesses (domain);
CREATE UNIQUE INDEX businesses_place ON businesses (google_place_id) WHERE google_place_id IS NOT NULL;

CREATE TABLE contacts (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'second', 'general')),
  name TEXT,
  name_confirmed INTEGER NOT NULL DEFAULT 0,
  title TEXT,
  email TEXT,
  email_source_url TEXT,
  phone TEXT,
  contact_form_url TEXT,
  linkedin_url TEXT,
  source_url TEXT,
  source_quote TEXT,
  captured_at TEXT NOT NULL
);
CREATE INDEX contacts_business ON contacts (business_id);

CREATE TABLE consent_checks (
  business_id INTEGER PRIMARY KEY REFERENCES businesses (id) ON DELETE CASCADE,
  pages_checked TEXT NOT NULL,
  no_unsolicited_statement_found INTEGER NOT NULL,
  quote TEXT,
  checked_at TEXT NOT NULL
);

CREATE TABLE batch_members (
  batch TEXT NOT NULL,
  business_id INTEGER NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  PRIMARY KEY (batch, business_id)
);

CREATE TABLE runs (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  batch TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('A', 'B', 'recheck')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed', 'blocked')),
  error TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX runs_business ON runs (business_id, batch, kind);

CREATE TABLE pages (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  final_url TEXT,
  viewport TEXT NOT NULL,
  role TEXT NOT NULL,
  http_status INTEGER,
  title TEXT,
  capture_path TEXT,
  fetched_at TEXT NOT NULL
);
CREATE INDEX pages_run ON pages (run_id);

CREATE TABLE observations (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  collector TEXT NOT NULL,
  page_url TEXT,
  viewport TEXT,
  value TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX observations_run ON observations (run_id, collector);

CREATE TABLE findings (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  batch TEXT NOT NULL,
  check_id TEXT NOT NULL,
  pack TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('measured', 'rule', 'judgment')),
  severity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'reproduced', 'approved', 'rejected', 'resolved')),
  reproduced INTEGER NOT NULL DEFAULT 0,
  fingerprint TEXT NOT NULL,
  title TEXT NOT NULL,
  page_url TEXT,
  viewport TEXT,
  visibility_weight REAL NOT NULL,
  score REAL NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}',
  first_run_id INTEGER REFERENCES runs (id) ON DELETE SET NULL,
  last_run_id INTEGER REFERENCES runs (id) ON DELETE SET NULL,
  first_seen_at TEXT NOT NULL,
  last_verified_at TEXT,
  top3 INTEGER NOT NULL DEFAULT 0,
  UNIQUE (business_id, batch, check_id, fingerprint)
);
CREATE INDEX findings_business ON findings (business_id, batch);

CREATE TABLE evidence (
  id INTEGER PRIMARY KEY,
  finding_id INTEGER NOT NULL REFERENCES findings (id) ON DELETE CASCADE,
  run_id INTEGER REFERENCES runs (id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  url TEXT,
  viewport TEXT,
  selector TEXT,
  bbox TEXT,
  excerpt TEXT,
  path TEXT,
  captured_at_utc TEXT NOT NULL,
  captured_at_nz TEXT NOT NULL
);
CREATE INDEX evidence_finding ON evidence (finding_id);

CREATE TABLE ai_answers (
  id INTEGER PRIMARY KEY,
  question_key TEXT NOT NULL,
  question TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('shared', 'brand')),
  business_id INTEGER REFERENCES businesses (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  day TEXT NOT NULL,
  run_index INTEGER NOT NULL,
  answer TEXT NOT NULL,
  citations TEXT NOT NULL DEFAULT '[]',
  usage TEXT NOT NULL DEFAULT '{}',
  asked_at TEXT NOT NULL,
  UNIQUE (question_key, provider, day, run_index)
);

CREATE TABLE ai_mentions (
  id INTEGER PRIMARY KEY,
  answer_id INTEGER NOT NULL REFERENCES ai_answers (id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES businesses (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  matched_by TEXT NOT NULL,
  confirmed INTEGER
);
CREATE INDEX ai_mentions_answer ON ai_mentions (answer_id);
CREATE INDEX ai_mentions_business ON ai_mentions (business_id);

CREATE TABLE ai_question_links (
  business_id INTEGER NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  batch TEXT NOT NULL,
  question_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  PRIMARY KEY (business_id, batch, question_key)
);

CREATE TABLE reviews (
  id INTEGER PRIMARY KEY,
  finding_id INTEGER NOT NULL REFERENCES findings (id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject')),
  note TEXT,
  at TEXT NOT NULL
);

CREATE TABLE exports (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  gates TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE TABLE brand_packs (
  business_id INTEGER PRIMARY KEY REFERENCES businesses (id) ON DELETE CASCADE,
  logo_path TEXT,
  logo_source_url TEXT,
  colors TEXT NOT NULL DEFAULT '[]',
  fonts TEXT NOT NULL DEFAULT '{}',
  hero_images TEXT NOT NULL DEFAULT '[]',
  hero_path TEXT,
  voice_samples TEXT NOT NULL DEFAULT '[]',
  captured_at TEXT NOT NULL
);

CREATE TABLE listings (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  prices TEXT NOT NULL DEFAULT '[]',
  rating REAL,
  review_count INTEGER,
  fetched_at TEXT NOT NULL,
  UNIQUE (business_id, url)
);

CREATE TABLE ledger (
  id INTEGER PRIMARY KEY,
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  units TEXT NOT NULL DEFAULT '{}',
  estimated_usd REAL NOT NULL,
  actual_usd REAL,
  at TEXT NOT NULL
);

CREATE TABLE kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  at TEXT NOT NULL
);
