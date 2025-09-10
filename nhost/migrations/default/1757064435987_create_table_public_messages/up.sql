CREATE TABLE "public"."messages" ("id" serial NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "sender_id" uuid NOT NULL, "recipient_id" uuid NOT NULL, "body" text NOT NULL, PRIMARY KEY ("id") , FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON UPDATE no action ON DELETE set null);
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
CREATE TRIGGER "set_public_messages_updated_at"
BEFORE UPDATE ON "public"."messages"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_public_messages_updated_at" ON "public"."messages"
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
