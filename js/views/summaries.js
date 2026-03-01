// Summaries View — List all summaries for a board

async function renderSummaries(params) {
  const boardId = params.id;
  const board = await getBoard(boardId);

  if (!board) {
    Router.navigate('#/');
    return;
  }

  const links = await getBoardLinks(boardId);
  const summaries = await getBoardSummaries(boardId);
  const summaryByLinkId = {};
  summaries.forEach(s => { summaryByLinkId[s.linkId] = s; });

  const app = document.getElementById('app');

  let html = `
    <div class="view-enter">
      <div class="board-header">
        <button class="btn-back" id="btn-back" title="Indietro">&#8592;</button>
        <span class="board-title-input" style="pointer-events:none; font-size:22px; font-weight:700;">Riassunti</span>
      </div>
      <div class="summaries-board-name">${escapeHtml(board.name)}</div>
  `;

  const linksWithSummary = links.filter(l => summaryByLinkId[l.id]);

  if (linksWithSummary.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-state-icon">&#128196;</div>
        <div class="empty-state-text">Nessun riassunto generato.<br>Apri un articolo e premi "Genera Riassunto".</div>
      </div>
    `;
  } else {
    html += '<div class="summaries-list">';
    for (const link of linksWithSummary) {
      const summary = summaryByLinkId[link.id];
      html += `
        <div class="summary-card" data-link-id="${link.id}">
          <div class="summary-card-header" data-toggle="${link.id}">
            <div class="summary-card-title">${escapeHtml(link.title)}</div>
            <div class="summary-card-domain">${escapeHtml(link.domain)}</div>
            <span class="summary-card-chevron" id="chevron-${link.id}">&#9660;</span>
          </div>
          <div class="summary-card-body" id="summary-body-${link.id}" style="display:none">
            <div class="summary-card-content">${formatSummaryContent(summary.content)}</div>
            <a href="${escapeHtml(link.url)}" target="_blank" class="summary-card-link">Apri articolo originale &#8599;</a>
          </div>
        </div>
      `;
    }
    html += '</div>';

    html += `
      <div class="board-bottom-buttons">
        <button class="btn btn-primary" id="btn-export-summaries-mail">Esporta Mail</button>
        <button class="btn btn-secondary" id="btn-export-summaries-md">Esporta .md</button>
      </div>
    `;
  }

  html += '</div>';
  app.innerHTML = html;

  // Back
  document.getElementById('btn-back').addEventListener('click', () => {
    Router.navigate('#/board/' + boardId);
  });

  // Toggle expand/collapse
  document.querySelectorAll('[data-toggle]').forEach(header => {
    header.addEventListener('click', () => {
      const id = header.dataset.toggle;
      const body = document.getElementById('summary-body-' + id);
      const chevron = document.getElementById('chevron-' + id);
      if (body.style.display === 'none') {
        body.style.display = 'block';
        chevron.innerHTML = '&#9650;';
      } else {
        body.style.display = 'none';
        chevron.innerHTML = '&#9660;';
      }
    });
  });

  // Export summaries via mail
  document.getElementById('btn-export-summaries-mail')?.addEventListener('click', () => {
    const subject = encodeURIComponent(board.name + ' — Riassunti');
    let bodyLines = [`${board.name} — Riassunti\n`];
    for (const link of linksWithSummary) {
      const summary = summaryByLinkId[link.id];
      bodyLines.push(`---\n${link.title}\n${link.url}\n`);
      bodyLines.push(summary.content + '\n');
    }
    const bodyText = bodyLines.join('\n');

    // Try mailto first (works up to ~8000 chars on most clients)
    if (bodyText.length <= 7500) {
      window.location.href = 'mailto:?subject=' + subject + '&body=' + encodeURIComponent(bodyText);
    } else {
      // Too long for mailto — try clipboard, then fallback to truncated mailto
      const tryClipboard = navigator.clipboard?.writeText(bodyText);
      if (tryClipboard) {
        tryClipboard.then(() => {
          showToast('Riassunti copiati — incolla nella mail');
        }).catch(() => {
          // Clipboard failed (HTTP), use truncated mailto
          const truncated = bodyText.substring(0, 7000) + '\n\n... (testo troncato, troppo lungo per mail)';
          window.location.href = 'mailto:?subject=' + subject + '&body=' + encodeURIComponent(truncated);
        });
      } else {
        const truncated = bodyText.substring(0, 7000) + '\n\n... (testo troncato)';
        window.location.href = 'mailto:?subject=' + subject + '&body=' + encodeURIComponent(truncated);
      }
    }
  });

  // Export as .md file
  document.getElementById('btn-export-summaries-md')?.addEventListener('click', () => {
    let md = `# ${board.name} — Riassunti\n\n`;
    for (const link of linksWithSummary) {
      const summary = summaryByLinkId[link.id];
      md += `---\n\n## ${link.title}\n${link.url}\n\n${summary.content}\n\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown' });

    // Try share API first (iOS)
    if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'riassunti.md')] })) {
      navigator.share({
        files: [new File([blob], `${board.name}-riassunti.md`, { type: 'text/markdown' })],
        title: board.name + ' — Riassunti'
      }).catch(() => downloadBlob(blob, `${board.name}-riassunti.md`));
    } else {
      downloadBlob(blob, `${board.name}-riassunti.md`);
    }
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast('File scaricato');
}
