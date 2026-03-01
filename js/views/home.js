// Home View — Board List

async function renderHome() {
  const app = document.getElementById('app');
  const boards = await getAllBoards();

  let html = `
    <div class="view-enter">
      <div class="header">
        <h1>Curator</h1>
        <div class="header-actions">
          <button class="btn-icon" id="btn-settings" title="Impostazioni">&#9881;</button>
        </div>
      </div>
  `;

  if (boards.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-state-icon">&#128218;</div>
        <div class="empty-state-text">Nessuna board ancora.<br>Crea la prima per iniziare a raccogliere link.</div>
      </div>
    `;
  } else {
    html += '<div class="board-list">';
    for (const board of boards) {
      const date = new Date(board.createdAt).toLocaleDateString('it-IT', {
        day: 'numeric', month: 'short'
      });
      const linkWord = board.linkCount === 1 ? 'link' : 'link';
      html += `
        <div class="board-card" data-id="${board.id}">
          <div class="board-card-info">
            <div class="board-card-name">${escapeHtml(board.name)}</div>
            <div class="board-card-meta">${board.linkCount} ${linkWord} &middot; ${date}</div>
          </div>
          <div class="board-card-actions">
            <button class="board-card-delete" data-delete="${board.id}" title="Elimina">&#128465;</button>
          </div>
        </div>
      `;
    }
    html += '</div>';
  }

  html += '</div>';
  html += `<button class="fab" id="btn-new-board" title="Nuova board">+</button>`;

  app.innerHTML = html;

  // Event: tap on board card → navigate to board
  document.querySelectorAll('.board-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't navigate if delete button was clicked
      if (e.target.closest('.board-card-delete')) return;
      Router.navigate('#/board/' + card.dataset.id);
    });
  });

  // Event: delete board
  document.querySelectorAll('.board-card-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showDeleteBoardConfirm(btn.dataset.delete);
    });
  });

  // Event: new board
  document.getElementById('btn-new-board').addEventListener('click', showNewBoardModal);

  // Event: settings
  document.getElementById('btn-settings').addEventListener('click', () => {
    Router.navigate('#/settings');
  });
}

function showNewBoardModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Nuova Board</h2>
      <input class="modal-input" id="new-board-name" type="text" placeholder="Nome della board..." autofocus>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="modal-cancel">Annulla</button>
        <button class="btn btn-primary" id="modal-confirm">Crea</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = document.getElementById('new-board-name');
  input.focus();

  const close = () => overlay.remove();
  const confirm = async () => {
    const name = input.value.trim();
    if (!name) return;
    await createBoard(name);
    close();
    renderHome();
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

function showDeleteBoardConfirm(boardId) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Elimina Board</h2>
      <p class="confirm-text">Vuoi eliminare questa board e tutti i suoi link? L'azione non è reversibile.</p>
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
    await deleteBoard(boardId);
    close();
    renderHome();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

// Utility
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
