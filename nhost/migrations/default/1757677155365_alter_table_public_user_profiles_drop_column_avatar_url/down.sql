alter table "public"."user_profiles" alter column "avatar_url" drop not null;
alter table "public"."user_profiles" add column "avatar_url" text;
