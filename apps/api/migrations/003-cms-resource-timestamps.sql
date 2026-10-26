-- CMS adds createdAt/updatedAt to every discovered resource entity.
-- Keep existing UUID IDs and all vector/full-text indexes unchanged.
ALTER TABLE document_chunks ADD COLUMN "updatedAt" timestamptz NOT NULL DEFAULT now();
ALTER TABLE ingestion_jobs ADD COLUMN "updatedAt" timestamptz NOT NULL DEFAULT now();
ALTER TABLE chat_messages ADD COLUMN "updatedAt" timestamptz NOT NULL DEFAULT now();
ALTER TABLE evaluation_runs ADD COLUMN "updatedAt" timestamptz NOT NULL DEFAULT now();

CREATE FUNCTION hub_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER chunks_updated_at BEFORE UPDATE ON document_chunks FOR EACH ROW EXECUTE FUNCTION hub_touch_updated_at();
CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON ingestion_jobs FOR EACH ROW EXECUTE FUNCTION hub_touch_updated_at();
CREATE TRIGGER messages_updated_at BEFORE UPDATE ON chat_messages FOR EACH ROW EXECUTE FUNCTION hub_touch_updated_at();
CREATE TRIGGER evaluations_updated_at BEFORE UPDATE ON evaluation_runs FOR EACH ROW EXECUTE FUNCTION hub_touch_updated_at();
