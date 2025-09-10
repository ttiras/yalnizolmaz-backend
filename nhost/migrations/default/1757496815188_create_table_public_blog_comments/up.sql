CREATE TABLE "public"."blog_comments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "blog_slug" text NOT NULL, "user_id" uuid NOT NULL, "body" text NOT NULL, "parent_id" uuid NOT NULL, "is_helpful" integer NOT NULL DEFAULT 0, PRIMARY KEY ("id") , FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE no action ON DELETE set null);
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
CREATE TRIGGER "set_public_blog_comments_updated_at"
BEFORE UPDATE ON "public"."blog_comments"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_public_blog_comments_updated_at" ON "public"."blog_comments"
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
