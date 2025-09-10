alter table "public"."contributions"
  add constraint "contributions_type_fkey"
  foreign key ("type")
  references "public"."contribution_types"
  ("type") on update restrict on delete restrict;
