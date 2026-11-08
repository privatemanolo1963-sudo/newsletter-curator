# Newsletter Curator (PWA)

**Progetto:** app web (PWA) mobile-first per iPhone, primo anello della catena di produzione della newsletter [humans/AI].
**Scopo:** raccogliere link durante la settimana, organizzarli in board, dividerli in sezioni con i tag, riordinarli con il drag & drop, salvare come note gli articoli incollati (pubblicati su humansai.it) ed esportare la lista via email per avviare il lavoro sulla newsletter.

---

## Stack tecnico

- **Frontend:** HTML/CSS/JS puro (nessun framework)
- **Storage:** IndexedDB tramite Dexie.js
- **Titoli dei link:** Microlink (`api.microlink.io`), in subordine Jina Reader (`r.jina.ai`), in ultima istanza il titolo ricavato dallo slug dell'URL
- **WordPress (humansai.it):** API REST con Application Password, usata per pubblicare le note e per il backup automatico
- **Drag & drop:** SortableJS (ottimizzato per il touch su iOS)
- **PWA:** service worker e manifest per l'installazione sulla schermata Home dell'iPhone
- **Server di sviluppo:** `python serve.py` (porta 8080)

---

## Struttura file

```
newsletter-curator/
  index.html          Entry point, carica tutti i moduli
  manifest.json       Configurazione PWA
  sw.js               Service worker (cache offline)
  serve.py            Server di sviluppo locale
  css/
    style.css         Stili (tema scuro, mobile-first)
  js/
    app.js            Inizializzazione, rotte, avvio del backup automatico
    db.js             Schema IndexedDB (Dexie): boards, links, summaries, tags
    tags.js           Tag: colori fissi, ordine delle sezioni, rinomina ed eliminazione
    router.js         Router SPA basato sull'hash
    backup.js         Backup automatico su WordPress (vedi sezione dedicata)
    views/
      home.js         Lista delle board
      board.js        Vista board: link, drag & drop, selezione, tag, pannello Sezioni,
                      rinomina tag, gestione tag, note, mail
      article.js      Dettaglio link (titolo modificabile, apertura dell'originale)
                      e funzioni WordPress: credenziali, pubblicazione note
      settings.js     Impostazioni: credenziali WordPress, backup, ripristino, versioni,
                      pulsante Gestisci tag
      summaries.js    Residuo della funzione riassunti AI, rimossa: non è caricato
                      da index.html né dal service worker
  icons/
    icon-192.svg      Icona PWA
  docs/
    newsletter-curator-v1-specs.md  Specifiche funzionali e UX originali
    specifiche-sezioni-colori-tag_2026-11-07.md  Pannello Sezioni, colori fissi, rinomina tag
    specifiche-pubblicazione-note_2026-11-08.md  Pubblicazione delle note: bozza, controllo sul sito
    prompt-claude-code.md           Prompt a fasi usato per costruire l'app
    versioni-precedenti/            Copie di backup del CLAUDE.md
```

---

## Come lanciare in locale

```bash
cd newsletter-curator
python serve.py
# Apri http://localhost:8080
```

---

## Funzioni attuali

- **Home:** elenco delle board, dalla più recente; creazione ed eliminazione (il nome si cambia dentro la board).
- **Board, intestazione:** titolo modificabile e tre pulsanti.
  - **Note:** incolla un articolo (titolo e testo, con `contenteditable` per conservare i link),
    lo pubblica come post su humansai.it e aggiunge alla board un link che punta al post
    (vedi la sezione "Pubblicazione delle note").
  - **Tag:** riordina la board per sezioni e apre il pannello **Sezioni** (una riga per tag
    con il numero dei link). Le righe si trascinano e la board si riordina mentre si sposta;
    si chiude con la X. I link senza tag stanno sempre in fondo.
  - **Mail:** esporta tutti i link nell'ordine visibile, raggruppati per tag.
- **Board, inserimento:** si incolla un URL, l'app recupera il titolo e mette il link in testa.
- **Ordine delle sezioni:** ogni board ricorda il suo (campo `tagOrder`). Un tag nuovo entra in
  fondo, prima dei link senza tag. Dentro ogni sezione i link restano nel loro ordine, quindi un
  link nuovo finisce in testa alla sua sezione. Copiando o spostando link in un'altra board,
  l'ordine delle loro sezioni passa alla board di destinazione.
- **Link:** drag & drop (anche di più link selezionati insieme); tocco sul tag per assegnarlo,
  scegliendo tra i tag già usati in tutte le board o scrivendone uno nuovo (massimo 30 caratteri);
  tocco sul titolo per aprire il dettaglio.
- **Finestra dei tag:** la matita rinomina un tag su tutte le board (il colore resta); se il nome
  esiste già, dopo conferma i due tag si uniscono e resta il colore del tag esistente.
  La crocetta elimina il tag da tutti i link.
- **Gestisci tag (Impostazioni):** apre la stessa finestra con tutti i tag di tutte le board,
  con matita e crocetta, senza partire da un articolo. Serve per fare pulizia nell'elenco.
- **Colori dei tag:** 8 colori ben distinti, assegnati all'indice libero più basso; dal nono tag
  vivo in poi si usano sfumature. Ogni tag tiene il suo colore in tutte le board. Un tag
  eliminato, o non più assegnato a nessun link, libera il suo colore.
- **Action bar** (compare con la selezione): Tutti/Deseleziona, Sposta, Copia, Elimina.
  Sposta e Copia permettono anche di creare una board nuova.
- **Mail di esportazione:** oggetto = nome della board; nel testo, per ogni sezione una riga
  `— nome tag —` (oppure `— Senza sezione —`), poi i link numerati con titolo e URL.

---

## Struttura dati (IndexedDB)

- **Board**: id, name, tagOrder (ordine delle sezioni, facoltativo), createdAt, updatedAt
- **Link**: id, boardId, url, title, domain, tag (facoltativo), thumbnailUrl, sortOrder, createdAt, updatedAt
- **Tag** (schema versione 2): name (chiave), colorIndex, createdAt. Si allinea ai link con
  `syncTagRecords()` all'avvio, dopo ogni modifica ai tag e dopo un ripristino.
- **Summary**: id, linkId, boardId, content, generatedAt. Tabella rimasta dalla funzione riassunti:
  l'interfaccia non la usa più, ma resta nello schema ed è compresa nel backup.

---

## Catena di produzione newsletter

Questa app è il primo passo: Matteo raccoglie e ordina i link su iPhone, poi li esporta
con una mail (oggetto = nome della board) che si manda da solo. Da lì il lavoro sulla
newsletter prosegue con Claude in linguaggio naturale, senza un formato vincolato della mail.

---

## Specifiche di design

Le specifiche originali sono nella cartella `docs/` di questo repository:
- `newsletter-curator-v1-specs.md`: specifiche funzionali e UX della prima versione
- `prompt-claude-code.md`: prompt a fasi usato per costruire l'app

L'app si è evoluta dopo quelle specifiche: fanno fede il codice e questo file.
Le specifiche di nuove funzioni vanno in `docs/` come file nuovi, senza sovrascrivere quelli esistenti.

Questo CLAUDE.md è il file unico di riferimento del progetto. Prima di ogni modifica
strutturale salvarne una copia in `docs/versioni-precedenti/`.

---

## Vincoli tecnici

1. **CORS:** mai fetch diretto dal browser verso i siti degli articoli. I titoli si recuperano con Microlink e, se non basta, con Jina Reader (`https://r.jina.ai/` + URL).
2. **Drag & drop iOS:** SortableJS gestisce le peculiarità di Safari mobile. Non interferire con lo scroll.
3. **Limiti di mailto:** testo massimo di circa 2000 caratteri. Oltre i 1800 caratteri la lista viene copiata negli appunti e l'utente viene avvisato.
4. **Deploy statico:** tutto deve funzionare come sito statico (nessun backend).
5. **Cache busting:** i file JS/CSS hanno il parametro `?v=N` nell'import. Incrementarlo a ogni modifica.
6. **A capo dei file:** nel repository i file hanno gli a capo in formato LF. Mantenerli così, per evitare commit in cui ogni riga risulta modificata.

---

## Deploy

- **GitHub Pages:** il repo è su GitHub, il deploy è automatico con `git push origin main`
- **Dopo OGNI modifica:** fare subito `git commit` e `git push`: è l'unico modo per portare le correzioni sull'iPhone
- **Service worker:** aumentare SEMPRE `CACHE_NAME` in `sw.js` a ogni push, altrimenti Chrome su iPhone serve i file vecchi
- **Cache busting:** incrementare `?v=N` in `index.html` per i file modificati
- **L'utente usa Chrome su iPhone:** MAI suggerire di cancellare cache o dati del browser (rischio di perdita dei dati)

---

## Regole operative

1. **Versioning:** NON sovrascrivere mai file esistenti quando si fanno modifiche strutturali. Creare prima una copia di backup.
2. **Git:** il progetto ha un repo git. Fare commit e push dopo ogni modifica significativa.
3. **Test su iPhone:** l'app gira su Chrome per iPhone. Verificare che drag & drop e touch funzionino.
4. **Action bar:** contiene solo Tutti/Deseleziona, Sposta, Copia, Elimina. NIENTE pulsante Mail (Mail è solo nell'intestazione).
5. **Nota (Incolla articolo):** usa `contenteditable` (non textarea) per conservare i link copiati dagli articoli web.

---

## Pubblicazione delle note (novembre 2026)

Introdotta dopo errori ricorrenti sulle note lunghe, con post doppi su humansai.it: WordPress
pubblicava, ma la conferma non arrivava all'iPhone. Dettagli in
`docs/specifiche-pubblicazione-note_2026-11-08.md`.

**File:** `js/views/article.js` (`createWpDraft`, `publishWpDraft`, `confirmWpPublished`) e
`showNoteModal` in `js/views/board.js`.

- La nota entra su WordPress come bozza, poi diventa pubblica. L'id della bozza resta nella
  finestra, quindi premendo di nuovo Pubblica si lavora sempre sullo stesso post.
- Se la connessione cade o il server dà errore durante la pubblicazione, l'app controlla lo stato
  del post per circa 35 secondi. Se è pubblicato, la nota è riuscita e il link giusto va in board.
- I rifiuti espliciti di WordPress (errori 4xx) vengono mostrati subito.
- Durante la pubblicazione il backup automatico aspetta (`holdAutoBackup`, `releaseAutoBackup`
  in `js/backup.js`).

---

## Backup automatico su WordPress (agosto 2026)

Introdotto dopo la perdita di tutte le board: lo storage di Chrome su iPhone è stato
ripulito durante le vacanze e l'unico backup esistente era quello manuale dell'1 aprile.

**File:** `js/backup.js`

- **Quando parte:** all'avvio dell'app (dopo 3 secondi, con rotazione dello storico) e
  circa 10 secondi dopo ogni modifica ai dati. Le modifiche sono intercettate con gli hook
  di Dexie su `boards`, `links`, `summaries`, `tags`, quindi non serve chiamare nulla dalle viste.
  Un backup in sospeso viene forzato quando la pagina passa in background (`visibilitychange`,
  `pagehide`), perché iOS può chiudere l'app senza preavviso. Mentre una nota è in pubblicazione
  il backup aspetta e riparte subito dopo.
- **Dove:** post privato WordPress con slug `curator-backup-data`, più 5 slot di storico
  `curator-backup-hist-1..5` a rotazione. Lo storico viene aggiornato solo all'avvio e solo
  se i dati sono davvero cambiati.
- **Formato:** il payload è JSON codificato in base64 con prefisso `CURATORB64:`, per non
  farlo rovinare dai filtri di WordPress (`wpautop`, entità HTML, tag nei titoli).
  I backup vecchi in JSON in chiaro restano leggibili: `decodePayload()` gestisce entrambi.
- **Protezione anti disastro:** il backup viene sospeso se su WordPress esistono board e
  (a) l'app è vuota, oppure (b) questa installazione non ha mai completato un backup
  (storage ripulito, telefono nuovo). In quel caso decide l'utente: Ripristina, oppure
  "Backup adesso" con conferma esplicita, che comunque salva prima la versione online
  nello storico. NON rimuovere questo controllo.
- **Stato:** salvato in `localStorage` sotto `curator_backup_state`. Mostrato in Impostazioni
  e come banner in Home se il backup è bloccato, fallito, mai eseguito o più vecchio di 3 giorni.
- **Tag nel backup:** la tabella `tags` entra in export, import e confronto dei dati. Un backup
  senza tabella `tags` resta ripristinabile: i colori vengono ricostruiti dai link.

**Test:** nella sessione che ha introdotto il backup è stata usata una suite Playwright con
un finto WordPress (28 verifiche) su backup automatico, rotazione, protezione anti disastro
dopo la pulizia dello storage, backup forzato, compatibilità con i backup vecchi e
funzionamento senza credenziali. Per sezioni, colori e rinomina (7 novembre 2026) una suite
analoga (37 verifiche, iPhone simulato, compresa la gestione dei tag da Impostazioni) ha coperto anche l'aggiornamento dalla versione
precedente, il backup dei tag e il ripristino di un backup vecchio. Le suite non sono salvate
in questo repository.
