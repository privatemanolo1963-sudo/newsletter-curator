// Article/Summary View — Generate and view AI summaries

async function renderArticle(params) {
  const { boardId, linkId } = params;
  const board = await getBoard(boardId);
  const link = await db.links.get(linkId);

  if (!board || !link) {
    Router.navigate('#/board/' + boardId);
    return;
  }

  const existingSummary = await getSummaryForLink(linkId);
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
      <div class="summary-content" id="summary-content">
        ${existingSummary ? renderSummaryResult(existingSummary.content) : renderSummaryPrompt()}
      </div>
    </div>
  `;

  // Back button
  document.getElementById('btn-back').addEventListener('click', () => {
    Router.navigate('#/board/' + boardId);
  });

  // Open URL in same tab (user can press back to return)
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

  if (existingSummary) {
    setupSummaryActions(existingSummary.content, link);
    setupRegenerateBtn(linkId, boardId, link);
  } else {
    setupGenerateFlow(linkId, boardId, link);
  }
}

// === Render States ===

function renderSummaryPrompt() {
  return `
    <div class="summary-prompt">
      <div class="summary-prompt-icon">&#9734;</div>
      <p class="summary-prompt-text">Genera un riassunto editoriale di questo articolo con AI.</p>
      <button class="btn btn-primary summary-generate-btn" id="btn-generate">Genera Riassunto</button>
      <div class="summary-fetching-status" id="fetching-status" style="display:none">
        <div class="spinner-small"></div>
        <span>Recupero articolo...</span>
      </div>
    </div>
  `;
}

function renderSummaryResult(content) {
  return `
    <div class="summary-result">
      <div class="summary-body">${formatSummaryContent(content)}</div>
      <div class="summary-actions">
        <button class="btn btn-secondary" id="btn-copy-summary">Copia</button>
        <button class="btn btn-secondary" id="btn-regenerate">Rigenera</button>
      </div>
    </div>
  `;
}

function renderPasteFallback() {
  return `
    <div class="summary-paste-fallback">
      <p class="summary-fallback-text">Non riesco a recuperare il testo automaticamente.</p>
      <p class="summary-fallback-text">Apri l'articolo, copia il testo e incollalo qui:</p>
      <textarea class="article-paste-area" id="article-paste" placeholder="Incolla il contenuto dell'articolo..."></textarea>
      <button class="btn btn-primary" id="btn-use-pasted" style="margin-top:8px; width:100%;">Genera da testo incollato</button>
    </div>
  `;
}

// === Setup Event Handlers ===

function setupGenerateFlow(linkId, boardId, link) {
  const btn = document.getElementById('btn-generate');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      showToast('Inserisci la API key nelle Impostazioni');
      setTimeout(() => Router.navigate('#/settings'), 1500);
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Recupero testo...';
    const statusEl = document.getElementById('fetching-status');
    if (statusEl) statusEl.style.display = 'flex';

    // Try to fetch article text via Jina Reader (with timeout)
    let articleText = await fetchArticleText(link.url, linkId);

    if (articleText) {
      // Got text, generate summary
      btn.textContent = 'Generando riassunto...';
      if (statusEl) statusEl.style.display = 'none';
      await doGenerateSummary(linkId, boardId, link, articleText, apiKey);
    } else {
      // Jina failed — show paste fallback
      btn.style.display = 'none';
      if (statusEl) statusEl.style.display = 'none';
      const contentEl = document.getElementById('summary-content');
      const promptEl = contentEl.querySelector('.summary-prompt');
      if (promptEl) {
        promptEl.innerHTML = renderPasteFallback();
        setupPasteFallback(linkId, boardId, link, apiKey);
      }
    }
  });
}

function setupPasteFallback(linkId, boardId, link, apiKey) {
  const pasteBtn = document.getElementById('btn-use-pasted');
  if (!pasteBtn) return;

  pasteBtn.addEventListener('click', async () => {
    const pasted = document.getElementById('article-paste').value.trim();
    if (!pasted) {
      showToast('Incolla il testo dell\'articolo');
      return;
    }
    pasteBtn.disabled = true;
    pasteBtn.textContent = 'Generando riassunto...';
    await doGenerateSummary(linkId, boardId, link, pasted, apiKey);
  });
}

function setupSummaryActions(content, link) {
  const copyBtn = document.getElementById('btn-copy-summary');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(content).then(() => {
        showToast('Riassunto copiato');
      }).catch(() => {
        showToast('Errore nella copia');
      });
    });
  }
}

function setupRegenerateBtn(linkId, boardId, link) {
  const regenBtn = document.getElementById('btn-regenerate');
  if (!regenBtn) return;

  regenBtn.addEventListener('click', async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      showToast('Inserisci la API key nelle Impostazioni');
      return;
    }

    regenBtn.disabled = true;
    regenBtn.textContent = 'Recupero testo...';

    let articleText = await fetchArticleText(link.url, linkId);

    if (articleText) {
      regenBtn.textContent = 'Rigenerando...';
      await doGenerateSummary(linkId, boardId, link, articleText, apiKey);
    } else {
      // Show paste fallback in the summary result area
      regenBtn.textContent = 'Rigenera';
      regenBtn.disabled = false;
      const contentEl = document.getElementById('summary-content');
      const resultEl = contentEl.querySelector('.summary-result');
      if (resultEl) {
        const fallbackDiv = document.createElement('div');
        fallbackDiv.innerHTML = renderPasteFallback();
        resultEl.appendChild(fallbackDiv);
        setupPasteFallback(linkId, boardId, link, apiKey);
      }
    }
  });
}

// === Fetch Article Text ===

async function fetchArticleText(url, linkId) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch('https://r.jina.ai/' + url, {
      headers: { 'Accept': 'text/plain' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (response.ok) {
      const text = await response.text();
      if (text && text.length > 100) {
        // Auto-update title if it still shows the domain
        if (linkId) {
          try {
            const link = await db.links.get(linkId);
            const domain = link?.domain || '';
            if (link && (link.title === domain || link.title.length < 5)) {
              // Extract title from first heading in Jina text
              const firstLine = text.split('\n').find(l => l.trim().startsWith('#'));
              if (firstLine) {
                const extracted = firstLine.replace(/^#+\s*/, '').trim();
                if (extracted.length > 5) {
                  await db.links.update(linkId, { title: extracted });
                  const titleInput = document.getElementById('link-title-input');
                  if (titleInput) titleInput.value = extracted;
                }
              }
            }
          } catch (e) { /* ignore title update errors */ }
        }
        return text;
      }
    }
  } catch (e) {
    // Jina failed or timed out
  }
  return null;
}

// === Generate Summary with Claude ===

async function doGenerateSummary(linkId, boardId, link, text, apiKey) {
  const prompt = `Sei un assistente editoriale. Analizza questo articolo e fornisci un riassunto schematico che includa:

- **Titolo e fonte** dell'articolo
- **Tesi principale**: la tesi o il messaggio chiave in 1-2 frasi
- **Dati chiave**: numeri, statistiche, date rilevanti (elenco puntato)
- **Attori coinvolti**: persone, aziende, organizzazioni menzionate
- **Contesto**: perché questo articolo è rilevante nel panorama attuale
- **Citazioni notevoli**: massimo 2 citazioni dirette significative

Sii conciso e schematico. Il riassunto serve per decidere rapidamente se e come usare questo articolo in una newsletter su AI e tecnologia.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Articolo: "${link.title}" da ${link.domain}\n\n${text.substring(0, 12000)}`
        }],
        system: prompt
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Errore API: ' + response.status);
    }

    const data = await response.json();
    const summaryContent = data.content?.[0]?.text || 'Nessun riassunto generato';

    // Save to DB
    await saveSummary(linkId, boardId, summaryContent);

    // Re-render with result
    const contentEl = document.getElementById('summary-content');
    if (contentEl) {
      contentEl.innerHTML = renderSummaryResult(summaryContent);
      setupSummaryActions(summaryContent, link);
      setupRegenerateBtn(linkId, boardId, link);
    }
    showToast('Riassunto generato');

  } catch (err) {
    showToast('Errore: ' + err.message);
    // Re-render the view to reset state
    renderArticle({ boardId, linkId });
  }
}

// === Formatting Helpers ===

function formatSummaryContent(md) {
  return md
    .split('\n')
    .map(line => {
      line = line.trim();
      if (!line) return '<br>';
      // Bold
      line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      // Italic
      line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
      if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
      if (line.startsWith('# ')) return `<p class="sheet-h1">${line.slice(2)}</p>`;
      if (line.startsWith('## ')) return `<p class="sheet-h2">${line.slice(3)}</p>`;
      return `<p>${line}</p>`;
    })
    .join('\n');
}

// === API Key Management ===

function getApiKey() {
  const encrypted = localStorage.getItem('curator_api_key');
  if (!encrypted) return null;
  try {
    return atob(encrypted);
  } catch {
    return encrypted;
  }
}

function setApiKey(key) {
  if (key) {
    localStorage.setItem('curator_api_key', btoa(key));
  } else {
    localStorage.removeItem('curator_api_key');
  }
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
