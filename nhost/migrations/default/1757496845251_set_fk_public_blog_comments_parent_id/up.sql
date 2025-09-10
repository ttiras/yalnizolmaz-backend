alter table "public"."blog_comments"
  add constraint "blog_comments_parent_id_fkey"
  foreign key ("parent_id")
  references "public"."blog_comments"
  ("id") on update no action on delete cascade;
