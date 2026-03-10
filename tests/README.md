# Tests V1 (sans dépendances externes)

## Commandes

- `npm test` : exécute tous les tests Node (`node --test`).
- `npm run test:logic` : tests logiques catalogue + audience.
- `npm run test:smoke` : smoke tests statiques des pages.
- `npm run test:syntax` : vérification syntaxe de tous les `.js`.

## Pourquoi pas Playwright pour l'instant ?

Le dépôt npm n'est pas accessible depuis l'environnement actuel (`ENOTFOUND registry.npmjs.org`), donc impossible d'installer `@playwright/test` ici.
La base de tests est prête côté logique/smoke local; on pourra ajouter les specs Playwright dès que l'accès réseau npm est disponible.
