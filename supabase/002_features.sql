-- Миграция 002: профили, лайки и «я тут был», комментарии, редактирование,
-- поиск «рядом со мной» через PostGIS.
-- Выполни целиком в Supabase: SQL Editor → New query → вставить → Run.
-- Скрипт можно запускать повторно — он ничего не сломает.

create extension if not exists postgis with schema extensions;

-- ─── 1. Профили ──────────────────────────────────────────────────────────────
-- Публичное имя автора. Почту никому не показываем.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Профили видны всем" on public.profiles;
create policy "Профили видны всем"
  on public.profiles for select
  using (true);

drop policy if exists "Менять можно только свой профиль" on public.profiles;
create policy "Менять можно только свой профиль"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Менять разрешено только имя
revoke update on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Профиль создаётся автоматически при регистрации
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, 'Исследователь ' || substr(new.id::text, 1, 4))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Профили для тех, кто зарегистрировался до этой миграции
insert into public.profiles (id, display_name)
select id, 'Исследователь ' || substr(id::text, 1, 4) from auth.users
on conflict (id) do nothing;

-- ─── 2. Места: координаты для PostGIS и редактирование ───────────────────────
alter table public.places add column if not exists updated_at timestamptz;
alter table public.places add column if not exists location extensions.geography(Point, 4326);

-- Заполняем location для уже добавленных мест (до создания триггера ниже)
update public.places
set location = extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
where location is null;

-- Пространственный индекс: поиск «в радиусе N метров» не перебирает всю таблицу
create index if not exists places_location_idx on public.places using gist (location);

-- Перед каждой записью: проверяем пути к фото, пересчитываем location,
-- при редактировании запрещаем менять автора и дату создания
create or replace function public.places_before_write()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if exists (
    select 1 from unnest(new.photos) as ph
    where ph not like new.user_id::text || '/%' or ph like '%..%'
  ) then
    raise exception 'Недопустимый путь к фото';
  end if;

  new.location := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;

  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists places_before_write on public.places;
create trigger places_before_write
  before insert or update on public.places
  for each row execute function public.places_before_write();

drop policy if exists "Редактировать можно только свои места" on public.places;
create policy "Редактировать можно только свои места"
  on public.places for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Редактировать можно только содержательные поля
revoke update on public.places from anon, authenticated;
grant update (title, description, tags, lat, lng, photos) on public.places to authenticated;

-- ─── 3. Лайки и «я тут был» ─────────────────────────────────────────────────
create table if not exists public.place_reactions (
  place_id   uuid not null references public.places (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('like', 'visited')),
  created_at timestamptz not null default now(),
  primary key (place_id, user_id, kind)  -- один лайк от человека на место
);

create index if not exists place_reactions_place_idx
  on public.place_reactions (place_id, kind, created_at);
create index if not exists place_reactions_user_idx on public.place_reactions (user_id);

alter table public.place_reactions enable row level security;

drop policy if exists "Реакции видны всем" on public.place_reactions;
create policy "Реакции видны всем"
  on public.place_reactions for select
  using (true);

drop policy if exists "Ставить реакции могут вошедшие" on public.place_reactions;
create policy "Ставить реакции могут вошедшие"
  on public.place_reactions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Снимать можно только свои реакции" on public.place_reactions;
create policy "Снимать можно только свои реакции"
  on public.place_reactions for delete to authenticated
  using (auth.uid() = user_id);

-- ─── 4. Комментарии ──────────────────────────────────────────────────────────
-- user_id ссылается на profiles — так можно одним запросом получить имя автора
create table if not exists public.place_comments (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references public.places (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 2 and 500),
  created_at timestamptz not null default now()
);

create index if not exists place_comments_place_idx on public.place_comments (place_id, created_at);

alter table public.place_comments enable row level security;

drop policy if exists "Комментарии видны всем" on public.place_comments;
create policy "Комментарии видны всем"
  on public.place_comments for select
  using (true);

drop policy if exists "Комментировать могут вошедшие" on public.place_comments;
create policy "Комментировать могут вошедшие"
  on public.place_comments for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Удалять можно только свои комментарии" on public.place_comments;
create policy "Удалять можно только свои комментарии"
  on public.place_comments for delete to authenticated
  using (auth.uid() = user_id);

-- Защита от спама: не больше 30 комментариев в сутки
create or replace function public.limit_comments_per_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.place_comments
    where user_id = new.user_id and created_at > now() - interval '1 day'
  ) >= 30 then
    raise exception 'Можно оставить не больше 30 комментариев в сутки';
  end if;
  return new;
end;
$$;

drop trigger if exists comments_rate_limit on public.place_comments;
create trigger comments_rate_limit
  before insert on public.place_comments
  for each row execute function public.limit_comments_per_day();

-- ─── 5. Лента мест со счётчиками ─────────────────────────────────────────────
-- security_invoker: представление подчиняется тем же правилам RLS, что и таблицы
create or replace view public.places_feed
with (security_invoker = true)
as
select
  p.id,
  p.user_id,
  p.title,
  p.description,
  p.tags,
  p.lat,
  p.lng,
  p.photos,
  p.created_at,
  p.updated_at,
  coalesce(pr.display_name, 'Аноним') as author_name,
  r.likes_count,
  r.likes_week,
  r.visited_count,
  c.comments_count
from public.places p
left join public.profiles pr on pr.id = p.user_id
left join lateral (
  select
    count(*) filter (where kind = 'like')::int as likes_count,
    count(*) filter (where kind = 'like' and created_at > now() - interval '7 days')::int as likes_week,
    count(*) filter (where kind = 'visited')::int as visited_count
  from public.place_reactions
  where place_id = p.id
) r on true
left join lateral (
  select count(*)::int as comments_count
  from public.place_comments
  where place_id = p.id
) c on true;

-- ─── 6. Поиск мест рядом ─────────────────────────────────────────────────────
-- Возвращает места в радиусе p_radius метров (не больше 5 км), ближайшие первыми
create or replace function public.places_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius double precision default 1000
)
returns table (id uuid, distance_m double precision)
language sql
stable
set search_path = public, extensions
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  )
  select p.id, st_distance(p.location, origin.g) as distance_m
  from public.places p, origin
  where st_dwithin(p.location, origin.g, least(p_radius, 5000))
  order by distance_m
  limit 100;
$$;
