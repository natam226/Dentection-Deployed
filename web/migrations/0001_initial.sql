CREATE TABLE IF NOT EXISTS professionals (
  id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS studies (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES professionals(id), filename TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready')),
  mime_type TEXT NOT NULL, size INTEGER NOT NULL CHECK(size > 0 AND size <= 5242880),
  width INTEGER NOT NULL, height INTEGER NOT NULL, image_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL, model_version TEXT NOT NULL, parameters TEXT NOT NULL,
  detections TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS studies_owner_date ON studies(owner_id, created_at DESC);
CREATE TABLE IF NOT EXISTS upload_counts (
  day TEXT NOT NULL, owner_id TEXT NOT NULL, uploads INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day,owner_id)
);
CREATE TRIGGER IF NOT EXISTS study_capacity BEFORE INSERT ON studies
WHEN NOT EXISTS (SELECT 1 FROM studies WHERE id=NEW.id)
BEGIN
  SELECT CASE WHEN (SELECT COALESCE(SUM(size),0) FROM studies)+NEW.size > 524288000
    THEN RAISE(ABORT,'storage_limit') END;
  SELECT CASE WHEN (SELECT COALESCE(SUM(uploads),0) FROM upload_counts WHERE day=date('now')) >= 200
    THEN RAISE(ABORT,'daily_limit') END;
  SELECT CASE WHEN (SELECT COALESCE(SUM(uploads),0) FROM upload_counts WHERE owner_id=NEW.owner_id AND day=date('now')) >= 50
    THEN RAISE(ABORT,'daily_limit') END;
  INSERT INTO upload_counts(day,owner_id,uploads) VALUES(date('now'),NEW.owner_id,1) ON CONFLICT(day,owner_id) DO UPDATE SET uploads=uploads+1;
END;
