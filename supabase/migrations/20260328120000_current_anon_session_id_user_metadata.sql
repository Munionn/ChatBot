begin;

create or replace function public.current_anon_session_id()
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v text;
begin
  v := nullif(trim(auth.jwt() ->> 'anon_session_id'), '');
  if v is not null then
    return v::uuid;
  end if;

  v := nullif(trim(auth.jwt() -> 'user_metadata' ->> 'anon_session_id'), '');
  if v is not null then
    return v::uuid;
  end if;

  v := nullif(trim(auth.jwt() -> 'app_metadata' ->> 'anon_session_id'), '');
  if v is not null then
    return v::uuid;
  end if;

  return null;
end;
$$;

commit;
