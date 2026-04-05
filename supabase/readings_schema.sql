create extension if not exists "pgcrypto";

create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  systolic integer not null check (systolic >= 70 and systolic <= 260),
  diastolic integer not null check (diastolic >= 40 and diastolic <= 180),
  pulse integer not null check (pulse >= 30 and pulse <= 240),
  created_at timestamptz not null default now()
);

alter table public.readings enable row level security;

create policy "Users can read own readings"
  on public.readings
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own readings"
  on public.readings
  for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own readings"
  on public.readings
  for delete
  using (auth.uid() = user_id);
