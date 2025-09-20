CREATE TABLE "public"."contribution_reactions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "contribution_id" uuid NOT NULL, "user_id" uuid NOT NULL, "type" text NOT NULL, PRIMARY KEY ("contribution_id","user_id","type") , FOREIGN KEY ("type") REFERENCES "public"."reaction_types"("type") ON UPDATE no action ON DELETE cascade, FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON UPDATE no action ON DELETE cascade, FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE no action ON DELETE cascade);
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
CREATE TRIGGER "set_public_contribution_reactions_updated_at"
BEFORE UPDATE ON "public"."contribution_reactions"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_public_contribution_reactions_updated_at" ON "public"."contribution_reactions"
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
