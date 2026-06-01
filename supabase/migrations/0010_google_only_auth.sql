-- Email/password signup has been removed from the app. Drop the pre-auth
-- validator that only existed for the old email signup form, and make profile
-- creation safe for Google-derived emails and metadata.
drop function if exists public.validate_user_signup(text, text);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  base_username text;
  desired text;
  fname text;
  avatar text;
begin
  base_username := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    'user'
  );

  desired := lower(regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g'));
  if length(desired) < 3 then
    desired := 'user' || left(replace(new.id::text, '-', ''), 8);
  end if;
  desired := left(desired, 24);

  fname := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', '')
  );
  avatar := coalesce(
    nullif(new.raw_user_meta_data->>'avatar_url', ''),
    nullif(new.raw_user_meta_data->>'picture', '')
  );

  begin
    insert into public.profiles (id, username, full_name, avatar_url)
    values (new.id, desired, fname, avatar);
  exception when unique_violation then
    insert into public.profiles (id, username, full_name, avatar_url)
    values (
      new.id,
      left(desired, 20) || lpad(floor(random() * 10000)::int::text, 4, '0'),
      fname,
      avatar
    )
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;
alter function public.handle_new_user owner to postgres;
