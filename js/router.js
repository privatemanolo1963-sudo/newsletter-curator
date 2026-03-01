// Simple hash-based router

const Router = {
  _routes: {},
  _currentView: null,

  register(path, handler) {
    this._routes[path] = handler;
  },

  navigate(path) {
    window.location.hash = path;
  },

  _resolve() {
    const hash = window.location.hash || '#/';
    // Try exact match first
    if (this._routes[hash]) {
      this._currentView = hash;
      this._routes[hash]();
      return;
    }
    // Try pattern matching (e.g., #/board/:id)
    for (const [pattern, handler] of Object.entries(this._routes)) {
      const paramNames = [];
      const regexStr = pattern.replace(/:(\w+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
      });
      const regex = new RegExp('^' + regexStr + '$');
      const match = hash.match(regex);
      if (match) {
        const params = {};
        paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });
        this._currentView = hash;
        handler(params);
        return;
      }
    }
    // Default to home
    this.navigate('#/');
  },

  init() {
    window.addEventListener('hashchange', () => this._resolve());
    this._resolve();
  }
};
