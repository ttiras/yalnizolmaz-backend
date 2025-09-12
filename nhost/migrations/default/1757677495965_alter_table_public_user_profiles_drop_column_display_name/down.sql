alter table "public"."user_profiles" alter column "display_name" drop not null;
alter table "public"."user_profiles" add column "display_name" text;
