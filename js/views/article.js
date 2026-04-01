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
      status: 'private'
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Errore WordPress (' + res.status + ')');
  }

  const post = await res.json();
  return post.link;
}
