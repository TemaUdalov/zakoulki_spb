-- Схема базы для «Закоулков Петербурга».
-- Выполни целиком в Supabase: SQL Editor → New query → вставить → Run.

-- ─── Таблица мест ────────────────────────────────────────────────────────────
create table if not exists public.places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  tags        text[] not null default '{}'
              check (tags <@ array['courtyard', 'street-art', 'view', 'architecture', 'detail', 'nature', 'atmosphere']),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  photos      text[] not null check (cardinality(photos) between 1 and 3),
  created_at  timestamptz not null default now()
);

create index if not exists places_created_at_idx on public.places (created_at desc);
create index if not exists places_user_id_idx on public.places (user_id);

-- ─── Права доступа (Row Level Security) ──────────────────────────────────────
-- Без RLS любой, у кого есть публичный ключ, мог бы менять чужие записи.
alter table public.places enable row level security;

drop policy if exists "Места видны всем" on public.places;
create policy "Места видны всем"
  on public.places for select
  using (true);

drop policy if exists "Добавлять места могут вошедшие" on public.places;
create policy "Добавлять места могут вошедшие"
  on public.places for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Удалять можно только свои места" on public.places;
create policy "Удалять можно только свои места"
  on public.places for delete to authenticated
  using (auth.uid() = user_id);

-- ─── Защита от спама: не больше 10 мест в сутки на пользователя ─────────────
create or replace function public.limit_places_per_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.places
    where user_id = new.user_id and created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'Можно добавить не больше 10 мест в сутки';
  end if;
  return new;
end;
$$;

drop trigger if exists places_rate_limit on public.places;
create trigger places_rate_limit
  before insert on public.places
  for each row execute function public.limit_places_per_day();

-- ─── Хранилище фото ──────────────────────────────────────────────────────────
-- Публичный бакет: фото открываются по прямой ссылке. Только JPEG до 5 МБ
-- (приложение само сжимает фото в JPEG перед загрузкой).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-photos', 'place-photos', true, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "Фото мест видны всем" on storage.objects;
create policy "Фото мест видны всем"
  on storage.objects for select
  using (bucket_id = 'place-photos');

-- Файлы лежат в папках вида <user_id>/<uuid>.jpg — писать можно только в свою
drop policy if exists "Загрузка фото в свою папку" on storage.objects;
create policy "Загрузка фото в свою папку"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'place-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Удаление своих фото" on storage.objects;
create policy "Удаление своих фото"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'place-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
