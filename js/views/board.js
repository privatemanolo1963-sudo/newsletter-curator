// Board View — Link List

// Track selection state
let selectedIds = new Set();

async function renderBoard(params) {
  const boardId = params.id;
  const board = await getBoard(boardId);

  if (!board) {
    Router.navigate('#/');
    return;
  }

  const links = await getBoardLinks(boardId);
  await loadTagColors();

  const app = document.getElementById('app');
  window.scrollTo(0, 0);

  let html = `
    <div class="view-enter">
      <div class="board-header">
        <button class="btn-back" id="btn-back" title="Indietro">&#8592;</button>
        <input class="board-title-input" id="board-title" value="${escapeHtml(board.name)}" spellcheck="false">
        <button class="btn-header-action" id="btn-paste-note" title="Incolla articolo">Note</button>
        <button class="btn-header-action" id="btn-sort-tag" title="Ordina per tag">Tag</button>
        <button class="btn-header-action" id="btn-export-all" title="Esporta tutti">Mail</button>
      </div>
      <div class="link-input-bar">
        <div class="link-input-wrapper">
          <input class="link-input" id="link-url-input" type="url" placeholder="Incolla un link..." autocomplete="off">
          <button class="btn-save-link" id="btn-save-link">Salva</button>
        </div>
      </div>
  `;

  if (links.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-state-icon">&#128279;</div>
        <div class="empty-state-text">Nessun link ancora.<br>Incolla un URL qui sopra per iniziare.</div>
      </div>
    `;
  } else {
    html += '<div class="link-list" id="link-list">';
    for (const link of links) {
      const isSelected = selectedIds.has(link.id);
      html += renderLinkCard(link, isSelected);
    }
    html += '</div>';

    // (buttons moved to header)
  }

  html += '</div>';
  app.innerHTML = html;

  // Update action bar visibility
  updateActionBar(boardId, board.name, links);

  // Event: back button
  document.getElementById('btn-back').addEventListener('click', () => {
    selectedIds.clear();
    Router.navigate('#/');
  });

  // Event: rename board on blur
  const titleInput = document.getElementById('board-title');
  let originalName = board.name;
  titleInput.addEventListener('blur', async () => {
    const newName = titleInput.value.trim();
    if (newName && newName !== originalName) {
      await renameBoard(boardId, newName);
      originalName = newName;
    } else if (!newName) {
      titleInput.value = originalName;
    }
  });
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') titleInput.blur();
  });

  // Event: save link
  const urlInput = document.getElementById('link-url-input');
  const saveBtn = document.getElementById('btn-save-link');

  const saveLink = async () => {
    const url = urlInput.value.trim();
    if (!url) return;
    if (!isValidUrl(url)) {
      showToast('URL non valido');
      return;
    }

    saveBtn.textContent = '...';
    saveBtn.disabled = true;
    urlInput.disabled = true;

    // Add shimmer placeholder
    const listEl = document.getElementById('link-list');
    const shimmer = document.createElement('div');
    shimmer.className = 'link-card-loading';
    if (listEl) {
      listEl.appendChild(shimmer);
    }

    // Normalize URL
    const fullUrl = url.startsWith('http') ? url : 'https://' + url;

    try {
      const { title, domain } = await fetchLinkMeta(fullUrl);
      await addLink(boardId, fullUrl, title, domain);
      urlInput.value = '';
      renderBoard(params);
    } catch (err) {
      const domain = extractDomain(fullUrl);
      await addLink(boardId, fullUrl, domain, domain);
      urlInput.value = '';
      renderBoard(params);
    }
  };

  saveBtn.addEventListener('click', saveLink);
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveLink();
  });

  // Auto-detect paste
  urlInput.addEventListener('paste', () => {
    setTimeout(() => {
      const val = urlInput.value.trim();
      if (val && isValidUrl(val)) {
        saveLink();
      }
    }, 100);
  });

  // Initialize drag & drop with SortableJS
  initDragDrop(boardId);

  // Click on title → summary view (stay in app)
  document.querySelectorAll('.link-card-title').forEach(el => {
    el.addEventListener('click', () => {
      const linkId = el.closest('.link-card').dataset.id;
      Router.navigate('#/board/' + boardId + '/link/' + linkId);
    });
  });

  // Click on tag → open tag editor
  document.querySelectorAll('.link-card-tag').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      showTagModal(el.dataset.id, boardId, params);
    });
  });

  // Checkbox selection
  document.querySelectorAll('.link-card-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        selectedIds.add(cb.dataset.id);
      } else {
        selectedIds.delete(cb.dataset.id);
      }
      updateActionBar(boardId, board.name, links);
    });
  });

  // Tag: riordina la board per sezioni e apre il pannello Sezioni
  const sortTagBtn = document.getElementById('btn-sort-tag');
  if (sortTagBtn) {
    sortTagBtn.addEventListener('click', async () => {
      const result = await sortBoardBySections(boardId);
      if (result.order.length === 0) {
        showToast('Nessun tag in questa board');
        return;
      }
      await renderBoard(params);
      showSectionsPanel(boardId, params, result);
    });
  }

  // Export all button
  const exportAllBtn = document.getElementById('btn-export-all');
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', async () => {
      const freshLinks = await getBoardLinks(boardId);
      exportLinksViaMail(board.name, freshLinks);
    });
  }

  // Paste note button
  const pasteNoteBtn = document.getElementById('btn-paste-note');
  if (pasteNoteBtn) {
    pasteNoteBtn.addEventListener('click', () => {
      showNoteModal(boardId, params);
    });
  }
}

// === Drag & Drop ===

function initDragDrop(boardId) {
  const listEl = document.getElementById('link-list');
  if (!listEl) return;

  let multiDragIds = []; // IDs being multi-dragged
  let multiDragEls = []; // DOM elements removed during multi-drag

  Sortable.create(listEl, {
    handle: '.link-card-drag',
    animation: 200,
    easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    ghostClass: 'link-card-ghost',
    chosenClass: 'link-card-chosen',
    dragClass: 'link-card-dragging',
    delay: 100,
    delayOnTouchOnly: true,
    touchStartThreshold: 3,
    fallbackTolerance: 3,
    onStart: (evt) => {
      const draggedId = evt.item.dataset.id;
      // If dragging a selected card and there are multiple selections, do multi-drag
      if (selectedIds.has(draggedId) && selectedIds.size > 1) {
        multiDragIds = [];
        multiDragEls = [];
        // Collect selected cards (except the one being dragged)
        const allCards = Array.from(listEl.querySelectorAll('.link-card'));
        for (const card of allCards) {
          if (card.dataset.id !== draggedId && selectedIds.has(card.dataset.id)) {
            multiDragIds.push(card.dataset.id);
            multiDragEls.push(card);
            card.style.display = 'none'; // hide during drag
          }
        }
        // Add badge to dragged item showing count
        const badge = document.createElement('span');
        badge.className = 'multi-drag-badge';
        badge.textContent = selectedIds.size;
        evt.item.appendChild(badge);
      } else {
        multiDragIds = [];
        multiDragEls = [];
      }
    },
    onEnd: async (evt) => {
      // Remove badge
      const badge = evt.item.querySelector('.multi-drag-badge');
      if (badge) badge.remove();

      if (multiDragEls.length > 0) {
        // Re-insert hidden cards in correct order after the dragged card
        let insertAfter = evt.item;
        for (const el of multiDragEls) {
          el.style.display = '';
          insertAfter.after(el);
          insertAfter = el;
        }
        // Now persist new order
        const cards = listEl.querySelectorAll('.link-card');
        const orderedIds = Array.from(cards).map(c => c.dataset.id);
        await updateLinkSortOrders(orderedIds);
        multiDragIds = [];
        multiDragEls = [];
      } else {
        if (evt.oldIndex === evt.newIndex) return;
        const cards = listEl.querySelectorAll('.link-card');
        const orderedIds = Array.from(cards).map(c => c.dataset.id);
        await updateLinkSortOrders(orderedIds);
      }
    }
  });
}

// === Link Card Rendering ===

function renderLinkCard(link, isSelected) {
  const tag = link.tag || '';
  const tagHtml = tag
    ? `<span class="link-card-tag" data-id="${link.id}" style="background:${tagColor(tag)}">${escapeHtml(tag)}</span>`
    : `<span class="link-card-tag link-card-tag-empty" data-id="${link.id}">+</span>`;

  return `
    <div class="link-card" data-id="${link.id}">
      <div class="link-card-drag" title="Trascina">&#9776;</div>
      <div class="link-card-content">
        <div class="link-card-title" data-url="${escapeHtml(link.url)}">${escapeHtml(link.title)}</div>
        <div class="link-card-domain-row">
          <span class="link-card-domain">${escapeHtml(link.domain)}</span>
          ${tagHtml}
        </div>
      </div>
      <input type="checkbox" class="link-card-checkbox" data-id="${link.id}" ${isSelected ? 'checked' : ''}>
    </div>
  `;
}

// I colori dei tag sono gestiti in js/tags.js (tagColor)

// === Pannello Sezioni ===

function showSectionsPanel(boardId, params, result) {
  document.getElementById('sections-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay sections-overlay';
  overlay.id = 'sections-overlay';

  const rows = result.order.map(t => `
    <div class="section-row" data-tag="${escapeHtml(t)}">
      <span class="section-row-drag">&#9776;</span>
      <span class="section-row-chip" style="background:${tagColor(t)}">${escapeHtml(t)}</span>
      <span class="section-row-count">${result.counts[t] || 0}</span>
    </div>`).join('');

  const untaggedRow = result.untagged > 0 ? `
    <div class="section-row section-row-fixed">
      <span class="section-row-drag"></span>
      <span class="section-row-label">Senza tag</span>
      <span class="section-row-count">${result.untagged}</span>
    </div>` : '';

  overlay.innerHTML = `
    <div class="modal sections-modal">
      <div class="sections-header">
        <h2>Sezioni</h2>
        <button class="sections-close" id="sections-close" title="Chiudi">&times;</button>
      </div>
      <div class="sections-list" id="sections-list">${rows}</div>
      ${untaggedRow}
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById('sections-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const listEl = document.getElementById('sections-list');
  Sortable.create(listEl, {
    animation: 180,
    ghostClass: 'section-row-ghost',
    chosenClass: 'section-row-chosen',
    delay: 80,
    delayOnTouchOnly: true,
    touchStartThreshold: 3,
    fallbackTolerance: 3,
    onEnd: async (evt) => {
      if (evt.oldIndex === evt.newIndex) return;
      const order = Array.from(listEl.querySelectorAll('.section-row')).map(r => r.dataset.tag);
      await setBoardSectionOrder(boardId, order);
      await renderBoard(params);
    }
  });
}

// === Action Bar ===

function updateActionBar(boardId, boardName, links) {
  // Remove existing action bar
  const existing = document.getElementById('action-bar');
  if (existing) existing.remove();

  if (selectedIds.size === 0) {
    return;
  }

  const allSelected = selectedIds.size === links.length;
  const bar = document.createElement('div');
  bar.className = 'action-bar';
  bar.id = 'action-bar';
  bar.innerHTML = `
    <span class="action-bar-count">${selectedIds.size}</span>
    <button class="btn btn-secondary" id="action-toggle-all">${allSelected ? 'Deseleziona' : 'Tutti'}</button>
    <button class="btn btn-secondary" id="action-move">Sposta</button>
    <button class="btn btn-secondary" id="action-copy">Copia</button>
    <button class="btn btn-danger" id="action-delete">Elimina</button>
  `;
  document.body.appendChild(bar);

  // Toggle all
  document.getElementById('action-toggle-all').addEventListener('click', () => {
    if (allSelected) {
      selectedIds.clear();
    } else {
      links.forEach(l => selectedIds.add(l.id));
    }
    // Update checkboxes
    document.querySelectorAll('.link-card-checkbox').forEach(cb => {
      cb.checked = selectedIds.has(cb.dataset.id);
    });
    updateActionBar(boardId, boardName, links);
  });

  // Move
  document.getElementById('action-move').addEventListener('click', () => {
    showMoveModal(boardId, links);
  });

  // Copy
  document.getElementById('action-copy').addEventListener('click', () => {
    showCopyModal(boardId, links);
  });

  // Delete
  document.getElementById('action-delete').addEventListener('click', () => {
    showDeleteLinksConfirm(boardId);
  });

}

// === Move Modal ===

async function showMoveModal(currentBoardId, links) {
  const boards = await getAllBoards();
  const otherBoards = boards.filter(b => b.id !== currentBoardId);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  let boardListHtml = '';
  for (const b of otherBoards) {
    boardListHtml += `<button class="move-board-option" data-id="${b.id}">${escapeHtml(b.name)} <span class="move-board-count">${b.linkCount} link</span></button>`;
  }

  overlay.innerHTML = `
    <div class="modal">
      <h2>Sposta ${selectedIds.size} link in...</h2>
      <div class="move-board-list">
        ${boardListHtml}
        <button class="move-board-option move-board-new" id="move-new-board">+ Nuova board</button>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="modal-cancel">Annulla</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  document.getElementById('modal-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Move to existing board
  overlay.querySelectorAll('.move-board-option[data-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await moveLinks(Array.from(selectedIds), btn.dataset.id);
      selectedIds.clear();
      close();
      renderBoard({ id: currentBoardId });
      showToast('Link spostati');
    });
  });

  // Move to new board
  document.getElementById('move-new-board').addEventListener('click', () => {
    close();
    showMoveToNewBoardModal(currentBoardId);
  });
}

function showMoveToNewBoardModal(currentBoardId) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Nuova Board</h2>
      <input class="modal-input" id="move-new-board-name" type="text" placeholder="Nome della board..." autofocus>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="modal-cancel">Annulla</button>
        <button class="btn btn-primary" id="modal-confirm">Crea e Sposta</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = document.getElementById('move-new-board-name');
  input.focus();
  const close = () => overlay.remove();

  const confirm = async () => {
    const name = input.value.trim();
    if (!name) return;
    const newBoard = await createBoard(name);
    await moveLinks(Array.from(selectedIds), newBoard.id);
    selectedIds.clear();
    close();
    renderBoard({ id: currentBoardId });
    showToast('Link spostati in "' + name + '"');
  };

  document.getElementById('modal-cancel').addEventListener('click', close);
  document.getElementById('modal-confirm').addEventListener('click', confirm);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirm();
    if (e.key === 'Escape') close();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

// === Copy Modal ===

async function showCopyModal(currentBoardId, links) {
  const boards = await getAllBoards();
  const otherBoards = boards.filter(b => b.id !== currentBoardId);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  let boardListHtml = '';
  for (const b of otherBoards) {
    boardListHtml += `<button class="move-board-option" data-id="${b.id}">${escapeHtml(b.name)} <span class="move-board-count">${b.linkCount} link</span></button>`;
  }

  overlay.innerHTML = `
    <div class="modal">
      <h2>Copia ${selectedIds.size} link in...</h2>
      <div class="move-board-list">
        ${boardListHtml}
        <button class="move-board-option move-board-new" id="copy-new-board">+ Nuova board</button>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="modal-cancel">Annulla</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  document.getElementById('modal-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Copy to existing board
  overlay.querySelectorAll('.move-board-option[data-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await copyLinks(Array.from(selectedIds), btn.dataset.id);
      selectedIds.clear();
      close();
      renderBoard({ id: currentBoardId });
      showToast('Link copiati');
    });
  });

  // Copy to new board
  document.getElementById('copy-new-board').addEventListener('click', () => {
    close();
    showCopyToNewBoardModal(currentBoardId);
  });
}

function showCopyToNewBoardModal(currentBoardId) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Nuova Board</h2>
      <input class="modal-input" id="copy-new-board-name" type="text" placeholder="Nome della board..." autofocus>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="modal-cancel">Annulla</button>
        <button class="btn btn-primary" id="modal-confirm">Crea e Copia</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = document.getElementById('copy-new-board-name');
  input.focus();
  const close = () => overlay.remove();

  const confirm = async () => {
    const name = input.value.trim();
    if (!name) return;
    const newBoard = await createBoard(name);
    await copyLinks(Array.from(selectedIds), newBoard.id);
    selectedIds.clear();
    close();
    renderBoard({ id: currentBoardId });
    showToast('Link copiati in "' + name + '"');
  };

  document.getElementById('modal-cancel').addEventListener('click', close);
  document.getElementById('modal-confirm').addEventListener('click', confirm);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirm();
    if (e.key === 'Escape') close();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

// === Delete Links Confirm ===

function showDeleteLinksConfirm(boardId) {
  const count = selectedIds.size;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Elimina Link</h2>
      <p class="confirm-text">Vuoi eliminare ${count} link${count > 1 ? '' : ''}? L'azione non è reversibile.</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="modal-cancel">Annulla</button>
        <button class="btn btn-danger" id="modal-confirm">Elimina</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  document.getElementById('modal-cancel').addEventListener('click', close);
  document.getElementById('modal-confirm').addEventListener('click', async () => {
    await deleteLinks(Array.from(selectedIds));
    selectedIds.clear();
    close();
    renderBoard({ id: boardId });
    showToast('Link eliminati');
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

// === Export via Mail ===

function exportLinksViaMail(boardName, links) {
  const subject = encodeURIComponent(boardName);
  let bodyLines = [`${boardName} — Link selezionati\n`];

  // Use current visual order (sortOrder from drag & drop), no re-sorting
  const sorted = [...links].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  let currentTag = null;
  let counter = 1;
  for (const link of sorted) {
    const tag = link.tag || '';
    if (tag !== currentTag) {
      currentTag = tag;
      if (tag) {
        bodyLines.push(`\n— ${tag} —\n`);
      } else {
        bodyLines.push(`\n— Senza sezione —\n`);
      }
    }
    bodyLines.push(`${counter}. ${link.title}`);
    bodyLines.push(`   ${link.url}\n`);
    counter++;
  }
  const bodyText = bodyLines.join('\n');

  // mailto has ~2000 char limit
  if (bodyText.length > 1800) {
    navigator.clipboard.writeText(bodyText).then(() => {
      showToast('Link copiati negli appunti — incolla nella mail');
    }).catch(() => {
      // Fallback: open mailto with truncated body
      const truncated = bodyText.substring(0, 1800) + '\n\n... (lista troncata)';
      window.location.href = 'mailto:?subject=' + subject + '&body=' + encodeURIComponent(truncated);
    });
  } else {
    window.location.href = 'mailto:?subject=' + subject + '&body=' + encodeURIComponent(bodyText);
  }
}

// === Tag Modal ===

async function showTagModal(linkId, boardId, params) {
  const link = await db.links.get(linkId);
  if (!link) return;

  // Collect existing tags from all links across all boards for reuse
  const allLinks = await db.links.toArray();
  const existingTags = [...new Set(allLinks.map(l => l.tag).filter(Boolean))].sort();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  let reusableHtml = existingTags.length > 0
    ? `<div class="tag-presets">${existingTags.map(t =>
        `<span class="tag-preset-wrap">` +
        `<button class="tag-preset ${link.tag === t ? 'tag-preset-active' : ''}" data-tag="${escapeHtml(t)}" style="background:${tagColor(t)}">${escapeHtml(t)}</button>` +
        `<button class="tag-preset-edit" data-tag="${escapeHtml(t)}" title="Rinomina tag">&#9998;</button>` +
        `<button class="tag-preset-delete" data-tag="${escapeHtml(t)}" title="Elimina tag">&times;</button>` +
        `</span>`
      ).join('')}</div>`
    : '';

  overlay.innerHTML = `
    <div class="modal">
      <h2>Sezione</h2>
      ${reusableHtml}
      <input class="modal-input" id="tag-custom-input" type="text" placeholder="Nome sezione..." value="${escapeHtml(link.tag || '')}" maxlength="30" autofocus>
      <div class="modal-actions">
        ${link.tag ? '<button class="btn btn-danger" id="tag-remove">Rimuovi</button>' : ''}
        <button class="btn btn-secondary" id="tag-cancel">Annulla</button>
        <button class="btn btn-primary" id="tag-save">Salva</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = document.getElementById('tag-custom-input');
  const close = () => overlay.remove();

  const save = async (tagValue) => {
    const tag = (tagValue || '').trim().substring(0, 30);
    await db.links.update(linkId, { tag: tag || undefined, updatedAt: Date.now() });
    await syncTagRecords();
    close();
    renderBoard(params);
  };

  // Preset buttons — tap to assign
  overlay.querySelectorAll('.tag-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      if (link.tag === btn.dataset.tag) {
        save('');
      } else {
        save(btn.dataset.tag);
      }
    });
  });

  // Delete buttons — remove tag from ALL links that use it
  overlay.querySelectorAll('.tag-preset-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tagToDelete = btn.dataset.tag;
      const count = await deleteTag(tagToDelete);
      showToast(`Tag "${tagToDelete}" eliminato da ${count} link`);
      close();
      renderBoard(params);
    });
  });

  // Edit buttons — rename tag on ALL boards
  overlay.querySelectorAll('.tag-preset-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
      showRenameTagModal(btn.dataset.tag, params);
    });
  });

  document.getElementById('tag-save').addEventListener('click', () => save(input.value));
  document.getElementById('tag-cancel').addEventListener('click', close);
  document.getElementById('tag-remove')?.addEventListener('click', () => save(''));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save(input.value);
    if (e.key === 'Escape') close();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

// === Tag Manager (da Impostazioni: rinomina ed elimina senza partire da un link) ===

async function showTagManager() {
  await syncTagRecords();
  const allLinks = await db.links.toArray();
  const existingTags = [...new Set(allLinks.map(l => l.tag).filter(Boolean))].sort();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const listHtml = existingTags.length > 0
    ? `<div class="tag-presets tag-manager-list">${existingTags.map(t =>
        `<span class="tag-preset-wrap">` +
        `<span class="tag-preset" style="background:${tagColor(t)}">${escapeHtml(t)}</span>` +
        `<button class="tag-preset-edit" data-tag="${escapeHtml(t)}" title="Rinomina tag">&#9998;</button>` +
        `<button class="tag-preset-delete" data-tag="${escapeHtml(t)}" title="Elimina tag">&times;</button>` +
        `</span>`
      ).join('')}</div>`
    : '<p class="confirm-text">Nessun tag.</p>';

  overlay.innerHTML = `
    <div class="modal">
      <h2>Tag</h2>
      ${listHtml}
      <div class="modal-actions">
        <button class="btn btn-secondary" id="tag-manager-close">Chiudi</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById('tag-manager-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelectorAll('.tag-preset-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tagToDelete = btn.dataset.tag;
      const count = await deleteTag(tagToDelete);
      showToast(`Tag "${tagToDelete}" eliminato da ${count} link`);
      close();
      showTagManager();
    });
  });

  overlay.querySelectorAll('.tag-preset-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
      showRenameTagModal(btn.dataset.tag, null, showTagManager);
    });
  });
}

// === Rename Tag Modal ===

function showRenameTagModal(oldName, params, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Rinomina tag</h2>
      <input class="modal-input" id="rename-tag-input" type="text" value="${escapeHtml(oldName)}" maxlength="30" autocomplete="off">
      <p class="confirm-text rename-tag-note" id="rename-tag-note">Il nuovo nome vale su tutte le board e il colore resta lo stesso.</p>
      <div class="modal-actions" id="rename-tag-actions">
        <button class="btn btn-secondary" id="rename-tag-cancel">Annulla</button>
        <button class="btn btn-primary" id="rename-tag-save">Salva</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = document.getElementById('rename-tag-input');
  input.focus();
  input.select();
  const close = () => overlay.remove();
  // Annullando si torna da dove si era partiti (board o gestione dei tag)
  const cancel = () => { close(); if (onDone) onDone(); };

  const apply = async (newName) => {
    const res = await renameTag(oldName, newName);
    close();
    if (res.changed) {
      showToast(res.merged ? `Tag uniti in "${res.name}"` : `Tag rinominato in "${res.name}"`);
    }
    if (onDone) onDone(); else renderBoard(params);
  };

  const save = async () => {
    const newName = input.value.trim().substring(0, 30);
    if (!newName || newName === oldName) { cancel(); return; }
    const conflict = await findTagConflict(oldName, newName);
    if (!conflict) { await apply(newName); return; }

    // Il nome esiste già: conferma prima di unire i due tag
    input.disabled = true;
    document.getElementById('rename-tag-note').textContent =
      `"${conflict}" esiste già: unisco i due tag? Tutti i link di "${oldName}" passano a "${conflict}", che tiene il suo colore.`;
    document.getElementById('rename-tag-actions').innerHTML = `
      <button class="btn btn-secondary" id="rename-tag-cancel">Annulla</button>
      <button class="btn btn-primary" id="rename-tag-merge">Unisci</button>
    `;
    document.getElementById('rename-tag-cancel').addEventListener('click', cancel);
    document.getElementById('rename-tag-merge').addEventListener('click', () => apply(conflict));
  };

  document.getElementById('rename-tag-cancel').addEventListener('click', cancel);
  document.getElementById('rename-tag-save').addEventListener('click', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') cancel();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cancel();
  });
}

// === Note Modal (Paste Article → WordPress) ===

function showNoteModal(boardId, params) {
  // Bozza già creata su WordPress: premendo di nuovo Pubblica si riusa la stessa.
  let wpDraft = null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Incolla articolo</h2>
      <input class="modal-input" id="note-title-input" type="text" placeholder="Titolo dell'articolo..." maxlength="200" autofocus style="margin-bottom:12px">
      <div class="modal-input note-textarea" id="note-content-input" contenteditable="true" data-placeholder="Incolla qui il testo dell'articolo..."></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="note-cancel">Annulla</button>
        <button class="btn btn-primary" id="note-save">Pubblica</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  document.getElementById('note-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.getElementById('note-save').addEventListener('click', async () => {
    const title = document.getElementById('note-title-input').value.trim();
    const contentEl = document.getElementById('note-content-input');
    const rawHtml = contentEl.innerHTML.trim();
    const textContent = contentEl.textContent.trim();

    if (!title) { showToast('Inserisci un titolo'); return; }
    if (!textContent) { showToast('Inserisci il testo'); return; }

    const saveBtn = document.getElementById('note-save');
    saveBtn.textContent = '...';
    saveBtn.disabled = true;

    holdAutoBackup();
    try {
      // Save placeholder link in DB FIRST (before WP call that can break IndexedDB)
      const tempUrl = 'https://humansai.it/pending-' + Date.now();
      const domain = 'humansai.it';
      const newLink = await addLink(boardId, tempUrl, title, domain);

      // Sanitize pasted HTML: keep only safe tags and links
      const sanitizeNoteHtml = (html) => {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        // Preserve <a> hrefs, strip dangerous attributes
        temp.querySelectorAll('a').forEach(a => {
          const href = a.getAttribute('href') || '';
          // Keep only http(s) links
          if (!href.match(/^https?:\/\//)) {
            a.replaceWith(a.textContent);
          } else {
            // Clean attributes, keep only href
            const text = a.innerHTML;
            a.removeAttribute('style');
            a.removeAttribute('class');
            a.removeAttribute('id');
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener');
          }
        });
        // Strip all tags except allowed ones
        const allowed = ['A', 'P', 'BR', 'STRONG', 'B', 'EM', 'I'];
        const walk = (node) => {
          const children = Array.from(node.childNodes);
          for (const child of children) {
            if (child.nodeType === 1) { // Element
              if (!allowed.includes(child.tagName)) {
                // Replace with its children (unwrap)
                while (child.firstChild) child.parentNode.insertBefore(child.firstChild, child);
                child.remove();
              } else {
                walk(child);
              }
            }
          }
        };
        walk(temp);
        return temp.innerHTML;
      };

      // Build HTML content: sanitize pasted rich text, wrap loose text in <p>
      const htmlContent = sanitizeNoteHtml(rawHtml);

      try {
        if (!wpDraft) wpDraft = await createWpDraft(title, htmlContent);
        const wpUrl = await publishWpDraft(wpDraft, title, htmlContent);
        // Update the placeholder with real WP URL
        await db.links.update(newLink.id, { url: wpUrl, domain: extractDomain(wpUrl), updatedAt: Date.now() });
      } catch (wpErr) {
        // WP failed — remove placeholder
        if (wpErr.status === 404) wpDraft = null; // bozza eliminata dal sito: se ne crea una nuova
        await db.links.delete(newLink.id).catch(() => {});
        throw wpErr;
      }

      close();
      renderBoard(params);
      showToast('Nota pubblicata e salvata');
    } catch (err) {
      saveBtn.textContent = 'Pubblica';
      saveBtn.disabled = false;
      showToast('Errore: ' + err.message);
    } finally {
      releaseAutoBackup();
    }
  });
}

// === Helpers ===

function isValidUrl(str) {
  try {
    const url = new URL(str.startsWith('http') ? str : 'https://' + str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractDomain(url) {
  try {
    return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

async function fetchLinkMeta(url) {
  const fullUrl = url.startsWith('http') ? url : 'https://' + url;
  const domain = extractDomain(fullUrl);

  // Detect URL slug: all lowercase, hyphens, no spaces → convert to readable title
  const slugToTitle = (str) => {
    if (/^[a-z0-9]+(-[a-z0-9]+){2,}$/.test(str)) {
      return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    return str;
  };

  // Extract title from URL path as last-resort fallback
  const titleFromUrl = () => {
    try {
      const path = new URL(fullUrl).pathname.replace(/\/$/, '');
      const lastSegment = path.split('/').pop() || '';
      if (lastSegment && /^[a-z0-9]+(-[a-z0-9]+){2,}$/.test(lastSegment)) {
        return slugToTitle(lastSegment);
      }
    } catch {}
    return '';
  };

  // Try Microlink API first (best for metadata extraction)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch('https://api.microlink.io/?url=' + encodeURIComponent(fullUrl), {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      let title = data.data?.title || '';
      if (title) {
        // Skip error pages
        if (/^(404|403|error|page not found)/i.test(title)) title = '';
        // Convert slug-like titles to readable text
        else title = slugToTitle(title);
        // Strip suffix like " | TechCrunch"
        if (title) title = title.replace(/\s*[\|\-–—]\s*[\w\s]{1,25}$/, '').trim();
        if (title.length > 5 && title.toLowerCase() !== domain) return { title, domain };
      }
    }
  } catch (e) {
    // Microlink failed
  }

  // Fallback: Jina Reader
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch('https://r.jina.ai/' + fullUrl, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      let title = data.data?.title || data.title || '';
      if (title) title = slugToTitle(title);
      if (title && title !== domain) return { title, domain };
    }
  } catch (e) {
    // Jina also failed
  }

  // Last resort: extract readable title from URL slug
  const urlTitle = titleFromUrl();
  if (urlTitle) return { title: urlTitle, domain };

  return { title: domain, domain };
}

function showToast(message, duration = 2000) {
  document.querySelectorAll('.toast').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}
