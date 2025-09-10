CREATE TABLE "public"."user_profiles" ("user_id" uuid NOT NULL, "display_name" text NOT NULL, "avatar_url" text NOT NULL, "bio" text NOT NULL, "website" text NOT NULL, "location" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("user_id") , FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE cascade ON DELETE cascade);
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
CREATE TRIGGER "set_public_user_profiles_updated_at"
BEFORE UPDATE ON "public"."user_profiles"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_public_user_profiles_updated_at" ON "public"."user_profiles"
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
