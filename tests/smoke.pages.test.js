const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const projectRoot = path.resolve(__dirname, '..');

const APP_PAGES = [
  'tableau-de-bord.html',
  'grille-tv.html',
  'marche-programmes.html',
  'vos-programmes.html',
  'audiences.html',
  'admin.html',
  'finance.html',
  'studio.html',
  'recrutement.html',
  'mon-personnel.html',
  'production-studio.html',
  'suivi-productions.html',
  'versions.html'
];

function read(file) {
  return fs.readFileSync(path.join(projectRoot, file), 'utf8');
}

function extractAssetPaths(html) {
  const paths = [];
  const regex = /(src|href)="([^"]+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const assetPath = match[2];
    if (assetPath.startsWith('http://') || assetPath.startsWith('https://') || assetPath.startsWith('data:') || assetPath.startsWith('#')) {
      continue;
    }
    paths.push(assetPath);
  }
  return paths;
}

test('smoke: tous les assets référencés en HTML existent', () => {
  const htmlFiles = fs.readdirSync(projectRoot).filter((name) => name.endsWith('.html'));
  const missing = [];

  htmlFiles.forEach((file) => {
    const html = read(file);
    const assets = extractAssetPaths(html);
    assets.forEach((asset) => {
      const full = path.join(projectRoot, asset);
      if (!fs.existsSync(full)) {
        missing.push(`${file} -> ${asset}`);
      }
    });
  });

  assert.deepEqual(missing, []);
});

test('smoke: session-utils est chargé sur toutes les pages de l\'app', () => {
  const missing = APP_PAGES.filter((file) => !read(file).includes('<script src="session-utils.js"></script>'));
  assert.deepEqual(missing, []);
});

test('smoke: le header commun est présent sur toutes les pages de l\'app', () => {
  const missing = APP_PAGES.filter((file) => !read(file).includes('<script src="common-header.js"></script>'));
  assert.deepEqual(missing, []);
});
