const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { createSandbox } = require('./helpers/browser-sandbox');

const projectRoot = path.resolve(__dirname, '..');

function seedSession(localStorage) {
  const session = {
    username: 'TestUser',
    email: 'test@example.com',
    connectedAt: new Date().toISOString()
  };
  localStorage.setItem('tv_manager_users', JSON.stringify([{ username: session.username, email: session.email, password: 'secret123' }]));
  localStorage.setItem('tv_manager_session', JSON.stringify(session));
  localStorage.setItem('tv_manager_last_email', session.email);
  return session;
}

test('catalogue: le marché ne contient pas la catégorie informations', () => {
  const { localStorage, loadScript, window } = createSandbox(projectRoot);
  seedSession(localStorage);

  loadScript('session-utils.js');
  loadScript('diffusion-rules.js');
  loadScript('program-catalog.js');

  const categories = window.ProgramCatalog.getMarketCategoriesForCurrentSession();
  assert.ok(Array.isArray(categories));
  assert.ok(categories.length > 0);
  assert.equal(categories.some((c) => c.id === 'information'), false);
});

test("catalogue+banque: l'achat d'un programme débite le compte et ajoute le programme", () => {
  const { localStorage, loadScript, window } = createSandbox(projectRoot);
  seedSession(localStorage);

  loadScript('session-utils.js');
  loadScript('bank.js');
  loadScript('diffusion-rules.js');
  loadScript('program-catalog.js');

  const market = window.ProgramCatalog.getMarketCategoriesForCurrentSession();
  const before = window.PlayerBank.getBalance();
  const allPrograms = market.flatMap((category) => (Array.isArray(category.programs) ? category.programs : []));
  const affordable = allPrograms.find((program) => Number(program.price) > 0 && Number(program.price) <= before);
  assert.ok(affordable, 'Aucun programme achetable avec le solde initial');

  const title = affordable.title;
  const result = window.ProgramCatalog.buyProgramForCurrentSession(title);

  assert.equal(result.ok, true, result.message || 'Achat échoué');
  const after = window.PlayerBank.getBalance();
  assert.ok(after < before, `Le solde n'a pas baissé: avant=${before}, après=${after}`);

  const owned = window.ProgramCatalog.getOwnedCatalogForCurrentSession();
  const ownedTitles = new Set(
    owned.flatMap((category) => (Array.isArray(category.programs) ? category.programs.map((p) => p.title || p) : []))
  );
  assert.equal(ownedTitles.has(title), true);
});

test('catalogue: création puis suppression d\'un programme produit', () => {
  const { localStorage, loadScript, window } = createSandbox(projectRoot);
  seedSession(localStorage);

  loadScript('session-utils.js');
  loadScript('diffusion-rules.js');
  loadScript('program-catalog.js');

  const title = 'Journal Test Node';
  const create = window.ProgramCatalog.createProducedProgramForCurrentSession({
    title,
    categoryId: 'information',
    subtype: 'JT',
    duration: 60,
    ageRating: 'TP',
    starsOverride: 2
  });
  assert.equal(create.ok, true, create.message || 'Création impossible');

  const del = window.ProgramCatalog.deleteProducedProgramForCurrentSession(title, { ignoreScheduling: true });
  assert.equal(del.ok, true, del.message || 'Suppression impossible');
});
