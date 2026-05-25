-- 0009_validate_user_signup_rpc.sql
-- The signup page calls this RPC before creating an auth user. Keep it
-- available to anon users because signup happens before authentication.

drop function if exists public.validate_user_signup(text, text);

create or replace function public.validate_user_signup(
  email text,
  password text
)
returns json
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(coalesce(email, '')));
  v_password text := coalesce(password, '');
  v_errors text[] := array[]::text[];
begin
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    v_errors := array_append(v_errors, 'Please enter a valid email address.');
  end if;

  if length(v_password) < 8 then
    v_errors := array_append(v_errors, 'Password must be at least 8 characters.');
  end if;

  if v_password !~ '[a-z]' then
    v_errors := array_append(v_errors, 'Password must include a lowercase letter.');
  end if;

  if v_password !~ '[A-Z]' then
    v_errors := array_append(v_errors, 'Password must include an uppercase letter.');
  end if;

  if v_password !~ '[0-9]' then
    v_errors := array_append(v_errors, 'Password must include a number.');
  end if;

  if lower(v_password) = any(array[
    'password',
    'password123',
    '123456789',
    'qwerty123',
    'admin123',
    'letmein123',
    'welcome123',
    'password1',
    'abc123456',
    '123456abc',
    'passw0rd',
    'p@ssw0rd'
  ]) then
    v_errors := array_append(
      v_errors,
      'This password is too common. Please choose a more unique password.'
    );
  end if;

  return json_build_object(
    'valid', cardinality(v_errors) = 0,
    'errors', v_errors
  );
end;
$$;

revoke execute on function public.validate_user_signup(text, text) from public;
grant execute on function public.validate_user_signup(text, text) to anon, authenticated;
