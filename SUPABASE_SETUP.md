# TV Manager - Setup Cloud (tv_manager_accounts + state_records)

## 1) Créer le projet Supabase
- Ouvre [https://supabase.com](https://supabase.com)
- Crée un projet
- Récupère:
  - `Project URL`
  - `anon public key`

## 2) Créer la table comptes (auth applicative)

```sql
create table if not exists public.tv_manager_accounts (
  email text primary key,
  username text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tv_manager_accounts_username_unique_ci
  on public.tv_manager_accounts (lower(username));

alter table public.tv_manager_accounts enable row level security;

drop policy if exists "tv_manager_accounts_select" on public.tv_manager_accounts;
drop policy if exists "tv_manager_accounts_insert" on public.tv_manager_accounts;
drop policy if exists "tv_manager_accounts_update" on public.tv_manager_accounts;
drop policy if exists "tv_manager_accounts_delete" on public.tv_manager_accounts;

create policy "tv_manager_accounts_select"
on public.tv_manager_accounts
for select
to anon
using (true);

create policy "tv_manager_accounts_insert"
on public.tv_manager_accounts
for insert
to anon
with check (true);

create policy "tv_manager_accounts_update"
on public.tv_manager_accounts
for update
to anon
using (true)
with check (true);

create policy "tv_manager_accounts_delete"
on public.tv_manager_accounts
for delete
to anon
using (true);
```

Note:
- Le mot de passe est hashé côté client (`PBKDF2-SHA256`) puis stocké dans `password_hash`.
- L’inscription est limitée aux emails admin déclarés dans la config.

## 3) Créer la table de sauvegarde

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
```

## 4) Appliquer des policies RLS (mode simple table-only)

```sql
drop policy if exists "tv_manager_state_records_select" on public.tv_manager_state_records;
drop policy if exists "tv_manager_state_records_insert" on public.tv_manager_state_records;
drop policy if exists "tv_manager_state_records_update" on public.tv_manager_state_records;
drop policy if exists "tv_manager_state_records_delete" on public.tv_manager_state_records;

create policy "tv_manager_state_records_select"
on public.tv_manager_state_records
for select
to anon
using (true);

create policy "tv_manager_state_records_insert"
on public.tv_manager_state_records
for insert
to anon
with check (payload is not null);

create policy "tv_manager_state_records_update"
on public.tv_manager_state_records
for update
to anon
using (true)
with check (payload is not null);

create policy "tv_manager_state_records_delete"
on public.tv_manager_state_records
for delete
to anon
using (true);
```

## 5) Configurer le jeu
- Mets la config dans `/Users/alexisaubard/Library/CloudStorage/OneDrive-Personnel/Mes documents/Programmation/Codex/cloud-defaults.js`
  - `url`
  - `anonKey`
  - `table: "tv_manager_state_records"`
  - `adminEmails`: liste des emails autorisés à ouvrir la page Admin

Exemple:

```js
window.TV_MANAGER_CLOUD_DEFAULTS = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
  table: "tv_manager_state_records",
  syncToken: "default",
  adminEmails: ["ton-email@exemple.com"]
};
```

## 6) Vérifier
- Crée un compte depuis `register.html` avec un email autorisé (adminEmails).
- Connecte-toi avec cet email/mot de passe.
- Joue sur PC A, recharge sur PC B avec le même compte: les données doivent être identiques.

## Notes
- Le jeu utilise:
  - `tv_manager_accounts` pour la connexion
  - `tv_manager_state_records` pour toutes les sauvegardes
