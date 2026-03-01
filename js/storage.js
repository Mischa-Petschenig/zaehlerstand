
/**
 * Storage abstraction – uses persistentStorage API if available,
 * falls back to localStorage, then in-memory.
 */
var Storage = (function() {
  var memStore = {};

  // Detect which storage is available
  var usePS = typeof window !== 'undefined' && window.persistentStorage && typeof window.persistentStorage.getItem === 'function';
  var useLS = false;
  if (!usePS) {
    try {
      localStorage.setItem('__test__', '1');
      localStorage.removeItem('__test__');
      useLS = true;
    } catch(e) {
      useLS = false;
    }
  }

  return {
    getItem: function(key) {
      if (usePS) {
        return window.persistentStorage.getItem(key);
      }
      if (useLS) {
        return Promise.resolve(localStorage.getItem(key));
      }
      return Promise.resolve(memStore[key] || null);
    },
    setItem: function(key, value) {
      if (usePS) {
        return window.persistentStorage.setItem(key, value);
      }
      if (useLS) {
        localStorage.setItem(key, value);
        return Promise.resolve();
      }
      memStore[key] = value;
      return Promise.resolve();
    },
    removeItem: function(key) {
      if (usePS) {
        return window.persistentStorage.removeItem(key);
      }
      if (useLS) {
        localStorage.removeItem(key);
        return Promise.resolve();
      }
      delete memStore[key];
      return Promise.resolve();
    },
    clear: function() {
      if (usePS) {
        return window.persistentStorage.clear();
      }
      if (useLS) {
        localStorage.clear();
        return Promise.resolve();
      }
      memStore = {};
      return Promise.resolve();
    }
  };
})();
