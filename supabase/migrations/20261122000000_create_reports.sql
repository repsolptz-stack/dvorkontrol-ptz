create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('pothole', 'ice', 'icicles')),
  status text not null default 'active'
    check (status in ('active', 'in_progress', 'solved', 'rejected')),
  address text not null check (char_length(address) between 1 and 500),
  district_id text not null check (char_length(district_id) between 1 and 80),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy double precision check (accuracy is null or accuracy >= 0),
  complaint_text text not null check (char_length(complaint_text) between 1 and 10000),
  telegram_user_id text not null,
  photo_path text,
  photo_url text,
  resolved_photo_url text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists reports_created_at_idx
  on public.reports (created_at desc);

create index if not exists reports_status_created_at_idx
  on public.reports (status, created_at desc);

create index if not exists reports_district_id_idx
  on public.reports (district_id);

alter table public.reports enable row level security;

-- The browser has no direct table access. Edge Functions use the service role
-- after validating Telegram Web App initData.
revoke all on table public.reports from anon, authenticated;
grant all on table public.reports to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-photos',
  'report-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
