// Article View — View article details

async function renderArticle(params) {
  const { boardId, linkId } = params;
  const board = await getBoard(boardId);
  const link = await db.links.get(linkId);

  if (!board || !link) {
    Router.navigate('#/board/' + boardId);
    return;
  }

  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="view-enter">
      <div class="article-header">
        <button class="btn-back" id="btn-back" title="Indietro">&#8592;</button>
        <div class="article-header-info">
          <input class="article-header-title-input" id="link-title-input" value="${escapeHtml(link.title)}" spellcheck="false">
          <div class="article-header-domain">${escapeHtml(link.domain)}</div>
        </div>
        <button class="btn-icon article-external" id="btn-open-url" title="Apri nel browser">&#8599;</button>
      </div>
    </div>
  `;

  // Back button
  document.getElementById('btn-back').addEventListener('click', () => {
    Router.navigate('#/board/' + boardId);
  });

  // Open URL
  document.getElementById('btn-open-url').addEventListener('click', () => {
    window.location.href = link.url;
  });

  // Editable title
  const titleInput = document.getElementById('link-title-input');
  let originalTitle = link.title;
  titleInput.addEventListener('blur', async () => {
    const newTitle = titleInput.value.trim();
    if (newTitle && newTitle !== originalTitle) {
      await db.links.update(linkId, { title: newTitle });
      originalTitle = newTitle;
    } else if (!newTitle) {
      titleInput.value = originalTitle;
    }
  });
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') titleInput.blur();
  });
}

// === WordPress Credentials ===

function getWpCredentials() {
  const data = localStorage.getItem('curator_wp_credentials');
  if (!data) return null;
  try {
    const parsed = JSON.parse(atob(data));
    return parsed;
  } catch {
    return null;
  }
}

function setWpCredentials(siteUrl, user, appPassword) {
  if (siteUrl && user && appPassword) {
    const data = { siteUrl: siteUrl.replace(/\/+$/, ''), user, appPassword };
    localStorage.setItem('curator_wp_credentials', btoa(JSON.stringify(data)));
  } else {
    localStorage.removeItem('curator_wp_credentials');
  }
}

// === WordPress Backup/Restore ===

const BACKUP_SLUG = 'curator-backup-data';

async function wpAuthHeaders() {
  const creds = getWpCredentials();
  if (!creds) throw new Error('Credenziali WordPress non configurate. Vai in Impostazioni.');
  return {
    auth: 'Basic ' + btoa(creds.user + ':' + creds.appPassword),
    endpoint: creds.siteUrl + '/wp-json/wp/v2/posts'
  };
}

async function backupToWordPress() {
  const { auth, endpoint } = await wpAuthHeaders();
  const data = await exportAllData();
  // Also save WP credentials so they survive restore
  data.wpCredentials = localStorage.getItem('curator_wp_credentials');
  const jsonContent = JSON.stringify(data);

  // Check if backup post already exists
  const searchRes = await fetch(endpoint + '?slug=' + BACKUP_SLUG + '&status=private,publish,draft', {
    headers: { 'Authorization': auth }
  });
  const existing = await searchRes.json();

  if (existing.length > 0) {
    // Update existing backup post
    const res = await fetch(endpoint + '/' + existing[0].id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': auth },
      body: JSON.stringify({ content: jsonContent, status: 'private' })
    });
    if (!res.ok) throw new Error('Errore aggiornamento backup');
  } else {
    // Create new backup post
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': auth },
      body: JSON.stringify({
        title: 'Curator Backup',
        slug: BACKUP_SLUG,
        content: jsonContent,
        status: 'private'
      })
    });
    if (!res.ok) throw new Error('Errore creazione backup');
  }
}

async function restoreFromWordPress() {
  const { auth, endpoint } = await wpAuthHeaders();

  const searchRes = await fetch(endpoint + '?slug=' + BACKUP_SLUG + '&status=private,publish,draft', {
    headers: { 'Authorization': auth }
  });
  const posts = await searchRes.json();

  if (posts.length === 0) throw new Error('Nessun backup trovato');

  // Content is stored as raw JSON in the post content
  let raw = posts[0].content.rendered || posts[0].content;
  // Strip HTML tags that WP might wrap around the content
  raw = raw.replace(/<[^>]*>/g, '').trim();
  // Decode HTML entities
  const txt = document.createElement('textarea');
  txt.innerHTML = raw;
  const data = JSON.parse(txt.value);

  // Restore WP credentials first (so they survive the import)
  const wpCreds = data.wpCredentials;
  delete data.wpCredentials;

  await importAllData(data);

  if (wpCreds) {
    localStorage.setItem('curator_wp_credentials', wpCreds);
  }
}

async function publishToWordPress(title, content) {
  const creds = getWpCredentials();
  if (!creds) throw new Error('Credenziali WordPress non configurate. Vai in Impostazioni.');

  const endpoint = creds.siteUrl + '/wp-json/wp/v2/posts';
  const auth = btoa(creds.user + ':' + creds.appPassword);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + auth
    },
    body: JSON.stringify({
      title: title,
      content: content,
      status: 'publish'
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Errore WordPress (' + res.status + ')');
  }

  const post = await res.json();
  return post.link;
}
