// App initialization

// Register routes
Router.register('#/', renderHome);
Router.register('#/board/:id', renderBoard);
Router.register('#/board/:boardId/link/:linkId', renderArticle);
Router.register('#/settings', renderSettings);

// One-time migration: reverse existing link order (newest first)
(async function migrateLinksOrder() {
  const DONE_KEY = 'curator_migrate_reverse_v1';
  if (localStorage.getItem(DONE_KEY)) return;
  const boards = await db.boards.toArray();
  for (const board of boards) {
    const links = await db.links.where('boardId').equals(board.id).toArray();
    links.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    // Reverse: last added (highest sortOrder) gets sortOrder 0
    for (let i = 0; i < links.length; i++) {
      await db.links.update(links[i].id, { sortOrder: links.length - 1 - i });
    }
  }
  localStorage.setItem(DONE_KEY, '1');
})();

// Start router
Router.init();

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // SW registration failed (likely file:// protocol), that's ok
  });
}

// === Offline detection ===
function updateOnlineStatus() {
  const existing = document.querySelector('.offline-banner');
  if (!navigator.onLine) {
    if (!existing) {
      const banner = document.createElement('div');
      banner.className = 'offline-banner';
      banner.textContent = 'Offline — alcune funzioni non disponibili';
      document.body.appendChild(banner);
    }
  } else {
    if (existing) existing.remove();
  }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// === Prevent double-tap zoom on iOS ===
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });
