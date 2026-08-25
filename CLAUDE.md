# Newsletter Curator — PWA

**Progetto:** app web (PWA) mobile-first per iPhone, primo anello della catena di produzione della newsletter [humans/AI].
**Scopo:** raccogliere link durante la settimana, organizzarli in board tematiche, generare riassunti AI, riordinarli via drag & drop, ed esportarli via email a Cowork.

---

## Stack tecnico

- **Frontend:** HTML/CSS/JS puro (no framework)
- **Storage:** IndexedDB via Dexie.js
- **AI:** API Anthropic (Claude) per riassunti articoli
- **Scraping articoli:** Jina Reader (`r.jina.ai`) come proxy CORS
- **Drag & drop:** SortableJS (ottimizzato per touch iOS)
- **PWA:** Service worker + manifest per installazione su home screen iPhone
- **Server dev:** `python serve.py` (porta 8080)

---

## Struttura file

```
newsletter-curator/
  index.html          — Entry point, carica tutti i moduli
  manifest.json       — Configurazione PWA
  sw.js               — Service worker (cache offline)
  serve.py            — Server di sviluppo locale
  css/
    style.css         — Stili (dark theme, mobile-first)
  js/
    app.js            — Inizializzazione app e router
    db.js             — Schema IndexedDB (Dexie): Board, Link, Summary
    router.js         — Router SPA hash-based
    views/
      home.js         — Lista board
      board.js        — Vista board con link, drag & drop, selezione
      article.js      — Dettaglio articolo
      settings.js     — Impostazioni (API key, backup/restore)
      summaries.js    — Vista riassunti per board
  icons/
    icon-192.png      — Icona PWA 192x192
    icon-512.png      — Icona PWA 512x512
```

---

## Come lanciare in locale

```bash
cd newsletter-curator
python serve.py
# Apri http://localhost:8080
```

---

## Struttura dati (IndexedDB)

- **Board**: id, name, createdAt, updatedAt
- **Link (ArticleItem)**: id, boardId, url, title, domain, thumbnailUrl, sortOrder, createdAt, updatedAt
- **Summary**: id, linkId, boardId, content (markdown), generatedAt

---

## Catena di produzione newsletter

Questa app e' il primo passo:

1. **Newsletter Curator** (questa app) — Matteo raccoglie e ordina i link su iPhone
2. **Esportazione via mail** — L'app genera una mail con subject "CC" contenente i link ordinati
3. **Cowork** (cartella `../NEWSLETTER/`) — Legge la mail, genera template, produce storyboard e bozza
4. **Claude Code** — Scraping articoli con Playwright

---

## Specifiche di design

Le specifiche complete V1 sono nella cartella `../app curation/`:
- `newsletter-curator-v1-specs.md` — Specifiche funzionali e UX
- `prompt-claude-code.md` — Prompt originale usato per costruire l'app

---

## Vincoli tecnici

1. **CORS**: usare sempre Jina Reader (`https://r.jina.ai/` + URL) per fetch articoli. Mai fetch diretto dal browser.
2. **Drag & drop iOS**: SortableJS gestisce le peculiarita' di Safari mobile. Non interferire con lo scroll.
3. **mailto: limiti**: body max ~2000 caratteri. Per liste lunghe, copiare negli appunti + avviso utente.
4. **API Anthropic**: chiamate dirette dal browser a `api.anthropic.com`. Header: `x-api-key`, `anthropic-version: 2023-06-01`.
5. **Deploy statico**: tutto deve funzionare come sito statico (no backend).
6. **Cache busting**: i file JS/CSS hanno parametro `?v=N` nell'import. Incrementare ad ogni modifica.

---

## Deploy

- **GitHub Pages**: il repo è su GitHub, il deploy è automatico via `git push origin main`
- **Dopo OGNI modifica**: fare subito `git commit` + `git push` — è l'unico modo per portare le fix sull'iPhone
- **Service worker**: bumpare SEMPRE `CACHE_NAME` in `sw.js` ad ogni push, altrimenti Chrome iPhone serve file vecchi
- **Cache busting**: incrementare `?v=N` in `index.html` per i file modificati
- **L'utente usa Chrome su iPhone** — MAI suggerire di cancellare cache/dati del browser (rischio perdita dati)

---

## Regole operative

1. **Versioning**: NON sovrascrivere mai file esistenti quando si fanno modifiche strutturali. Creare una copia di backup.
2. **Git**: il progetto ha un repo git. Fare commit + push dopo ogni modifica significativa.
3. **Test su iPhone**: l'app gira su Chrome iPhone. Verificare che drag & drop e touch funzionino.
4. **Action bar**: contiene solo Tutti/Deseleziona, Sposta, Copia, Elimina. NO bottone Mail (Mail è solo nell'header).
5. **Nota (Incolla articolo)**: usa `contenteditable` (non textarea) per preservare i link copiati da articoli web.

---

## Backup automatico su WordPress (agosto 2026)

Introdotto dopo la perdita di tutte le board: lo storage di Chrome su iPhone e' stato
ripulito durante le vacanze e l'unico backup esistente era quello manuale dell'1 aprile.

**File:** `js/backup.js`

- **Quando parte:** all'avvio dell'app (dopo 3 secondi, con rotazione dello storico) e
  circa 10 secondi dopo ogni modifica ai dati. Le modifiche sono intercettate con gli hook
  di Dexie su `boards`, `links`, `summaries`, quindi non serve chiamare nulla dalle viste.
  Un backup in sospeso viene forzato quando la pagina passa in background (`visibilitychange`,
  `pagehide`), perche' iOS puo' chiudere l'app senza preavviso.
- **Dove:** post privato WordPress con slug `curator-backup-data`, piu' 5 slot di storico
  `curator-backup-hist-1..5` a rotazione. Lo storico viene aggiornato solo all'avvio e solo
  se i dati sono davvero cambiati.
- **Formato:** il payload e' JSON codificato in base64 con prefisso `CURATORB64:`, per non
  farlo rovinare dai filtri di WordPress (`wpautop`, entita' HTML, tag nei titoli).
  I backup vecchi in JSON in chiaro restano leggibili: `decodePayload()` gestisce entrambi.
- **Protezione anti disastro:** il backup viene sospeso se su WordPress esistono board e
  (a) l'app e' vuota, oppure (b) questa installazione non ha mai completato un backup
  (storage ripulito, telefono nuovo). In quel caso decide l'utente: Ripristina, oppure
  "Backup adesso" con conferma esplicita, che comunque salva prima la versione online
  nello storico. NON rimuovere questo controllo.
- **Stato:** salvato in `localStorage` sotto `curator_backup_state`. Mostrato in Impostazioni
  e come banner in Home se il backup e' bloccato, fallito, mai eseguito o piu' vecchio di 3 giorni.

**Test:** suite Playwright con finto WordPress (28 verifiche) che copre backup automatico,
rotazione, protezione anti disastro dopo pulizia dello storage, backup forzato, compatibilita'
con i backup vecchi e funzionamento senza credenziali.
