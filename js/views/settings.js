// Settings View

function renderSettings() {
  const app = document.getElementById('app');
  const wpCreds = getWpCredentials();

  app.innerHTML = `
    <div class="view-enter">
      <div class="board-header">
        <button class="btn-back" id="btn-back" title="Indietro">&#8592;</button>
        <span class="board-title-input" style="pointer-events:none; font-size:22px; font-weight:700;">Impostazioni</span>
      </div>

      <div class="settings-section">
        <div class="settings-label">WordPress</div>
        <div class="settings-description">Per pubblicare note (articoli senza URL) come post privati su humansai.it.</div>
        <input class="modal-input" id="wp-site-input" type="url" placeholder="https://www.humansai.it" value="${wpCreds ? wpCreds.siteUrl : 'https://www.humansai.it'}" autocomplete="off" style="margin-bottom:8px">
        <input class="modal-input" id="wp-user-input" type="text" placeholder="Username WordPress" value="${wpCreds ? wpCreds.user : ''}" autocomplete="off" style="margin-bottom:8px">
        <input class="modal-input" id="wp-pass-input" type="password" placeholder="Application Password" value="${wpCreds ? '••••••••••••••••' : ''}" autocomplete="off">
        <div class="settings-key-actions">
          <button class="btn btn-primary" id="btn-save-wp" style="flex:1">Salva</button>
          ${wpCreds ? '<button class="btn btn-danger" id="btn-delete-wp" style="flex:0.6">Elimina</button>' : ''}
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-label">Backup Cloud</div>
        <div class="settings-description">Il backup su humansai.it e' automatico: parte all'apertura dell'app e dopo ogni modifica. Vengono conservate le ultime cinque versioni.</div>
        ${backupStatusHtml()}
        <div class="settings-key-actions">
          <button class="btn btn-primary" id="btn-backup-wp" style="flex:1">Backup adesso</button>
          <button class="btn btn-secondary" id="btn-restore-wp" style="flex:1">Ripristina</button>
        </div>
        <div class="settings-key-actions" style="margin-top:8px">
          <button class="btn btn-secondary" id="btn-versions-wp" style="flex:1">Versioni precedenti</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-label">Dati locali</div>
        <div class="settings-description">Esporta o importa un backup come file JSON.</div>
        <div class="settings-key-actions">
          <button class="btn btn-secondary" id="btn-export-data" style="flex:1">Esporta JSON</button>
          <button class="btn btn-secondary" id="btn-import-data" style="flex:1">Importa JSON</button>
          <input type="file" id="import-file-input" accept=".json" style="display:none">
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-label">Info</div>
        <div class="settings-description">Newsletter Curator v1.2<br>PWA per raccolta e curation link.</div>
      </div>
    </div>
  `;

  // Back
  document.getElementById('btn-back').addEventListener('click', () => {
    Router.navigate('#/');
  });

  // Save WP credentials
  document.getElementById('btn-save-wp').addEventListener('click', () => {
    const site = document.getElementById('wp-site-input').value.trim();
    const user = document.getElementById('wp-user-input').value.trim();
    const pass = document.getElementById('wp-pass-input').value.trim();
    if (!site || !user || !pass || pass.startsWith('•')) {
      if (pass.startsWith('•') && wpCreds) {
        setWpCredentials(site, user, wpCreds.appPassword);
      } else {
        showToast('Compila tutti i campi');
        return;
      }
    } else {
      setWpCredentials(site, user, pass);
    }
    showToast('Credenziali WordPress salvate');
    renderSettings();
  });

  // Delete WP credentials
  document.getElementById('btn-delete-wp')?.addEventListener('click', () => {
    setWpCredentials(null);
    showToast('Credenziali WordPress eliminate');
    renderSettings();
  });

  // Backup to WordPress
  document.getElementById('btn-backup-wp').addEventListener('click', async () => {
    const btn = document.getElementById('btn-backup-wp');
    btn.textContent = '...';
    btn.disabled = true;
    try {
      const blocked = getBackupState().blocked;
      let force = false;
      if (blocked) {
        force = await confirmAction('Forza il backup',
          'La protezione ha sospeso il backup perché su WordPress ci sono dati che questa app non conosce. ' +
          'Procedendo, il backup online viene sostituito con il contenuto attuale dell\'app. ' +
          'La versione precedente resta comunque nello storico.');
        if (!force) {
          btn.textContent = 'Backup adesso';
          btn.disabled = false;
          return;
        }
      }
      const res = await performBackup({ rotate: true, force });
      showToast(res.unchanged
        ? 'Backup già aggiornato'
        : 'Backup completato: ' + res.boards + ' board, ' + res.links + ' link');
    } catch (err) {
      showToast('Errore: ' + err.message);
    }
    btn.textContent = 'Backup adesso';
    btn.disabled = false;
    renderSettings();
  });

  // Restore from WordPress
  document.getElementById('btn-restore-wp').addEventListener('click', async () => {
    const btn = document.getElementById('btn-restore-wp');
    btn.textContent = '...';
    btn.disabled = true;
    try {
      const boards = await db.boards.count();
      if (boards > 0) {
        const ok = await confirmAction('Ripristina backup',
          'Il ripristino sostituisce le ' + boards + ' board presenti nell\'app con quelle del backup. Procedere?');
        if (!ok) {
          btn.textContent = 'Ripristina';
          btn.disabled = false;
          return;
        }
      }
      const res = await restoreFromSlug(BACKUP_SLUG);
      showToast('Ripristinate ' + res.boards + ' board, ' + res.links + ' link');
      renderSettings();
    } catch (err) {
      showToast('Errore: ' + err.message);
    }
    btn.textContent = 'Ripristina';
    btn.disabled = false;
  });

  // Versioni precedenti
  document.getElementById('btn-versions-wp').addEventListener('click', showBackupVersionsModal);

  // Export data
  document.getElementById('btn-export-data').addEventListener('click', async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'curator-backup-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup esportato');
  });

  // Import data
  const fileInput = document.getElementById('import-file-input');
  document.getElementById('btn-import-data').addEventListener('click', () => {
    fileInput.click();
  });
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.boards || !data.links) {
        throw new Error('Formato non valido');
      }
      await importAllData(data);
      showToast('Dati importati');
      renderSettings();
    } catch (err) {
      showToast('Errore: ' + err.message);
    }
  });
}


// === Stato del backup e versioni ===

function backupStatusHtml() {
  const state = getBackupState();
  const warning = getBackupWarning();
  if (warning) {
    return '<div class="settings-backup-status settings-backup-' + warning.level + '">' +
      escapeHtml(warning.text) + '</div>';
  }
  const when = formatBackupDate(state.lastOkAt);
  const what = (state.boards || 0) + ' board, ' + (state.links || 0) + ' link';
  return '<div class="settings-backup-status settings-backup-ok">Ultimo backup: ' +
    escapeHtml(when) + ' (' + what + ')</div>';
}

function confirmAction(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>${escapeHtml(title)}</h2>
        <p class="confirm-text">${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="confirm-no">Annulla</button>
          <button class="btn btn-primary" id="confirm-yes">Procedi</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = (value) => { overlay.remove(); resolve(value); };
    overlay.querySelector('#confirm-no').addEventListener('click', () => close(false));
    overlay.querySelector('#confirm-yes').addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
  });
}

async function showBackupVersionsModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Versioni del backup</h2>
      <div id="versions-list" class="confirm-text">Caricamento...</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="versions-close">Chiudi</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#versions-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const list = overlay.querySelector('#versions-list');
  try {
    const versions = await listBackupVersions();
    if (versions.length === 0) {
      list.textContent = 'Nessun backup trovato su WordPress.';
      return;
    }
    list.innerHTML = versions.map((v) => {
      const when = v.modified ? new Date(v.modified).toLocaleString('it-IT', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : 'data sconosciuta';
      const counts = (v.boards === null) ? 'contenuto non leggibile' : (v.boards + ' board, ' + v.links + ' link');
      return '<button class="btn btn-secondary version-item" data-slug="' + v.slug +
        '" style="width:100%;text-align:left;margin-bottom:8px">' +
        escapeHtml(v.label) + '<br><span style="opacity:.7;font-size:13px">' +
        escapeHtml(when) + ' &middot; ' + escapeHtml(counts) + '</span></button>';
    }).join('');

    list.querySelectorAll('.version-item').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const slug = btn.dataset.slug;
        const boards = await db.boards.count();
        const ok = await confirmAction('Ripristina versione',
          boards > 0
            ? 'Questa versione sostituira\' le ' + boards + ' board presenti nell\'app. Procedere?'
            : 'Ripristinare questa versione nell\'app?');
        if (!ok) return;
        try {
          const res = await restoreFromSlug(slug);
          close();
          showToast('Ripristinate ' + res.boards + ' board, ' + res.links + ' link');
          renderSettings();
        } catch (err) {
          showToast('Errore: ' + err.message);
        }
      });
    });
  } catch (err) {
    list.textContent = 'Errore: ' + err.message;
  }
}
