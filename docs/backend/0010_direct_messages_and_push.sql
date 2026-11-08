-- 0010: in-app direct messages and push notification delivery
-- Project: wywynljwiqowirhrqsfz (shared by the Android app and the web command centre)
--
-- Run once in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/wywynljwiqowirhrqsfz/sql/new
-- It is safe to run again (every step is "if not exists" / "or replace").
--
-- What it adds
--   1. direct_messages: messages between two users. Only the sender and the
--      recipient can read a message; only the recipient can mark it read.
--   2. A notification for the recipient of every message, so it shows in the
--      bell and the Notifications screen.
--   3. push_tokens: each phone's Expo push token, kept per user.
--   4. Push delivery: every new row in notifications (messages, bookings,
--      device orders, ...) is sent to the user's phones through Expo's push
--      service, using pg_net (already enabled in this project).
--   5. get_message_contacts(): the people a user can message, name and role only.

-- 1. Direct messages -----------------------------------------------------------
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  sender_name text,
  body text not null check (length(btrim(body)) > 0 and length(body) <= 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists direct_messages_recipient_idx on public.direct_messages (recipient_id, created_at desc);
create index if not exists direct_messages_sender_idx on public.direct_messages (sender_id, created_at desc);

alter table public.direct_messages enable row level security;

drop policy if exists "Read own messages" on public.direct_messages;
create policy "Read own messages" on public.direct_messages
  for select to authenticated using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Send as yourself" on public.direct_messages;
create policy "Send as yourself" on public.direct_messages
  for insert to authenticated with check (sender_id = auth.uid() and recipient_id <> auth.uid());

drop policy if exists "Recipient marks read" on public.direct_messages;
create policy "Recipient marks read" on public.direct_messages
  for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

grant select, insert, update on public.direct_messages to authenticated;

-- Live updates in an open conversation.
do $$
begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null;
end $$;

-- 2. A notification for the recipient ------------------------------------------
create or replace function public.notify_direct_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, title, body, link, metadata)
  values (
    new.recipient_id,
    'message',
    'Message from ' || coalesce(nullif(btrim(new.sender_name), ''), 'a Ngaren user'),
    left(new.body, 200),
    '/messages/' || new.sender_id,
    jsonb_build_object('message_id', new.id, 'sender_id', new.sender_id, 'sender_name', new.sender_name)
  );
  return new;
end $$;

drop trigger if exists direct_messages_notify on public.direct_messages;
create trigger direct_messages_notify after insert on public.direct_messages
  for each row execute function public.notify_direct_message();

-- 3. Push tokens -----------------------------------------------------------------
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;

drop policy if exists "Own push tokens" on public.push_tokens;
create policy "Own push tokens" on public.push_tokens
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A phone's token moves to whoever signs in on it.
create or replace function public.register_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_token is null or p_token = '' then
    return;
  end if;
  delete from public.push_tokens where token = p_token;
  insert into public.push_tokens (token, user_id, platform, updated_at) values (p_token, auth.uid(), p_platform, now());
end $$;
grant execute on function public.register_push_token(text, text) to authenticated;

-- Sign-out removes this phone's token.
create or replace function public.unregister_push_token(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;
grant execute on function public.unregister_push_token(text) to authenticated;

-- 4. Push delivery for every notification -------------------------------------------
create or replace function public.push_new_notification()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  messages jsonb;
begin
  select jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', new.title,
           'body', new.body,
           'sound', 'default',
           'channelId', 'alerts',
           'priority', 'high',
           'data', jsonb_build_object('type', new.type, 'link', new.link, 'notificationId', new.id) || coalesce(new.metadata, '{}'::jsonb)
         ))
    into messages
    from public.push_tokens t
   where t.user_id = new.user_id;
  if messages is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := messages,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json')
    );
  end if;
  return new;
exception when others then
  -- A push that can't be sent never blocks the notification itself.
  return new;
end $$;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications
  for each row execute function public.push_new_notification();

-- 5. Who can be messaged ------------------------------------------------------------
create or replace function public.get_message_contacts()
returns table (user_id uuid, full_name text, role text)
language sql stable security definer set search_path = public as $$
  select p.user_id,
         coalesce(nullif(btrim(p.full_name), ''), p.email, 'Ngaren user') as full_name,
         (select string_agg(r.role::text, ',') from public.user_roles r where r.user_id = p.user_id) as role
    from public.profiles p
   where auth.uid() is not null
     and p.user_id <> auth.uid();
$$;
grant execute on function public.get_message_contacts() to authenticated;

notify pgrst, 'reload schema';
