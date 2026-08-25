// Backup automatico su WordPress
// - backup all'avvio dell'app (con rotazione dello storico)
// - backup automatico ~10 secondi dopo ogni modifica ai dati
// - rotazione delle ultime 5 versioni su post separati
// - blocco anti disastro: mai sovrascrivere un backup pieno con un database vuoto
// - stato dell'ultimo backup visibile in Impostazioni e in Home

const AUTO_BACKUP_DELAY_MS = 10000;
const BACKUP_SLOTS = 5;
const BACKUP_STALE_DAYS = 3;
const LS_BACKUP_STATE = 'curator_backup_state';
const B64_PREFIX = 'CURATORB64:';

function histSlug(slot) {
  return 'curator-backup-hist-' + slot;
}

// === Stato locale del backup ===

function getBackupState() {
  try {
    return JSON.parse(localStorage.getItem(LS_BACKUP_STATE)) || {};
  } catch {
    return {};
  }
}

function setBackupState(patch) {
  const state = Object.assign(getBackupState(), patch);
  localStorage.setItem(LS_BACKUP_STATE, JSON.stringify(state));
  return state;
}

function formatBackupDate(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// === Codifica del contenuto ===
// Il payload viene salvato in base64 per non farlo rovinare dai filtri di WordPress.
// I backup vecchi (JSON in chiaro) restano leggibili.

function encodePayload(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return B64_PREFIX + btoa(bin);
}

function decodePayload(rawContent) {
  const clean = String(rawContent).replace(/<[^>]*>/g, '').trim();
  if (clean.indexOf(B64_PREFIX) === 0) {
    const b64 = clean.slice(B64_PREFIX.length).replace(/\s+/g, '');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  const txt = document.createElement('textarea');
  txt.innerHTML = clean;
  return JSON.parse(txt.value);
}

function postRawContent(post) {
  if (!post) return '';
  return (post.content && post.content.rendered) ? post.content.rendered : (post.content || '');
}

// === Chiamate a WordPress ===

async function wpGetPostBySlug(slug) {
  const { auth, endpoint } = await wpAuthHeaders();
  const url = endpoint + '?slug=' + slug + '&status=private,publish,draft&_=' + Date.now();
  const res = await fetch(url, { headers: { 'Authorization': auth } });
  if (!res.ok) throw new Error('WordPress non raggiungibile (' + res.status + ')');
  const posts = await res.json();
  return posts.length > 0 ? posts[0] : null;
}

async function wpSavePost(slug, title, content, existingPost) {
  const { auth, endpoint } = await wpAuthHeaders();
  const url = existingPost ? (endpoint + '/' + existingPost.id) : endpoint;
  const body = existingPost
    ? { content, status: 'private' }
    : { title, slug, content, status: 'private' };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': auth },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Salvataggio non riuscito (' + res.status + ')');
  return res.json();
}

// === Backup ===

function sameBackupData(a, b) {
  const norm = (d) => JSON.stringify({
    boards: d.boards || [],
    links: d.links || [],
    summaries: d.summaries || []
  });
  return norm(a) === norm(b);
}


async function performBackup(options) {
  const opts = options || {};
  const creds = getWpCredentials();
  if (!creds) {
    const err = new Error('Credenziali WordPress non configurate. Vai in Impostazioni.');
    err.noCreds = true;
    throw err;
  }

  const data = await exportAllData();
  data.wpCredentials = localStorage.getItem('curator_wp_credentials');

  const current = await wpGetPostBySlug(BACKUP_SLUG);
  let remote = null;
  if (current) {
    try { remote = decodePayload(postRawContent(current)); } catch { remote = null; }
  }

  const state = getBackupState();
  const localBoards = (data.boards || []).length;
  const remoteBoards = (remote && remote.boards) ? remote.boards.length : 0;

  // Protezione anti disastro. Si blocca in due casi:
  // 1. l'app e' vuota e su WordPress c'e' un backup pieno;
  // 2. questa installazione non ha mai completato un backup (storage ripulito
  //    o telefono nuovo) e su WordPress esiste gia' un backup con dei dati.
  // In entrambi i casi decide l'utente: Ripristina, oppure backup forzato.
  if (!opts.force && remoteBoards > 0 && (localBoards === 0 || !state.lastOkAt)) {
    setBackupState({
      blocked: true,
      blockedAt: Date.now(),
      remoteBoards: remoteBoards,
      remoteLinks: (remote.links || []).length,
      localBoards: localBoards
    });
    const err = new Error(localBoards === 0
      ? 'Backup sospeso: l\'app è vuota ma su WordPress ci sono ' + remoteBoards + ' board. Usa Ripristina.'
      : 'Backup sospeso: su WordPress c\'è un backup con ' + remoteBoards +
        ' board che questa app non conosce. Ripristina, oppure forza il backup da Impostazioni.');
    err.blocked = true;
    throw err;
  }
  setBackupState({ blocked: false });

  // Se i dati coincidono con quelli già online non si riscrive nulla.
  if (remote && sameBackupData(remote, data)) {
    setBackupState({
      lastOkAt: Date.now(), lastError: null, lastErrorAt: null,
      boards: localBoards, links: (data.links || []).length
    });
    return { boards: localBoards, links: (data.links || []).length, unchanged: true };
  }

  // Rotazione: la copia attualmente online viene messa da parte prima di sovrascriverla.
  if (opts.rotate && current) {
    try {
      const state = getBackupState();
      const slot = ((state.slot || 0) % BACKUP_SLOTS) + 1;
      let histContent;
      try {
        histContent = encodePayload(decodePayload(postRawContent(current)));
      } catch {
        histContent = postRawContent(current);
      }
      const existingHist = await wpGetPostBySlug(histSlug(slot));
      await wpSavePost(histSlug(slot), 'Curator Backup storico ' + slot, histContent, existingHist);
      setBackupState({ slot, ['slotDate' + slot]: Date.now() });
    } catch (e) {
      // Se la rotazione fallisce il backup principale deve comunque partire.
    }
  }

  await wpSavePost(BACKUP_SLUG, 'Curator Backup', encodePayload(data), current);

  setBackupState({
    lastOkAt: Date.now(),
    lastError: null,
    lastErrorAt: null,
    blocked: false,
    boards: data.boards.length,
    links: data.links.length
  });

  return { boards: data.boards.length, links: data.links.length };
}

// === Ripristino ===

async function restoreFromSlug(slug) {
  const post = await wpGetPostBySlug(slug);
  if (!post) throw new Error('Nessun backup trovato');
  const data = decodePayload(postRawContent(post));
  const wpCreds = data.wpCredentials;
  delete data.wpCredentials;
  await importAllData(data);
  if (wpCreds) localStorage.setItem('curator_wp_credentials', wpCreds);
  setBackupState({ blocked: false });
  return { boards: (data.boards || []).length, links: (data.links || []).length };
}

async function listBackupVersions() {
  const versions = [];
  const main = await wpGetPostBySlug(BACKUP_SLUG);
  if (main) versions.push(describeVersion(main, BACKUP_SLUG, 'Backup corrente'));
  for (let slot = 1; slot <= BACKUP_SLOTS; slot++) {
    try {
      const post = await wpGetPostBySlug(histSlug(slot));
      if (post) versions.push(describeVersion(post, histSlug(slot), 'Versione precedente ' + slot));
    } catch {
      // slot non disponibile, si prosegue
    }
  }
  return versions;
}

function describeVersion(post, slug, label) {
  let boards = null, links = null;
  try {
    const data = decodePayload(postRawContent(post));
    boards = (data.boards || []).length;
    links = (data.links || []).length;
  } catch {
    // contenuto illeggibile: mostrato comunque, senza conteggi
  }
  return {
    slug,
    label,
    modified: post.modified || post.date,
    boards,
    links
  };
}

// === Automatismo ===

let backupTimer = null;
let backupRunning = false;
let backupPending = false;

function scheduleAutoBackup() {
  if (!getWpCredentials()) return;
  clearTimeout(backupTimer);
  backupTimer = setTimeout(() => runAutoBackup(), AUTO_BACKUP_DELAY_MS);
}

async function runAutoBackup(options) {
  const opts = options || {};
  if (!getWpCredentials()) return;
  if (backupRunning) { backupPending = true; return; }
  backupRunning = true;
  clearTimeout(backupTimer);
  try {
    await performBackup({ rotate: !!opts.rotate });
  } catch (err) {
    setBackupState({ lastError: err.message, lastErrorAt: Date.now() });
  } finally {
    backupRunning = false;
    if (backupPending) {
      backupPending = false;
      scheduleAutoBackup();
    }
    updateBackupBanner();
  }
}

function flushAutoBackup() {
  if (backupTimer) {
    clearTimeout(backupTimer);
    backupTimer = null;
    runAutoBackup();
  }
}

function attachBackupHooks() {
  ['boards', 'links', 'summaries'].forEach((table) => {
    if (!db[table]) return;
    db[table].hook('creating', () => { scheduleAutoBackup(); });
    db[table].hook('updating', () => { scheduleAutoBackup(); });
    db[table].hook('deleting', () => { scheduleAutoBackup(); });
  });
}

// === Avviso in Home ===

function getBackupWarning() {
  const state = getBackupState();
  if (!getWpCredentials()) {
    return { level: 'warn', text: 'Backup non attivo: configura WordPress in Impostazioni.' };
  }
  if (state.blocked) {
    const local = state.localBoards || 0;
    return {
      level: 'danger',
      text: local === 0
        ? 'App vuota, backup sospeso. Su WordPress ci sono ' + (state.remoteBoards || 0) +
          ' board: apri Impostazioni e usa Ripristina.'
        : 'Backup sospeso: su WordPress ci sono ' + (state.remoteBoards || 0) +
          ' board che questa app non conosce. Apri Impostazioni.'
    };
  }
  if (state.lastError && (!state.lastOkAt || state.lastErrorAt > state.lastOkAt)) {
    return { level: 'danger', text: 'Ultimo backup non riuscito: ' + state.lastError };
  }
  if (!state.lastOkAt) {
    return { level: 'warn', text: 'Nessun backup ancora eseguito.' };
  }
  const days = (Date.now() - state.lastOkAt) / 86400000;
  if (days > BACKUP_STALE_DAYS) {
    return { level: 'warn', text: 'Ultimo backup ' + formatBackupDate(state.lastOkAt) + '. Controlla la connessione.' };
  }
  return null;
}

function updateBackupBanner() {
  const existing = document.querySelector('.backup-banner');
  if (existing) existing.remove();
  if (location.hash && location.hash !== '#/' && location.hash !== '') return;
  const warning = getBackupWarning();
  if (!warning) return;
  const container = document.querySelector('#app .view-enter') || document.getElementById('app');
  if (!container) return;
  const banner = document.createElement('div');
  banner.className = 'backup-banner backup-banner-' + warning.level;
  banner.textContent = warning.text;
  banner.addEventListener('click', () => Router.navigate('#/settings'));
  const header = container.querySelector('.header');
  if (header && header.nextSibling) {
    container.insertBefore(banner, header.nextSibling);
  } else {
    container.insertBefore(banner, container.firstChild);
  }
}

// === Avvio ===

function initAutoBackup() {
  attachBackupHooks();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAutoBackup();
  });
  window.addEventListener('pagehide', flushAutoBackup);
  window.addEventListener('online', () => {
    const state = getBackupState();
    if (state.lastError) scheduleAutoBackup();
  });

  // Backup all'avvio, con rotazione dello storico. Ritardato per non rallentare l'apertura.
  setTimeout(() => runAutoBackup({ rotate: true }), 3000);
}
