// Database layer using Dexie.js (IndexedDB wrapper)

const db = new Dexie('NewsletterCurator');

db.version(1).stores({
  boards: 'id, name, createdAt, updatedAt',
  links: 'id, boardId, url, sortOrder, createdAt, updatedAt',
  summaries: 'id, linkId, boardId, generatedAt'
});

// === Board Operations ===

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

async function createBoard(name) {
  const now = Date.now();
  const board = {
    id: generateId(),
    name: name.trim(),
    createdAt: now,
    updatedAt: now
  };
  await db.boards.add(board);
  return board;
}

async function getAllBoards() {
  const boards = await db.boards.toArray();
  // Sort by createdAt descending (most recent first)
  boards.sort((a, b) => b.createdAt - a.createdAt);
  // Attach link count to each board
  for (const board of boards) {
    board.linkCount = await db.links.where('boardId').equals(board.id).count();
  }
  return boards;
}

async function getBoard(id) {
  return db.boards.get(id);
}

async function renameBoard(id, newName) {
  await db.boards.update(id, { name: newName.trim(), updatedAt: Date.now() });
}

async function deleteBoard(id) {
  // Delete all links and summaries in this board
  await db.links.where('boardId').equals(id).delete();
  await db.summaries.where('boardId').equals(id).delete();
  await db.boards.delete(id);
}

// === Link Operations ===

async function addLink(boardId, url, title, domain) {
  const now = Date.now();
  // New links go to the top (lowest sortOrder)
  const links = await db.links.where('boardId').equals(boardId).toArray();
  const minOrder = links.length > 0 ? Math.min(...links.map(l => l.sortOrder || 0)) : 1;

  const link = {
    id: generateId(),
    boardId,
    url,
    title: title || domain,
    domain,
    thumbnailUrl: null,
    sortOrder: minOrder - 1,
    createdAt: now,
    updatedAt: now
  };
  await db.links.add(link);
  return link;
}

async function getBoardLinks(boardId) {
  const links = await db.links.where('boardId').equals(boardId).toArray();
  links.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return links;
}

async function updateLinkSortOrders(orderedIds) {
  const updates = orderedIds.map((id, index) =>
    db.links.update(id, { sortOrder: index, updatedAt: Date.now() })
  );
  await Promise.all(updates);
}

async function deleteLinks(ids) {
  await db.links.bulkDelete(ids);
  // Also delete associated summaries
  for (const id of ids) {
    await db.summaries.where('linkId').equals(id).delete();
  }
}

async function moveLinks(ids, targetBoardId) {
  const now = Date.now();
  // Get max sortOrder in target board
  const targetLinks = await db.links.where('boardId').equals(targetBoardId).toArray();
  let maxOrder = targetLinks.length > 0 ? Math.max(...targetLinks.map(l => l.sortOrder || 0)) : -1;

  for (const id of ids) {
    maxOrder++;
    await db.links.update(id, { boardId: targetBoardId, sortOrder: maxOrder, updatedAt: now });
    // Also move associated summaries
    await db.summaries.where('linkId').equals(id).modify({ boardId: targetBoardId });
  }
}

async function copyLinks(ids, targetBoardId) {
  const now = Date.now();
  const targetLinks = await db.links.where('boardId').equals(targetBoardId).toArray();
  let maxOrder = targetLinks.length > 0 ? Math.max(...targetLinks.map(l => l.sortOrder || 0)) : -1;

  for (const id of ids) {
    const original = await db.links.get(id);
    if (!original) continue;
    maxOrder++;
    const copy = {
      id: generateId(),
      boardId: targetBoardId,
      url: original.url,
      title: original.title,
      domain: original.domain,
      tag: original.tag,
      thumbnailUrl: original.thumbnailUrl,
      sortOrder: maxOrder,
      createdAt: now,
      updatedAt: now
    };
    await db.links.add(copy);
  }
}

// === Summary Operations ===

async function saveSummary(linkId, boardId, content) {
  const existing = await db.summaries.where('linkId').equals(linkId).first();
  if (existing) {
    await db.summaries.update(existing.id, { content, generatedAt: Date.now() });
    return existing;
  }
  const summary = {
    id: generateId(),
    linkId,
    boardId,
    content,
    generatedAt: Date.now()
  };
  await db.summaries.add(summary);
  return summary;
}

async function getSummaryForLink(linkId) {
  return db.summaries.where('linkId').equals(linkId).first();
}

async function getBoardSummaries(boardId) {
  return db.summaries.where('boardId').equals(boardId).toArray();
}

// === Export/Import ===

async function exportAllData() {
  const boards = await db.boards.toArray();
  const links = await db.links.toArray();
  const summaries = await db.summaries.toArray();
  return { boards, links, summaries, exportedAt: Date.now() };
}

async function importAllData(data) {
  await db.transaction('rw', db.boards, db.links, db.summaries, async () => {
    await db.boards.clear();
    await db.links.clear();
    await db.summaries.clear();
    if (data.boards) await db.boards.bulkAdd(data.boards);
    if (data.links) await db.links.bulkAdd(data.links);
    if (data.summaries) await db.summaries.bulkAdd(data.summaries);
  });
}
