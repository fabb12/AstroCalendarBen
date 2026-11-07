-- L'email all'amministratore quando qualcuno si iscrive (v534).
--
-- Va lanciato DOPO `accessi.sql`, nello stesso posto: Supabase → SQL Editor →
-- New query → incolla → Run. Si può rilanciare quante volte si vuole.
--
-- Come funziona: quando nasce un profilo «in attesa», il database chiama il
-- servizio di posta Resend (https://resend.com) e manda un'email all'indirizzo
-- dell'amministratore scritto in `accessi.sql` (`email_admin`), con nome ed
-- email di chi si è iscritto e il link all'app. La chiamata parte in
-- background (pg_net): l'iscrizione non aspetta la posta, e se la posta non va
-- l'iscrizione riesce lo stesso.
--
-- La chiave di Resend non sta né qui né nel sito: si mette una volta sola nella
-- cassaforte di Supabase (Vault), col blocco del punto 1. Con Resend gratuito,
-- finché non si collega un proprio dominio, il mittente è onboarding@resend.dev
-- e si può scrivere solo all'email con cui ci si è registrati su Resend: deve
-- essere la stessa di `email_admin`.

-- ==== 1. La chiave di Resend nella cassaforte ================================
-- Al posto di LA-TUA-CHIAVE-RESEND incolla la chiave (comincia con «re_»).
-- Non salvare questo file con la chiave dentro.
do $$
declare
  vecchia uuid;
begin
  select id into vecchia from vault.secrets where name = 'resend_api_key';
  if vecchia is null then
    perform vault.create_secret('LA-TUA-CHIAVE-RESEND', 'resend_api_key', 'Resend: avvisi di nuove iscrizioni');
  else
    perform vault.update_secret(vecchia, 'LA-TUA-CHIAVE-RESEND');
  end if;
end;
$$;

-- ==== 2. Le impostazioni dell'avviso =========================================
-- Il link nell'email. A chi scrivere lo dice `email_admin`; per mandare gli
-- avvisi a un altro indirizzo si aggiunge la riga 'email_avvisi'.
insert into public.accessi_impostazioni (chiave, valore)
values ('indirizzo_app', 'https://fabb12.github.io/AstroCalendarBen/')
on conflict (chiave) do nothing;

-- ==== 3. La chiamata a Resend ================================================
create extension if not exists pg_net with schema extensions;

create or replace function public.avvisa_nuova_iscrizione()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare
  chiave_resend text;
  destinatario text;
  indirizzo text;
  nome_pulito text;
begin
  if new.stato <> 'in_attesa' then
    return new;
  end if;

  select decrypted_secret into chiave_resend
    from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  select coalesce(
           (select valore from public.accessi_impostazioni where chiave = 'email_avvisi'),
           (select valore from public.accessi_impostazioni where chiave = 'email_admin'))
    into destinatario;
  select valore into indirizzo from public.accessi_impostazioni where chiave = 'indirizzo_app';

  if chiave_resend is null or chiave_resend like 'LA-TUA%' or destinatario is null then
    return new;   -- avviso non configurato: l'iscrizione va avanti lo stesso
  end if;

  -- il nome lo scrive chi si iscrive: niente HTML suo dentro l'email
  nome_pulito := replace(replace(replace(coalesce(new.nome, '—'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || chiave_resend,
      'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'AstroCalendario di Ben <onboarding@resend.dev>',
      'to', jsonb_build_array(destinatario),
      'subject', 'Nuova iscrizione da approvare: ' || coalesce(new.nome, new.email),
      'html',
        '<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">'
        || '<h2 style="margin:0 0 12px">Nuova iscrizione all''AstroCalendario</h2>'
        || '<p style="margin:0 0 6px"><b>Nome:</b> ' || nome_pulito || '</p>'
        || '<p style="margin:0 0 6px"><b>Email:</b> ' || replace(replace(new.email, '<', '&lt;'), '>', '&gt;') || '</p>'
        || '<p style="margin:0 0 18px"><b>Quando:</b> ' || to_char(new.creato at time zone 'Europe/Rome', 'DD/MM/YYYY HH24:MI') || '</p>'
        || '<p style="margin:0 0 18px">Per approvarla o rifiutarla apri l''app, tasto <b>Account</b> → <b>Gestisci utenti</b>.</p>'
        || case when indirizzo is not null then
             '<p><a href="' || indirizzo || '" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#4c8dff;color:#fff;text-decoration:none;font-weight:600">Apri l''app</a></p>'
           else '' end
        || '</div>'
    )
  );
  return new;
exception when others then
  -- la posta non deve mai far fallire un'iscrizione
  raise warning 'avviso di iscrizione non spedito: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.avvisa_nuova_iscrizione() from public, anon, authenticated;

drop trigger if exists accessi_avvisa_iscrizione on public.profili;
create trigger accessi_avvisa_iscrizione
  after insert on public.profili
  for each row execute function public.avvisa_nuova_iscrizione();

-- ==== 4. Se l'email non arriva ==============================================
-- Le ultime risposte di Resend (status_code 200 = spedita):
--   select id, status_code, content, created from net._http_response order by created desc limit 5;
