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
        <div class="settings-label">Dati</div>
        <div class="settings-description">Esporta o importa un backup completo di board e link.</div>
        <div class="settings-key-actions">
          <button class="btn btn-secondary" id="btn-export-data" style="flex:1">Esporta JSON</button>
          <button class="btn btn-secondary" id="btn-import-data" style="flex:1">Importa JSON</button>
          <input type="file" id="import-file-input" accept=".json" style="display:none">
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-label">Info</div>
        <div class="settings-description">Newsletter Curator v1.1<br>PWA per raccolta e curation link.</div>
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
