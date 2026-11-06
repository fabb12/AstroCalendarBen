-- Gli account dell'AstroCalendario su Supabase (accessi.js, v533).
--
-- Si incolla tutto nel progetto Supabase: SQL Editor → New query → Run.
-- Prima, nella riga segnata qui sotto, al posto di LA-TUA-EMAIL si scrive
-- l'email con cui l'amministratore si iscriverà nell'app: quell'account
-- nasce già approvato e amministratore, tutti gli altri nascono «in attesa».
-- Lo script si può rilanciare: non cancella niente di quello che c'è.

-- ==== 1. Le impostazioni private =============================================
create table if not exists public.accessi_impostazioni (
  chiave text primary key,
  valore text not null
);
alter table public.accessi_impostazioni enable row level security;
-- nessuna regola: dall'app non la legge e non la scrive nessuno

insert into public.accessi_impostazioni (chiave, valore)
values ('email_admin', lower('LA-TUA-EMAIL'))   -- <<< QUI LA TUA EMAIL
on conflict (chiave) do update set valore = excluded.valore;

-- ==== 2. I profili ===========================================================
-- Uno per ogni utente di Supabase Auth. `sezioni` sono le parti dell'app che
-- l'utente vede: stasera, calendario, cielo (il planetario), telescopio,
-- didattica, demo.
create table if not exists public.profili (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  nome text,
  stato text not null default 'in_attesa'
    check (stato in ('in_attesa', 'approvato', 'rifiutato', 'sospeso')),
  ruolo text not null default 'utente' check (ruolo in ('utente', 'admin')),
  sezioni text[] not null
    default array['stasera', 'calendario', 'cielo', 'telescopio', 'didattica', 'demo'],
  creato timestamptz not null default now(),
  deciso_il timestamptz,
  deciso_da uuid
);
alter table public.profili enable row level security;

-- ==== 3. Chi è amministratore ================================================
-- `security definer`: la funzione legge i profili senza passare dalle regole
-- qui sotto, che a loro volta la usano (altrimenti si chiamerebbero a vicenda).
create or replace function public.e_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profili
    where id = auth.uid() and ruolo = 'admin' and stato = 'approvato'
  );
$$;

-- ==== 4. Le regole ===========================================================
-- Ognuno legge il suo profilo; l'amministratore li legge tutti.
drop policy if exists "profili: leggere" on public.profili;
create policy "profili: leggere" on public.profili
  for select using (id = auth.uid() or public.e_admin());

-- Solo l'amministratore cambia i profili: un utente non può approvarsi da
-- solo, né darsi sezioni o il ruolo di amministratore.
drop policy if exists "profili: cambiare" on public.profili;
create policy "profili: cambiare" on public.profili
  for update using (public.e_admin()) with check (public.e_admin());

-- Nessuna regola per insert/delete: i profili nascono dal trigger qui sotto
-- e si cancellano con `elimina_account`.

-- ==== 5. Il profilo nasce con l'iscrizione ===================================
create or replace function public.nuovo_profilo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  admin_email text;
begin
  select valore into admin_email from public.accessi_impostazioni where chiave = 'email_admin';
  insert into public.profili (id, email, nome, stato, ruolo, deciso_il)
  values (
    new.id,
    lower(new.email),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'nome', '')), ''),
    case when lower(new.email) = admin_email then 'approvato' else 'in_attesa' end,
    case when lower(new.email) = admin_email then 'admin' else 'utente' end,
    case when lower(new.email) = admin_email then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists accessi_nuovo_profilo on auth.users;
create trigger accessi_nuovo_profilo
  after insert on auth.users
  for each row execute function public.nuovo_profilo();

-- ==== 6. Eliminare un account (solo l'amministratore, mai se stesso) =========
create or replace function public.elimina_account(utente uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.e_admin() then
    raise exception 'solo un amministratore può eliminare un account';
  end if;
  if utente = auth.uid() then
    raise exception 'non puoi eliminare il tuo account da qui';
  end if;
  delete from auth.users where id = utente;
end;
$$;
revoke all on function public.elimina_account(uuid) from public, anon;
grant execute on function public.elimina_account(uuid) to authenticated;

-- ==== 7. Chi si era iscritto prima di questo script ==========================
insert into public.profili (id, email, nome)
select u.id, lower(u.email), nullif(trim(coalesce(u.raw_user_meta_data ->> 'nome', '')), '')
from auth.users u
on conflict (id) do nothing;

update public.profili p
set ruolo = 'admin', stato = 'approvato', deciso_il = coalesce(p.deciso_il, now())
from public.accessi_impostazioni i
where i.chiave = 'email_admin' and p.email = i.valore;
