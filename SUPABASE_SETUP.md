# TV Manager - Setup Cloud (unique base)

## 1) Créer le projet Supabase
- Ouvre [https://supabase.com](https://supabase.com)
- Crée un projet
- Récupère:
  - `Project URL`
  - `anon public key`

## 2) Créer la table de sauvegarde (unique)

```sql
create table if not exists public.tv_manager_state_records (
  player_id text not null,
  sync_token text not null default 'default',
  namespace text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (player_id, sync_token, namespace)
);

create index if not exists idx_tv_manager_state_records_player
  on public.tv_manager_state_records (player_id, sync_token);

alter table public.tv_manager_state_records enable row level security;

drop policy if exists "tv_manager_state_records_select" on public.tv_manager_state_records;
create policy "tv_manager_state_records_select"
on public.tv_manager_state_records
for select
to anon
using (true);

drop policy if exists "tv_manager_state_records_insert" on public.tv_manager_state_records;
create policy "tv_manager_state_records_insert"
on public.tv_manager_state_records
for insert
to anon
with check (true);

drop policy if exists "tv_manager_state_records_update" on public.tv_manager_state_records;
create policy "tv_manager_state_records_update"
on public.tv_manager_state_records
for update
to anon
using (true)
with check (true);

drop policy if exists "tv_manager_state_records_delete" on public.tv_manager_state_records;
create policy "tv_manager_state_records_delete"
on public.tv_manager_state_records
for delete
to anon
using (true);
```

## 3) Créer la table comptes joueurs

```sql
create table if not exists public.tv_manager_accounts (
  email text primary key,
  username text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tv_manager_accounts_username
  on public.tv_manager_accounts (username);

alter table public.tv_manager_accounts enable row level security;

drop policy if exists "tv_manager_accounts_select" on public.tv_manager_accounts;
create policy "tv_manager_accounts_select"
on public.tv_manager_accounts
for select
to anon
using (true);

drop policy if exists "tv_manager_accounts_insert" on public.tv_manager_accounts;
create policy "tv_manager_accounts_insert"
on public.tv_manager_accounts
for insert
to anon
with check (true);

drop policy if exists "tv_manager_accounts_update" on public.tv_manager_accounts;
create policy "tv_manager_accounts_update"
on public.tv_manager_accounts
for update
to anon
using (true)
with check (true);

drop policy if exists "tv_manager_accounts_delete" on public.tv_manager_accounts;
create policy "tv_manager_accounts_delete"
on public.tv_manager_accounts
for delete
to anon
using (true);
```

## 4) Configurer le jeu
- Va sur `Admin` > `Sync cloud (Supabase)`
- Renseigne:
  - URL Supabase
  - Clé anon
  - Token de sync (même token sur tous les PC d’un même profil)
  - Table: `tv_manager_state_records`
- Clique `Enregistrer + connecter`

Option recommandée (prod): configure directement `/Users/alexisaubard/Library/CloudStorage/OneDrive-Personnel/Mes documents/Programmation/Codex/cloud-defaults.js` pour éviter toute saisie manuelle.

## 5) Vérifier
- PC A: joue puis clique `Envoyer vers cloud`
- PC B: même compte + même token, clique `Récupérer du cloud`

## Notes
- Le jeu est maintenant branché sur **une seule base de sauvegarde**: `tv_manager_state_records`.
- `tv_manager_saves` n’est plus nécessaire.
