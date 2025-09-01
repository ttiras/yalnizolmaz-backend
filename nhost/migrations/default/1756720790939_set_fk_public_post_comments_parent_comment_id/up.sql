alter table "public"."post_comments"
  add constraint "post_comments_parent_comment_id_fkey"
  foreign key ("parent_comment_id")
  references "public"."post_comments"
  ("id") on update no action on delete cascade;
