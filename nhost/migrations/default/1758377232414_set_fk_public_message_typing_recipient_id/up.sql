alter table "public"."message_typing"
  add constraint "message_typing_recipient_id_fkey"
  foreign key ("recipient_id")
  references "auth"."users"
  ("id") on update no action on delete set null;
