alter table "public"."messages"
  add constraint "messages_recipient_id_fkey"
  foreign key ("recipient_id")
  references "auth"."users"
  ("id") on update no action on delete set null;
