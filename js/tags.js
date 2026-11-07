// Tag: colori fissi, ordine delle sezioni per board, rinomina ed eliminazione
// Specifica: docs/specifiche-sezioni-colori-tag_2026-11-07.md

// 8 colori ben distinti (tinta, saturazione, luminosità), leggibili con testo bianco
const TAG_PALETTE = [
  [355, 75, 50],  // rosso
  [25, 90, 47],   // arancio
  [45, 90, 38],   // ocra
  [140, 60, 35],  // verde
  [190, 80, 36],  // petrolio
  [225, 72, 56],  // blu
  [275, 55, 54],  // viola
  [320, 65, 50]   // magenta
];
// Variazioni di luminosità usate dal nono tag in poi
const TAG_SHADE_OFFSETS = [0, -13, 11, -21, 18];

function tagColorFromIndex(index) {
  const i = Math.max(0, index | 0);
  const [h, s, l] = TAG_PALETTE[i % TAG_PALETTE.length];
  const round = Math.floor(i / TAG_PALETTE.length);
  const offset = TAG_SHADE_OFFSETS[round % TAG_SHADE_OFFSETS.length];
  const hueShift = Math.floor(round / TAG_SHADE_OFFSETS.length) * 8;
  const light = Math.min(64, Math.max(22, l + offset));
  return `hsl(${(h + hueShift) % 360}, ${s}%, ${light}%)`;
}

// Cache in memoria: nome del tag -> indice colore
let tagColorCache = {};

async function loadTagColors() {
  const records = await db.tags.toArray();
  const cache = {};
  for (const r of records) cache[r.name] = r.colorIndex;
  tagColorCache = cache;
  return cache;
}

// Colore di un tag, letto dalla cache (caricata prima di ogni rendering)
function tagColor(tag) {
  if (tag in tagColorCache) return tagColorFromIndex(tagColorCache[tag]);
  return 'hsl(230, 10%, 45%)';
}

// Allinea l'archivio dei tag ai link:
// - un tag non più usato da nessun link viene tolto (il suo colore torna libero)
// - un tag senza colore prende l'indice libero più basso; se sono più d'uno,
//   i colori più bassi vanno ai tag usati più di recente
async function syncTagRecords() {
  const links = await db.links.toArray();
  const latestUse = new Map();
  for (const l of links) {
    if (!l.tag) continue;
    const t = l.createdAt || 0;
    if (!latestUse.has(l.tag) || latestUse.get(l.tag) < t) latestUse.set(l.tag, t);
  }

  const records = await db.tags.toArray();
  const orphans = records.filter(r => !latestUse.has(r.name)).map(r => r.name);
  const kept = records.filter(r => latestUse.has(r.name));
  const known = new Set(kept.map(r => r.name));
  const used = new Set(kept.map(r => r.colorIndex));

  const missing = [...latestUse.keys()]
    .filter(name => !known.has(name))
    .sort((a, b) => latestUse.get(b) - latestUse.get(a));

  const now = Date.now();
  const toAdd = [];
  let next = 0;
  for (const name of missing) {
    while (used.has(next)) next++;
    used.add(next);
    toAdd.push({ name, colorIndex: next, createdAt: now });
  }

  if (orphans.length || toAdd.length) {
    await db.transaction('rw', db.tags, db.boards, async () => {
      if (orphans.length) {
        await db.tags.bulkDelete(orphans);
        // Un tag sparito esce anche dall'ordine delle sezioni: se rinasce, entra in fondo
        const gone = new Set(orphans);
        const boards = await db.boards.toArray();
        for (const b of boards) {
          if (Array.isArray(b.tagOrder) && b.tagOrder.some(t => gone.has(t))) {
            await db.boards.update(b.id, { tagOrder: b.tagOrder.filter(t => !gone.has(t)) });
          }
        }
      }
      if (toAdd.length) await db.tags.bulkAdd(toAdd);
    });
  }
  await loadTagColors();
}

// === Ordine delle sezioni ===

// Tag presenti nella board, nell'ordine in cui compaiono adesso
function tagsInAppearanceOrder(links) {
  const seen = [];
  const set = new Set();
  const sorted = [...links].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  for (const l of sorted) {
    if (l.tag && !set.has(l.tag)) { set.add(l.tag); seen.push(l.tag); }
  }
  return seen;
}

// Ordine effettivo delle sezioni: quello salvato nella board, con in coda i tag nuovi.
// Alla prima apertura si usa l'ordine in cui i tag compaiono nella board.
function computeSectionOrder(board, links) {
  const present = tagsInAppearanceOrder(links);
  const presentSet = new Set(present);
  const saved = Array.isArray(board.tagOrder) ? board.tagOrder : [];
  const order = saved.filter(t => presentSet.has(t));
  for (const t of present) if (!order.includes(t)) order.push(t);
  return order;
}

function sameArray(a, b) {
  return Array.isArray(a) && Array.isArray(b) &&
    a.length === b.length && a.every((v, i) => v === b[i]);
}

// Riordina la board secondo le sezioni: tag nell'ordine della board, senza tag in fondo,
// e dentro ogni sezione l'ordine attuale dei link. Restituisce ordine e conteggi.
async function sortBoardBySections(boardId) {
  const board = await getBoard(boardId);
  if (!board) return { order: [], counts: {}, untagged: 0 };
  const links = await getBoardLinks(boardId);
  const order = computeSectionOrder(board, links);

  if (!sameArray(board.tagOrder, order)) {
    await db.boards.update(boardId, { tagOrder: order });
  }

  const pos = new Map(order.map((t, i) => [t, i]));
  const rank = (l) => (l.tag && pos.has(l.tag)) ? pos.get(l.tag) : order.length;
  const sorted = links
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (rank(a.l) - rank(b.l)) || (a.i - b.i))
    .map(x => x.l);

  const changed = sorted.some((l, i) => l.id !== links[i].id);
  if (changed) await updateLinkSortOrders(sorted.map(l => l.id));

  const counts = {};
  let untagged = 0;
  for (const l of links) {
    if (l.tag) counts[l.tag] = (counts[l.tag] || 0) + 1;
    else untagged++;
  }
  return { order, counts, untagged };
}

// Salva un nuovo ordine delle sezioni e riordina subito la board
async function setBoardSectionOrder(boardId, order) {
  await db.boards.update(boardId, { tagOrder: order });
  return sortBoardBySections(boardId);
}

// Copia e spostamento: la board di destinazione eredita l'ordine delle sezioni
// dei link che riceve (i tag che non conosce si aggiungono in coda)
async function carryTagOrder(ids, targetBoardId) {
  const moving = (await db.links.bulkGet(ids)).filter(Boolean);
  if (!moving.length) return;
  const target = await getBoard(targetBoardId);
  if (!target) return;

  const sourceIds = [...new Set(moving.map(l => l.boardId))];
  const incoming = [];
  for (const sid of sourceIds) {
    const source = await getBoard(sid);
    if (!source) continue;
    const sourceLinks = await getBoardLinks(sid);
    const movingTags = new Set(moving.filter(l => l.boardId === sid && l.tag).map(l => l.tag));
    for (const t of computeSectionOrder(source, sourceLinks)) {
      if (movingTags.has(t) && !incoming.includes(t)) incoming.push(t);
    }
  }
  if (!incoming.length) return;

  const targetLinks = await getBoardLinks(targetBoardId);
  const targetOrder = computeSectionOrder(target, targetLinks);
  for (const t of incoming) if (!targetOrder.includes(t)) targetOrder.push(t);
  if (!sameArray(target.tagOrder, targetOrder)) {
    await db.boards.update(targetBoardId, { tagOrder: targetOrder });
  }
}

// === Rinomina ed eliminazione ===

// Tag esistente con lo stesso nome (anche solo per maiuscole e minuscole), diverso da quello indicato
async function findTagConflict(oldName, newName) {
  const records = await db.tags.toArray();
  const lower = newName.toLowerCase();
  const hit = records.find(r => r.name !== oldName && r.name.toLowerCase() === lower);
  return hit ? hit.name : null;
}

// Rinomina un tag su tutte le board. Se il nome esiste già, i due tag si uniscono:
// restano nome e colore del tag esistente.
async function renameTag(oldName, newName) {
  newName = (newName || '').trim().substring(0, 30);
  if (!newName || newName === oldName) return { changed: false };
  const conflict = await findTagConflict(oldName, newName);
  const target = conflict || newName;
  const now = Date.now();

  await db.transaction('rw', db.links, db.tags, db.boards, async () => {
    await db.links.filter(l => l.tag === oldName)
      .modify({ tag: target, updatedAt: now });

    const rec = await db.tags.get(oldName);
    await db.tags.delete(oldName);
    if (!conflict && rec) {
      await db.tags.put({ name: target, colorIndex: rec.colorIndex, createdAt: rec.createdAt });
    }

    const boards = await db.boards.toArray();
    for (const b of boards) {
      if (!Array.isArray(b.tagOrder) || !b.tagOrder.includes(oldName)) continue;
      let order;
      if (b.tagOrder.includes(target)) {
        order = b.tagOrder.filter(t => t !== oldName);
      } else {
        order = b.tagOrder.map(t => t === oldName ? target : t);
      }
      await db.boards.update(b.id, { tagOrder: order });
    }
  });

  await syncTagRecords();
  return { changed: true, merged: !!conflict, name: target };
}

// Elimina un tag da tutti i link e da tutte le board; il suo colore torna libero
async function deleteTag(name) {
  const now = Date.now();
  let count = 0;
  await db.transaction('rw', db.links, db.tags, db.boards, async () => {
    count = await db.links.filter(l => l.tag === name)
      .modify(l => { delete l.tag; l.updatedAt = now; });
    await db.tags.delete(name);
    const boards = await db.boards.toArray();
    for (const b of boards) {
      if (Array.isArray(b.tagOrder) && b.tagOrder.includes(name)) {
        await db.boards.update(b.id, { tagOrder: b.tagOrder.filter(t => t !== name) });
      }
    }
  });
  await syncTagRecords();
  return count;
}
