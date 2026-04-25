create table if not exists public.parent_saves (
  device_id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists parent_saves_updated_at_idx on public.parent_saves (updated_at desc);

alter table public.parent_saves enable row level security;

-- A função Netlify usa a SERVICE ROLE KEY e ignora RLS.
-- Não abra políticas anônimas nesta tabela em produção.

-- Estrutura já preparada para a próxima etapa de conteúdo dinâmico.
create table if not exists public.content_packs (
  id text primary key,
  slug text unique,
  title text not null,
  description text,
  min_age int,
  max_age int,
  is_active boolean not null default true,
  sort_order int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.content_pack_phases (
  id bigint generated always as identity primary key,
  pack_id text not null references public.content_packs(id) on delete cascade,
  phase_id text not null,
  sort_order int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  unique(pack_id, phase_id)
);

create table if not exists public.seasonal_events (
  id text primary key,
  slug text unique,
  title text not null,
  subtitle text,
  emoji text,
  world_key text not null,
  target_completions int not null default 1,
  reward_label text,
  reward_stars int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.parent_weekly_tracks (
  id text primary key,
  slug text unique,
  title text not null,
  age_min int,
  age_max int,
  world_key text,
  is_active boolean not null default true,
  days jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists content_packs_sort_idx on public.content_packs (sort_order, is_active);
create index if not exists content_pack_phases_pack_idx on public.content_pack_phases (pack_id, sort_order);
create index if not exists seasonal_events_active_idx on public.seasonal_events (is_active, starts_at, ends_at);
create index if not exists parent_weekly_tracks_active_idx on public.parent_weekly_tracks (is_active, age_min, age_max);

alter table public.content_packs enable row level security;
alter table public.content_pack_phases enable row level security;
alter table public.seasonal_events enable row level security;
alter table public.parent_weekly_tracks enable row level security;

-- Mantenha políticas públicas fechadas até a etapa de leitura controlada via servidor.


create table if not exists public.catalog_publications (
  id bigint generated always as identity primary key,
  manifest_version int not null default 2,
  counts jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  published_by text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists catalog_publications_created_idx on public.catalog_publications (created_at desc);

alter table public.catalog_publications enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists content_packs_set_updated_at on public.content_packs;
create trigger content_packs_set_updated_at
before update on public.content_packs
for each row execute function public.set_updated_at();

drop trigger if exists seasonal_events_set_updated_at on public.seasonal_events;
create trigger seasonal_events_set_updated_at
before update on public.seasonal_events
for each row execute function public.set_updated_at();

drop trigger if exists parent_weekly_tracks_set_updated_at on public.parent_weekly_tracks;
create trigger parent_weekly_tracks_set_updated_at
before update on public.parent_weekly_tracks
for each row execute function public.set_updated_at();
