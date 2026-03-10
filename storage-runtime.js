(function tvManagerStorageRuntimeInit() {
  if (window.__tvManagerStorageRuntimeReady) return;
  window.__tvManagerStorageRuntimeReady = true;

  const STORAGE_PREFIX = "__tvm_cloud_only__:";
  const nativeLocalStorage = window.localStorage;
  const backend = window.sessionStorage;
  const shadow = new Map();

  function backendKey(key) {
    return `${STORAGE_PREFIX}${String(key)}`;
  }

  function sortedKeys() {
    return Array.from(shadow.keys()).sort();
  }

  function loadFromBackend() {
    for (let i = 0; i < backend.length; i += 1) {
      const key = backend.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      const plainKey = key.slice(STORAGE_PREFIX.length);
      shadow.set(plainKey, backend.getItem(key));
    }
  }

  function persistToBackend(key, value) {
    if (value === null || value === undefined) {
      backend.removeItem(backendKey(key));
      return;
    }
    backend.setItem(backendKey(key), String(value));
  }

  function clearBackendShadow() {
    const prefixed = [];
    for (let i = 0; i < backend.length; i += 1) {
      const key = backend.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      prefixed.push(key);
    }
    prefixed.forEach((key) => backend.removeItem(key));
  }

  function getLength() {
    return shadow.size;
  }

  function keyAt(index) {
    const keys = sortedKeys();
    const i = Number(index);
    if (!Number.isFinite(i) || i < 0 || i >= keys.length) return null;
    return keys[i] || null;
  }

  function getItem(key) {
    if (!shadow.has(String(key))) return null;
    return shadow.get(String(key));
  }

  function setItem(key, value) {
    const cleanKey = String(key);
    const cleanValue = String(value);
    shadow.set(cleanKey, cleanValue);
    persistToBackend(cleanKey, cleanValue);
  }

  function removeItem(key) {
    const cleanKey = String(key);
    shadow.delete(cleanKey);
    persistToBackend(cleanKey, null);
  }

  function clear() {
    shadow.clear();
    clearBackendShadow();
  }

  function patchLocalStorage() {
    const originalSetItem = nativeLocalStorage.setItem.bind(nativeLocalStorage);
    const originalRemoveItem = nativeLocalStorage.removeItem.bind(nativeLocalStorage);
    const originalClear = nativeLocalStorage.clear.bind(nativeLocalStorage);

    nativeLocalStorage.getItem = function patchedGetItem(key) {
      return getItem(key);
    };
    nativeLocalStorage.setItem = function patchedSetItem(key, value) {
      setItem(key, value);
    };
    nativeLocalStorage.removeItem = function patchedRemoveItem(key) {
      removeItem(key);
    };
    nativeLocalStorage.key = function patchedKey(index) {
      return keyAt(index);
    };
    nativeLocalStorage.clear = function patchedClear() {
      clear();
    };

    try {
      Object.defineProperty(nativeLocalStorage, "length", {
        configurable: true,
        get() {
          return getLength();
        }
      });
    } catch {
      try {
        const proto = Object.getPrototypeOf(nativeLocalStorage);
        const nativeLengthDescriptor = Object.getOwnPropertyDescriptor(proto, "length");
        if (nativeLengthDescriptor && typeof nativeLengthDescriptor.get === "function") {
          Object.defineProperty(proto, "length", {
            configurable: true,
            get() {
              if (this === nativeLocalStorage) return getLength();
              return nativeLengthDescriptor.get.call(this);
            }
          });
        }
      } catch {
        // If this fails, iterating keys should use TVManagerStorageRuntime.keys().
      }
    }

    window.__tvManagerStorageNative = {
      setItem: originalSetItem,
      removeItem: originalRemoveItem,
      clear: originalClear
    };
  }

  loadFromBackend();
  patchLocalStorage();

  window.TVManagerStorageRuntime = {
    keys() {
      return sortedKeys();
    },
    dump() {
      const out = {};
      sortedKeys().forEach((key) => {
        out[key] = shadow.get(key);
      });
      return out;
    }
  };
})();
