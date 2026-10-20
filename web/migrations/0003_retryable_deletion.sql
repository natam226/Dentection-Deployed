ALTER TABLE studies ADD COLUMN deletion_pending INTEGER NOT NULL DEFAULT 0 CHECK(deletion_pending IN (0,1,2));
DROP TRIGGER study_capacity;
CREATE TRIGGER study_capacity BEFORE INSERT ON studies
WHEN NOT EXISTS (SELECT 1 FROM studies WHERE id=NEW.id)
BEGIN
  SELECT CASE WHEN (SELECT COALESCE(SUM(size),0) FROM studies WHERE deletion_pending<>2)+NEW.size > 524288000
    THEN RAISE(ABORT,'storage_limit') END;
  SELECT CASE WHEN (SELECT COALESCE(SUM(uploads),0) FROM upload_counts WHERE day=date('now')) >= 200
    THEN RAISE(ABORT,'daily_limit') END;
  SELECT CASE WHEN (SELECT COALESCE(SUM(uploads),0) FROM upload_counts WHERE owner_id=NEW.owner_id AND day=date('now')) >= 50
    THEN RAISE(ABORT,'daily_limit') END;
  INSERT INTO upload_counts(day,owner_id,uploads) VALUES(date('now'),NEW.owner_id,1) ON CONFLICT(day,owner_id) DO UPDATE SET uploads=uploads+1;
END;
