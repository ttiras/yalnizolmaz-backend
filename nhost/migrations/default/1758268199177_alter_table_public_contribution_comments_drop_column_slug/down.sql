alter table "public"."contribution_comments" alter column "slug" drop not null;
alter table "public"."contribution_comments" add column "slug" text;
