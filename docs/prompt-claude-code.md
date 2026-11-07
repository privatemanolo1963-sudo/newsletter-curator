# Prompt per Claude Code — Newsletter Curator V1

Leggi il file `newsletter-curator-v1-specs.md` che trovi nella stessa cartella di questo prompt. Contiene le specifiche complete dell'app che devi costruire.

## Cosa devi fare

Costruisci una web app (PWA) chiamata "Newsletter Curator" — un'app mobile-first per iPhone che consente di raccogliere link durante la settimana, organizzarli in board, generare riassunti AI, riordinarli via drag & drop, e esportarli via email.

## Come procedere

Lavora in fasi sequenziali. Dopo ogni fase, fermati e mostrami il risultato prima di procedere.

### Fase 1 — Fondamenta
- Setup progetto (HTML/CSS/JS o React, a tua scelta — l'importante è che sia un singolo deploy statico)
- PWA manifest + service worker base
- Storage locale con IndexedDB (usa Dexie.js)
- Navigazione: Home (lista board) ↔ Board (lista link)
- CRUD board: crea, rinomina, elimina

### Fase 2 — Salvataggio Link
- Campo input sticky in alto nella board per incollare URL
- Al salvataggio: fetch del titolo dalla pagina (usa `https://r.jina.ai/` per evitare problemi CORS)
- Card per ogni link con titolo + dominio
- Tap sul titolo apre l'URL in un nuovo tab

### Fase 3 — Drag & Drop
- Riordino link via drag & drop touch-friendly (usa SortableJS)
- Handle di trascinamento visibile a sinistra di ogni card
- L'ordine viene persistito in IndexedDB (campo sortOrder)
- Deve funzionare fluidamente su Safari mobile iPhone

### Fase 4 — Selezione e Azioni
- Checkbox su ogni card per selezione multipla
- Bottone "Seleziona tutto" / "Deseleziona tutto"
- Azioni sui selezionati:
  - Sposta in altra board (esistente o nuova)
  - Elimina (con conferma)
  - Esporta via mail (mailto: con link ordinati nel body)
- Bottone "Esporta tutti" sempre visibile

### Fase 5 — Riassunti AI
- Pagina impostazioni con campo per API key Anthropic (salvata cifrata in localStorage)
- Per ogni link selezionato: bottone "Genera riassunto"
- Fetch contenuto articolo: Jina Reader (`https://r.jina.ai/URL`) → fallback campo incolla manuale
- Chiamata a Claude API (claude-sonnet-4-20250514) con il prompt di riassunto presente nelle specs
- Salvataggio riassunto in IndexedDB
- Badge sul link che indica "riassunto disponibile"
- Vista "Riassunti" accessibile dalla board: lista riassunti nell'ordine dei link
- Esportazione riassunti: mailto + download file .md

### Fase 6 — Polish
- Design dark theme, mobile-first, target touch 44px
- Animazioni fluide (transizioni tra viste, feedback drag)
- Gestione errori (rete assente, API key mancante, fetch fallito)
- Backup/restore dati (export/import JSON dalle impostazioni)

## Vincoli tecnici importanti

1. **CORS**: non fare fetch diretto degli articoli dal browser — usa sempre Jina Reader (`https://r.jina.ai/` + URL) come layer di estrazione. È gratuito e risolve i problemi CORS.

2. **Drag & drop su iOS**: Safari mobile ha comportamenti particolari con il touch. SortableJS li gestisce bene. Testa che il drag funzioni senza interferire con lo scroll.

3. **mailto: limiti**: il body di un mailto: ha un limite pratico (~2000 caratteri). Se la lista link è lunga, copia negli appunti e avvisa l'utente di incollare manualmente nella mail.

4. **API Anthropic**: le chiamate vanno fatte direttamente dal browser ad `https://api.anthropic.com/v1/messages`. Header necessari: `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`. NOTA: questo funziona solo se Anthropic permette CORS dal browser — se non funziona, implementa un piccolo proxy tramite Cloudflare Worker.

5. **Single deploy**: tutto deve essere deployabile come sito statico (es. su Netlify, Vercel, o anche aperto come file locale). Nessun backend proprio.

## Design reference

- Dark theme (background #1a1a2e o simile)
- Font di sistema iOS (-apple-system, SF Pro)
- Card con bordi arrotondati, leggero rilievo
- Accent color vivace per le azioni principali
- Barra azioni contestuale che appare dal basso quando ci sono link selezionati
- Campo input link sempre visibile in alto, con aspetto invitante
