-- =====================================================================
-- LugunaVoice — Supabase setup (run once, after `pnpm db:migrate`)
-- Creates: RLS policies, profile auto-create trigger, storage bucket.
-- Schema tables are created by Drizzle migrations (drizzle/).
-- =====================================================================

-- -------------------------------------------------------------
-- 1. Auto-create profile row on signup
-- -------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, referral_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'lug-' || substr(md5(new.id::text || random()::text), 1, 10)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -------------------------------------------------------------
-- 2. Enable RLS everywhere (tables created by drizzle)
-- -------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.api_keys enable row level security;
alter table public.user_limits enable row level security;
alter table public.voices enable row level security;
alter table public.voice_favorites enable row level security;
alter table public.generations enable row level security;
alter table public.generations_chunks enable row level security;
alter table public.generation_dedup enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.credit_orders enable row level security;
alter table public.subscriptions enable row level security;
alter table public.cloned_voice_consents enable row level security;
alter table public.clone_slot_tracking enable row level security;
alter table public.transcriptions enable row level security;
alter table public.app_events enable row level security;

-- Abuse/monitoring tables: NO client access (service role only)
alter table public.fingerprints enable row level security;
alter table public.abuse_flags enable row level security;
alter table public.bans enable row level security;
alter table public.moderation_log enable row level security;
alter table public.ip_sessions enable row level security;
alter table public.rate_limit_buckets enable row level security;
alter table public.provider_usage_daily enable row level security;

-- -------------------------------------------------------------
-- 3. RLS policies
-- -------------------------------------------------------------

-- profiles: owner only
create policy "profiles_select_own" on public.profiles for select
  using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id);

-- api_keys: owner only (key_hash is never returned by our API anyway)
create policy "api_keys_select_own" on public.api_keys for select
  using (auth.uid() = user_id);
create policy "api_keys_insert_own" on public.api_keys for insert
  with check (auth.uid() = user_id);
create policy "api_keys_delete_own" on public.api_keys for delete
  using (auth.uid() = user_id);

-- user_limits: owner read
create policy "user_limits_select_own" on public.user_limits for select
  using (auth.uid() = user_id);

-- voices: public read, custom voices owner-only
create policy "voices_select_public" on public.voices for select
  using (owner_user_id is null or owner_user_id = auth.uid());

-- voice_favorites: owner
create policy "voice_favorites_select_own" on public.voice_favorites for select
  using (auth.uid() = user_id);
create policy "voice_favorites_insert_own" on public.voice_favorites for insert
  with check (auth.uid() = user_id);
create policy "voice_favorites_delete_own" on public.voice_favorites for delete
  using (auth.uid() = user_id);

-- generations: owner read + insert own
create policy "generations_select_own" on public.generations for select
  using (auth.uid() = user_id);
create policy "generations_insert_own" on public.generations for insert
  with check (auth.uid() = user_id);

-- generations_chunks: owner (via generation)
create policy "generations_chunks_select_own" on public.generations_chunks for select
  using (auth.uid() in (
    select user_id from public.generations where id = generation_id
  ));

-- credit_ledger / credit_orders / subscriptions: owner read
create policy "credit_ledger_select_own" on public.credit_ledger for select
  using (auth.uid() = user_id);
create policy "credit_orders_select_own" on public.credit_orders for select
  using (auth.uid() = user_id);
create policy "subscriptions_select_own" on public.subscriptions for select
  using (auth.uid() = user_id);

-- cloned_voice_consents: owner read (immutable)
create policy "clone_consents_select_own" on public.cloned_voice_consents for select
  using (auth.uid() = user_id);

-- clone_slot_tracking: owner read
create policy "clone_slots_select_own" on public.clone_slot_tracking for select
  using (auth.uid() = user_id);

-- transcriptions: owner
create policy "transcriptions_select_own" on public.transcriptions for select
  using (auth.uid() = user_id);
create policy "transcriptions_insert_own" on public.transcriptions for insert
  with check (auth.uid() = user_id);

-- app_events: anonymous insert only (no PII), no read
create policy "app_events_insert_anon" on public.app_events for insert
  with check (true);

-- -------------------------------------------------------------
-- 4. Storage bucket for generated audio (private per user)
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

create policy "audio_select_own" on storage.objects for select
  using (bucket_id = 'audio' and owner = auth.uid());
create policy "audio_insert_own" on storage.objects for insert
  with check (bucket_id = 'audio' and owner = auth.uid());
