-- Incolla tutto in Supabase > SQL Editor > Run

create table photos (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  category text not null check (category in ('festa','nel-tempo')),
  author text check (char_length(author) <= 40),
  votes int not null default 0,
  created_at timestamptz not null default now()
);

create table letters (
  id uuid primary key default gen_random_uuid(),
  author text check (char_length(author) <= 40),
  body text not null check (char_length(body) between 1 and 600),
  created_at timestamptz not null default now()
);

alter table photos  enable row level security;
alter table letters enable row level security;

create policy "leggi foto"     on photos  for select using (true);
create policy "carica foto"    on photos  for insert with check (votes = 0);
create policy "leggi lettere"  on letters for select using (true);
create policy "scrivi lettere" on letters for insert with check (true);

-- il voto passa da qui, così nessuno può modificare le foto a mano
create function vote_photo(photo_id uuid) returns void
language sql security definer set search_path = public as
$$ update photos set votes = votes + 1 where id = photo_id $$;
grant execute on function vote_photo(uuid) to anon;

-- bucket pubblico per le foto, max 5 MB, solo immagini
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg','image/png','image/webp']);

create policy "carica nel bucket" on storage.objects
  for insert to anon with check (bucket_id = 'photos');
