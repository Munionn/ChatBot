begin;

create or replace function public.auth_anon_session_uuid()
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  j jsonb := auth.jwt();
  v text;
  um jsonb;
begin
  if j is null then
    return null;
  end if;

  v := nullif(btrim(j ->> 'anon_session_id'), '');
  if v is not null then
    begin
      return v::uuid;
    exception
      when invalid_text_representation then null;
    end;
  end if;

  um := j -> 'user_metadata';
  if um is not null and jsonb_typeof(um) = 'string' then
    begin
      um := (um #>> '{}')::jsonb;
    exception
      when others then
        um := null;
    end;
  end if;

  if um is not null and jsonb_typeof(um) = 'object' then
    v := nullif(btrim(um ->> 'anon_session_id'), '');
    if v is not null then
      begin
        return v::uuid;
      exception
        when invalid_text_representation then null;
      end;
    end if;
  end if;

  v := nullif(btrim(j -> 'app_metadata' ->> 'anon_session_id'), '');
  if v is not null then
    begin
      return v::uuid;
    exception
      when invalid_text_representation then null;
    end;
  end if;

  return null;
end;
$$;

create or replace function public.current_anon_session_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select public.auth_anon_session_uuid();
$$;

create or replace function public.get_guest_remaining_questions(max_questions integer)
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  anon_id uuid := public.auth_anon_session_uuid();
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
set search_path = public
as $$
declare
  anon_id uuid := public.auth_anon_session_uuid();
  used integer;
  remaining_calc integer;
begin
  if anon_id is null then
    allowed := false;
    remaining := 0;
    return next;
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
  return next;
end;
$$;

commit;
