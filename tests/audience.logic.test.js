const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { createSandbox } = require('./helpers/browser-sandbox');

const projectRoot = path.resolve(__dirname, '..');

function seedSession(localStorage) {
  const session = {
    username: 'AudienceUser',
    email: 'audience@example.com',
    connectedAt: new Date().toISOString(),
    accessToken: 'test.header.signature',
    refreshToken: 'test-refresh-token',
    tokenType: 'bearer',
    expiresAt: new Date(Date.now() + 3600_000).toISOString()
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

test('audience-engine: les stats staff influencent positivement la part joueur', () => {
  function runSimulation(withStaff) {
    const { localStorage, loadScript, window } = createSandbox(projectRoot);
    seedSession(localStorage);

    window.ProgramCatalog = {
      getProgramMeta(title) {
        if (title !== 'Test Journal 20h') return null;
        return {
          title,
          duration: 60,
          stars: 3,
          productionMode: 'direct',
          productionSubtype: 'JT',
          presenterIds: withStaff ? ['jr_1'] : [],
          directorId: withStaff ? 'dr_1' : '',
          producerId: withStaff ? 'pd_1' : ''
        };
      }
    };

    window.PresenterEngine = {
      getStaffByIdForCurrentSession(role, id) {
        const key = `${role}:${id}`;
        const map = {
          'journalists:jr_1': { editorial: 96, charisma: 92, notoriety: 90, specialty: 'Informations · JT' },
          'directors:dr_1': { editorial: 94, charisma: 88, notoriety: 87, specialty: 'Informations · JT' },
          'producers:pd_1': { editorial: 93, charisma: 90, notoriety: 89, specialty: 'Informations · JT' }
        };
        return map[key] || null;
      }
    };

    loadScript('session-utils.js');
    loadScript('diffusion-rules.js');
    loadScript('audience-engine.js');

    const sim = window.AudienceEngine.simulateDay('jeudi', 'Ma chaîne', [
      { title: 'Test Journal 20h', categoryId: 'information' }
    ]);
    const row = (sim.ranking || []).find((item) => item && item.id === 'player');
    return row ? Number(row.share) : 0;
  }

  const shareWithoutStaff = runSimulation(false);
  const shareWithStaff = runSimulation(true);
  assert.ok(shareWithStaff > shareWithoutStaff);
});
