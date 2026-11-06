/* Dove stanno gli account dell'app (accessi.js): il progetto Supabase.
 *
 * Nel repository i due campi restano vuoti: online li scrive la
 * pubblicazione (`.github/workflows/pubblica.yml`) dalle variabili del
 * repository `SUPABASE_URL` e `SUPABASE_CHIAVE` (Settings → Secrets and
 * variables → Actions → Variables), come fa con `config.js`. Per provare in
 * locale si scrivono qui, senza fare commit.
 *
 * Sono dati pubblici per costruzione: l'indirizzo del progetto e la chiave
 * «publishable» (la vecchia «anon») arrivano a ogni browser, e a proteggere
 * i dati sono le regole del database (`supabase/accessi.sql`). La chiave
 * segreta (`service_role` / `sb_secret_…`) non va mai qui.
 *
 * Con `url` o `chiave` vuoti l'app non chiede l'accesso. */
window.ASTROCAL_ACCESSI = {
  url: '',
  chiave: ''
};
