CREATE TABLE "public"."contributions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "blog_slug" text NOT NULL, "type" text NOT NULL, "title" text NOT NULL, "year" integer, "note" text, "poster_url" text, "source_url" text, "external_id" text, "submitted_by" uuid NOT NULL, "status" text NOT NULL DEFAULT 'approved', PRIMARY KEY ("id") , FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON UPDATE no action ON DELETE set null);
CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "set_public_contributions_updated_at"
BEFORE UPDATE ON "public"."contributions"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_public_contributions_updated_at" ON "public"."contributions"
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
