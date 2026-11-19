-- Pendientes de Casa: tablas, permisos, tiempo real y almacenamiento de fotos.
-- Pegar completo en Supabase > SQL Editor > New query > Run.

create extension if not exists pgcrypto;

create table if not exists public.miembros (
  id uuid primary key references auth.users on delete cascade,
  alias text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.casos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  descr text not null default '',
  cat text not null default 'Otros',
  prio text not null default 'media',
  due date,
  money_type text not null default '',
  amount numeric,
  money_note text not null default '',
  status text not null default 'abierto',
  result text not null default '',
  cover text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.puntos (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos on delete cascade,
  text text not null,
  orden int not null default 0,
  assignee text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  done boolean not null default false,
  done_by uuid,
  done_at timestamptz
);

create table if not exists public.respuestas (
  id uuid primary key default gen_random_uuid(),
  punto_id uuid not null references public.puntos on delete cascade,
  caso_id uuid not null references public.casos on delete cascade,
  author uuid default auth.uid(),
  text text not null default '',
  files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.historial (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos on delete cascade,
  author uuid default auth.uid(),
  msg text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.vistos (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  caso_id uuid not null references public.casos on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, caso_id)
);

create index if not exists puntos_caso_idx on public.puntos(caso_id);
create index if not exists respuestas_punto_idx on public.respuestas(punto_id);
create index if not exists historial_caso_idx on public.historial(caso_id);

-- Acceso de la API a las tablas (solo para usuarios con sesión).
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.miembros, public.casos, public.puntos, public.respuestas, public.historial, public.vistos to authenticated;

-- Permisos: solo usuarios con sesión iniciada (ustedes dos) leen y escriben.
alter table public.miembros  enable row level security;
alter table public.casos      enable row level security;
alter table public.puntos     enable row level security;
alter table public.respuestas enable row level security;
alter table public.historial  enable row level security;
alter table public.vistos     enable row level security;

drop policy if exists "familia" on public.miembros;
drop policy if exists "familia" on public.casos;
drop policy if exists "familia" on public.puntos;
drop policy if exists "familia" on public.respuestas;
drop policy if exists "familia" on public.historial;
drop policy if exists "propio" on public.vistos;

create policy "familia" on public.miembros  for all to authenticated using (true) with check (true);
create policy "familia" on public.casos      for all to authenticated using (true) with check (true);
create policy "familia" on public.puntos     for all to authenticated using (true) with check (true);
create policy "familia" on public.respuestas for all to authenticated using (true) with check (true);
create policy "familia" on public.historial  for all to authenticated using (true) with check (true);
create policy "propio"  on public.vistos     for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tiempo real: los cambios llegan al instante al otro teléfono.
do $$
begin
  begin alter publication supabase_realtime add table public.casos;      exception when others then null; end;
  begin alter publication supabase_realtime add table public.puntos;     exception when others then null; end;
  begin alter publication supabase_realtime add table public.respuestas; exception when others then null; end;
  begin alter publication supabase_realtime add table public.historial;  exception when others then null; end;
  begin alter publication supabase_realtime add table public.miembros;   exception when others then null; end;
end $$;

-- Fotos y respaldos (privados: solo ustedes los ven).
insert into storage.buckets (id, name, public, file_size_limit)
values ('respaldos', 'respaldos', false, 20971520)
on conflict (id) do nothing;

drop policy if exists "respaldos leer" on storage.objects;
drop policy if exists "respaldos subir" on storage.objects;
drop policy if exists "respaldos borrar" on storage.objects;
create policy "respaldos leer"   on storage.objects for select to authenticated using (bucket_id = 'respaldos');
create policy "respaldos subir"  on storage.objects for insert to authenticated with check (bucket_id = 'respaldos');
create policy "respaldos borrar" on storage.objects for delete to authenticated using (bucket_id = 'respaldos');
