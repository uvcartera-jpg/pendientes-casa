-- Pendientes de Casa: avisos al celular con ntfy.
-- Pegar completo en Supabase > SQL Editor > New query > Run.

alter table public.miembros add column if not exists ntfy_topic text;

create extension if not exists pg_net with schema extensions;

create or replace function public.avisar_cambio()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_alias text;
  v_caso  text;
  v_total int;
  v_hechos int;
  v_title text;
  v_msg   text;
  v_tags  jsonb := '["blossom"]'::jsonb;
  r record;
begin
  -- Cambios menores que no avisan
  if new.msg like 'editó%' or new.msg like 'reabrió el caso%' then
    return new;
  end if;

  select coalesce(nullif(alias, ''), 'Alguien') into v_alias from miembros where id = new.author;
  v_alias := coalesce(v_alias, 'Alguien');
  select title into v_caso from casos where id = new.caso_id;
  select count(*), count(*) filter (where done) into v_total, v_hechos from puntos where caso_id = new.caso_id;

  v_title := coalesce(v_caso, 'Pendientes de Casa');
  v_msg   := v_alias || ' ' || new.msg;

  if (new.msg like 'marcó resuelto%' or new.msg like 'respondió y resolvió%')
     and v_total > 0 and v_total = v_hechos then
    v_title := 'Caso completo: ' || coalesce(v_caso, '');
    v_msg   := v_alias || ' resolvió el último punto. ¡Floreció! 🌸';
    v_tags  := '["tada"]'::jsonb;
  elsif new.msg like 'cerró el caso%' then
    v_tags := '["white_check_mark"]'::jsonb;
  elsif new.msg like 'creó el caso%' then
    v_tags := '["seedling"]'::jsonb;
  end if;

  -- Avisar solo a la otra persona (nunca a quien hizo el cambio)
  for r in
    select ntfy_topic from miembros
    where ntfy_topic is not null and ntfy_topic <> '' and id is distinct from new.author
  loop
    perform net.http_post(
      url     := 'https://ntfy.sh',
      body    := jsonb_build_object(
                   'topic',   r.ntfy_topic,
                   'title',   v_title,
                   'message', v_msg,
                   'tags',    v_tags,
                   'click',   'https://uvcartera-jpg.github.io/pendientes-casa/'),
      headers := '{"Content-Type":"application/json"}'::jsonb
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists avisar_cambio on public.historial;
create trigger avisar_cambio
  after insert on public.historial
  for each row execute function public.avisar_cambio();
