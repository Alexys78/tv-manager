# TV Manager - Core V1 (Fondation)

## Objectif
Créer une base stable pour migrer le jeu vers une architecture multi-joueur cohérente:
- source de vérité unique par joueur,
- adapter local/cloud interchangeable,
- évolution progressive sans casser le gameplay actuel.

## Fichiers ajoutés
- `core/state-schema.js`
  - namespaces de données standardisés,
  - valeurs par défaut,
  - normalisation des types.

- `core/storage-adapter.js`
  - `LocalNamespaceAdapter` (compatibilité avec les clés legacy existantes),
  - `SupabaseNamespaceAdapter` (table par namespace pour scaling).

- `core/store.js`
  - `PlayerStateStore` (get/set/update/getMany/setMany),
  - cache local et événements.

- `core/bootstrap.js`
  - expose `window.TVManagerCore`.

## API dispo (global)
```js
const core = window.TVManagerCore;
const store = core.createLocalStoreForCurrentPlayer();
await store.init();

const bank = await store.get("bank_balance");
await store.set("bank_balance", bank + 10000);
```

## Stratégie de migration (sans régression)
1. Migrer module par module vers le `store`.
2. Supprimer progressivement les accès directs à `localStorage`.
3. Basculer certaines namespaces en cloud direct (`SupabaseNamespaceAdapter`) selon les besoins.

## Namespaces V1
- `bank_balance`
- `date_grid`
- `grid_publication`
- `audience_results`
- `finance_results`
- `finance_transactions`
- `owned_titles`
- `owned_details`
- `studio_state`
- `studio_schedule`
- `ad_settings`
- `ad_slot_plan`
- `rediff_stats`
- `dynamic_films`
- `dynamic_films_revision`
- `dynamic_categories`
- `dynamic_categories_revision`
- `notifications_dismissed`
