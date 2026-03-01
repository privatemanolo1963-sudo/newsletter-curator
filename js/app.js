// App initialization

// Register routes
Router.register('#/', renderHome);
Router.register('#/board/:id', renderBoard);
Router.register('#/board/:boardId/link/:linkId', renderArticle);
Router.register('#/board/:id/summaries', renderSummaries);
Router.register('#/settings', renderSettings);

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
