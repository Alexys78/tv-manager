const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
    key(index) {
      const keys = Array.from(store.keys());
      return Number.isInteger(index) && index >= 0 && index < keys.length ? keys[index] : null;
    },
    get length() {
      return store.size;
    }
  };
}

function createSandbox(projectRoot) {
  const localStorage = createLocalStorage();
  const window = {
    location: {
      href: 'http://localhost/game.html',
      pathname: '/game.html',
      search: ''
    },
    history: {
      replaceState() {}
    }
  };

  const context = {
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    RegExp,
    Intl,
    URL,
    URLSearchParams,
    encodeURIComponent,
    decodeURIComponent,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    atob: (value) => Buffer.from(String(value), 'base64').toString('binary'),
    btoa: (value) => Buffer.from(String(value), 'binary').toString('base64'),
    localStorage,
    document: {
      querySelectorAll() {
        return [];
      },
      getElementById() {
        return null;
      }
    },
    window
  };

  window.window = window;
  window.localStorage = localStorage;
  window.document = context.document;

  context.global = context;
  context.globalThis = context;
  context.self = window;

  const vmContext = vm.createContext(context);

  function loadScript(relativePath) {
    const filePath = path.join(projectRoot, relativePath);
    const code = fs.readFileSync(filePath, 'utf8');
    vm.runInContext(code, vmContext, { filename: filePath });
  }

  return { context: vmContext, window, localStorage, loadScript };
}

module.exports = {
  createSandbox
};
