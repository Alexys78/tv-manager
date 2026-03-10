const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { createSandbox } = require('./helpers/browser-sandbox');

const projectRoot = path.resolve(__dirname, '..');

function seedSession(localStorage) {
  const session = {
    username: 'AudienceUser',
    email: 'audience@example.com',
    connectedAt: new Date().toISOString()
  };
  localStorage.setItem('tv_manager_users', JSON.stringify([{ username: session.username, email: session.email, password: 'secret123' }]));
  localStorage.setItem('tv_manager_session', JSON.stringify(session));
  localStorage.setItem('tv_manager_last_email', session.email);
  return session;
}

test('audience-engine: plus de catégorie sport côté moteur', () => {
  const { localStorage, loadScript, window } = createSandbox(projectRoot);
  seedSession(localStorage);

  loadScript('session-utils.js');
  loadScript('diffusion-rules.js');
  loadScript('program-catalog.js');
  loadScript('audience-engine.js');

  const sim = window.AudienceEngine.simulateDay('lundi', 'Ma chaîne', []);
  const allEntries = sim.channels.flatMap((channel) => channel.schedule || []);
  assert.equal(allEntries.some((entry) => entry && entry.categoryId === 'sports'), false);
});

test('audience-engine: la durée utilisée suit la méta du catalogue', () => {
  const { localStorage, loadScript, window } = createSandbox(projectRoot);
  seedSession(localStorage);

  loadScript('session-utils.js');
  loadScript('diffusion-rules.js');
  loadScript('program-catalog.js');
  loadScript('audience-engine.js');

  const meta = window.ProgramCatalog.getProgramMeta('Film Action Prime');
  assert.ok(meta && Number(meta.duration) > 0, 'Meta duration introuvable');

  const duration = window.AudienceEngine.getProgramDuration('Film Action Prime', 'films');
  assert.equal(duration, meta.duration);
});

test('audience-engine: une rediffusion est détectée dans les statuts joueur', () => {
  const { localStorage, loadScript, window } = createSandbox(projectRoot);
  seedSession(localStorage);

  loadScript('session-utils.js');
  loadScript('diffusion-rules.js');
  loadScript('program-catalog.js');
  loadScript('audience-engine.js');

  const playerDay = [
    { title: 'Film Action Prime', categoryId: 'films' },
    { title: 'Film Action Prime', categoryId: 'films' }
  ];

  const sim = window.AudienceEngine.simulateDay('mardi', 'Ma chaîne', playerDay);
  const statuses = sim.details
    .map((slot) => slot && slot.shares && slot.shares.player && slot.shares.player.status)
    .filter(Boolean);

  assert.ok(statuses.includes('inedit'));
  assert.ok(statuses.includes('rediffusion'));
});
