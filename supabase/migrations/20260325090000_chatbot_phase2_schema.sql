begin;

create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.current_anon_session_id()
returns uuid
language sql
stable
as $$
  select nullif((auth.jwt() ->> 'anon_session_id'), '')::uuid;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anon_session_id uuid,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  anon_session_id uuid,
  role text not null,
  content text not null,
  status text not null default 'complete',
  model text,
  token_count integer,
  created_at timestamptz not null default now()
);

alter table public.messages
  add constraint messages_role_check check (role in ('user', 'assistant', 'system'));

alter table public.messages
  add constraint messages_status_check check (status in ('streaming', 'complete', 'error'));

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  anon_session_id uuid,
  kind text not null,
  path text not null,
  mime_type text,
  size_bytes bigint,
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.attachments
  add constraint attachments_kind_check check (kind in ('image', 'file'));

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anon_session_id uuid,
  chat_id uuid references public.chats(id) on delete cascade,
  name text not null,
  path text not null,
  status text not null default 'uploaded',
  chunk_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents
  add constraint documents_status_check check (status in ('uploaded', 'processing', 'ready', 'failed'));

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anon_session_id uuid,
  kind text not null,
  created_at timestamptz not null default now()
);

alter table public.usage_events
  add constraint usage_events_kind_check check (kind in ('guest_message', 'authenticated_message'));

drop trigger if exists trg_chats_updated_at on public.chats;
create trigger trg_chats_updated_at
before update on public.chats
for each row execute function public.set_updated_at();

drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create index if not exists chats_user_last_message_idx
  on public.chats(user_id, last_message_at desc);

create index if not exists chats_anon_last_message_idx
  on public.chats(anon_session_id, last_message_at desc);

create index if not exists messages_chat_created_idx
  on public.messages(chat_id, created_at asc);

create index if not exists attachments_chat_message_idx
  on public.attachments(chat_id, message_id);

create index if not exists documents_user_chat_created_idx
  on public.documents(user_id, chat_id, created_at desc);

create index if not exists documents_anon_chat_created_idx
  on public.documents(anon_session_id, chat_id, created_at desc);

create index if not exists document_chunks_document_idx
  on public.document_chunks(document_id, chunk_index asc);

create index if not exists usage_events_user_kind_created_idx
  on public.usage_events(user_id, kind, created_at desc);

create index if not exists usage_events_anon_kind_created_idx
  on public.usage_events(anon_session_id, kind, created_at desc);

create index if not exists document_chunks_embedding_ivfflat_idx
  on public.document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.attachments enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists chats_select_own on public.chats;
create policy chats_select_own
  on public.chats
  for select
  using (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

drop policy if exists chats_modify_own on public.chats;
create policy chats_modify_own
  on public.chats
  for insert
  with check (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

drop policy if exists chats_update_own on public.chats;
create policy chats_update_own
  on public.chats
  for update
  using (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  )
  with check (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

drop policy if exists chats_delete_own on public.chats;
create policy chats_delete_own
  on public.chats
  for delete
  using (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

drop policy if exists messages_select_own on public.messages;
create policy messages_select_own
  on public.messages
  for select
  using (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

drop policy if exists messages_insert_own on public.messages;
create policy messages_insert_own
  on public.messages
  for insert
  with check (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

drop policy if exists messages_update_own on public.messages;
create policy messages_update_own
  on public.messages
  for update
  using (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  )
  with check (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own
  on public.messages
  for delete
  using (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

drop policy if exists attachments_select_own on public.attachments;
create policy attachments_select_own
  on public.attachments
  for select
  using (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

drop policy if exists attachments_insert_own on public.attachments;
create policy attachments_insert_own
  on public.attachments
  for insert
  with check (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

drop policy if exists attachments_update_own on public.attachments;
create policy attachments_update_own
  on public.attachments
  for update
  using (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  )
  with check (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

drop policy if exists attachments_delete_own on public.attachments;
create policy attachments_delete_own
  on public.attachments
  for delete
  using (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

drop policy if exists documents_select_own on public.documents;
create policy documents_select_own
  on public.documents
  for select
  using (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

drop policy if exists documents_insert_own on public.documents;
create policy documents_insert_own
  on public.documents
  for insert
  with check (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

drop policy if exists documents_update_own on public.documents;
create policy documents_update_own
  on public.documents
  for update
  using (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  )
  with check (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

drop policy if exists documents_delete_own on public.documents;
create policy documents_delete_own
  on public.documents
  for delete
  using (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

drop policy if exists chunks_select_own on public.document_chunks;
create policy chunks_select_own
  on public.document_chunks
  for select
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_id
        and (
          (d.user_id is not null and d.user_id = auth.uid())
          or (d.user_id is null and d.anon_session_id = public.current_anon_session_id())
        )
    )
  );

drop policy if exists chunks_insert_own on public.document_chunks;
create policy chunks_insert_own
  on public.document_chunks
  for insert
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_id
        and (
          (d.user_id is not null and d.user_id = auth.uid())
          or (d.user_id is null and d.anon_session_id = public.current_anon_session_id())
        )
    )
  );

drop policy if exists chunks_update_own on public.document_chunks;
create policy chunks_update_own
  on public.document_chunks
  for update
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_id
        and (
          (d.user_id is not null and d.user_id = auth.uid())
          or (d.user_id is null and d.anon_session_id = public.current_anon_session_id())
        )
    )
  )
  with check (
    exists (
      select 1 from public.documents d
      where d.id = document_id
        and (
          (d.user_id is not null and d.user_id = auth.uid())
          or (d.user_id is null and d.anon_session_id = public.current_anon_session_id())
        )
    )
  );

drop policy if exists chunks_delete_own on public.document_chunks;
create policy chunks_delete_own
  on public.document_chunks
  for delete
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_id
        and (
          (d.user_id is not null and d.user_id = auth.uid())
          or (d.user_id is null and d.anon_session_id = public.current_anon_session_id())
        )
    )
  );

drop policy if exists usage_select_own on public.usage_events;
create policy usage_select_own
  on public.usage_events
  for select
  using (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

drop policy if exists usage_insert_own on public.usage_events;
create policy usage_insert_own
  on public.usage_events
  for insert
  with check (
    (user_id is not null and user_id = auth.uid())
    or (user_id is null and anon_session_id = public.current_anon_session_id())
  );

commit;

