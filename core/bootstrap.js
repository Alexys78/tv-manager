(function tvManagerCoreBootstrap() {
  const sessionUtils = window.SessionUtils;
  const schema = window.TVManagerStateSchema;
  const adapter = window.TVManagerStorageAdapter;
  const store = window.TVManagerStore;
  if (!sessionUtils || !schema || !adapter || !store) return;

  function getCurrentSession() {
    return sessionUtils.recoverSessionFromLocation({ persist: true });
  }

  function createLocalStoreForCurrentPlayer() {
    const session = getCurrentSession();
    return store.createLocalStore(session);
  }

  function createCloudStoreForCurrentPlayer(cloudConfig) {
    const session = getCurrentSession();
    return store.createCloudStore(session, cloudConfig);
  }

  window.TVManagerCore = {
    schema,
    adapter,
    store,
    getCurrentSession,
    createLocalStoreForCurrentPlayer,
    createCloudStoreForCurrentPlayer
  };
})();
