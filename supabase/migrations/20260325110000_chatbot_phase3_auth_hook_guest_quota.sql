begin;


create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  anon_id text;
begin
  claims := event->'claims';

  anon_id := coalesce(
    (event->'claims'->'user_metadata'->>'anon_session_id'),
    (event->'claims'->'app_metadata'->>'anon_session_id'),
    (event->'user'->'user_metadata'->>'anon_session_id'),
    (event->'user'->'app_metadata'->>'anon_session_id')
  );

  if anon_id is not null and anon_id <> '' then
    claims := jsonb_set(claims, '{anon_session_id}', to_jsonb(anon_id), true);
  end if;

  return jsonb_build_object('claims', claims);
end;
$$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

create or replace function public.get_guest_remaining_questions(max_questions integer)
returns integer
language plpgsql
stable
as $$
declare
  anon_id uuid := public.current_anon_session_id();
  used integer;
begin
  if anon_id is null then
    return 0;
  end if;

  select count(*) into used
  from public.usage_events
  where user_id is null
    and anon_session_id = anon_id
    and kind = 'guest_message';

  return greatest(0, max_questions - used);
end;
$$;

create or replace function public.consume_guest_message(max_questions integer)
returns table(allowed boolean, remaining integer)
language plpgsql
as $$
declare
  anon_id uuid := public.current_anon_session_id();
  used integer;
  remaining_calc integer;
begin
  if anon_id is null then
    allowed := false;
    remaining := 0;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext(anon_id::text));

  select count(*) into used
  from public.usage_events
  where user_id is null
    and anon_session_id = anon_id
    and kind = 'guest_message';

  if used < max_questions then
    insert into public.usage_events (user_id, anon_session_id, kind)
    values (null, anon_id, 'guest_message');

    allowed := true;
  else
    allowed := false;
  end if;

  remaining_calc := max_questions - used - case when allowed then 1 else 0 end;
  remaining := greatest(0, remaining_calc);
  return;
end;
$$;

grant execute on function public.get_guest_remaining_questions(integer) to authenticated, anon, public;
grant execute on function public.consume_guest_message(integer) to authenticated, anon, public;

commit;

