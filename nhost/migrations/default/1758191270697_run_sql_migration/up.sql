-- as a user that has CREATE on schema public
create or replace view public.users_public as
select id, display_name, avatar_url, created_at
from auth.users;
