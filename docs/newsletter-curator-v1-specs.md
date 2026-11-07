# Newsletter Curator V1 — Specifiche per lo Sviluppo

## Panoramica

Web app (PWA) ottimizzata per iPhone, primo anello di una catena di produzione newsletter. L'app consente di raccogliere link durante la settimana, organizzarli in board tematiche, generare riassunti AI per valutare il contenuto, riordinare i link via drag & drop per definire lo storyboard della newsletter, e infine esportare i link ordinati via email.

**Catena completa (contesto):**
1. **Questa app** → raccolta link, riassunti, ordinamento, esportazione via mail
2. **Cowork** → legge la mail, compila Excel con i link
3. **Claude Code** → estrae articoli originali, genera Word in ordine logico
4. **Cowork** → legge il Word, scrive la prima bozza della newsletter

---

## Stack Tecnico

- **Frontend:** React (single-file JSX) o HTML/CSS/JS puro — decisione dello sviluppatore
- **Storage:** IndexedDB (via libreria come Dexie.js) per persistenza locale
- **AI:** API Anthropic (Claude) per generazione riassunti
- **Scraping articoli:** Fetch diretto → fallback Jina Reader (r.jina.ai) → fallback incolla manuale
- **PWA:** Service worker per offline, manifest per installazione su home screen iPhone

---

## Struttura Dati

### Board
```
{
  id: string (uuid),
  name: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Link (ArticleItem)
```
{
  id: string (uuid),
  boardId: string (ref Board),
  url: string,
  title: string (estratto dalla pagina o inserito manualmente),
  domain: string (estratto dall'URL),
  thumbnailUrl: string | null,
  sortOrder: number (per drag & drop),
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Summary (Riassunto)
```
{
  id: string (uuid),
  linkId: string (ref Link),
  boardId: string (ref Board),
  content: string (markdown),
  generatedAt: timestamp
}
```

---

## Schermate e Flusso UI

### 1. Home — Lista Board

- Lista di tutte le board, ordinate per data di creazione (più recente in alto)
- Ogni board mostra: nome, numero di link, data di creazione
- Bottone "+" prominente per creare nuova board
- Creazione board: campo nome + conferma
- Swipe per eliminare board (con conferma)
- Tap su board → entra nella board

### 2. Board — Vista Link

**Header:**
- Nome della board (editabile con tap)
- Bottone indietro verso Home

**Campo salvataggio link (sempre visibile in alto):**
- Campo di testo con placeholder "Incolla un link..."
- Bottone "Salva" (o salvataggio automatico al paste + invio)
- Quando si incolla un URL, l'app automaticamente:
  - Valida che sia un URL
  - Tenta di estrarre il titolo dalla pagina (fetch del tag `<title>`)
  - Salva il link nella board con sortOrder = ultimo + 1
  - Mostra una card con preview (titolo + dominio)

**Lista link (corpo principale):**
- Ogni link è una card con:
  - Handle di trascinamento (icona grip a sinistra)
  - Titolo dell'articolo (testo principale, cliccabile → apre l'URL)
  - Dominio di provenienza (testo secondario, es. "nytimes.com")
  - Checkbox per selezione multipla
  - Indicatore se il riassunto è già stato generato (icona/badge)
- **Drag & drop** per riordinare le card (PRIORITARIO — deve funzionare bene su touch)
  - Usare una libreria affidabile come @dnd-kit o SortableJS
  - Il riordino aggiorna il campo sortOrder di tutti i link nella board

**Barra azioni (bottom bar, appare quando c'è selezione):**
- "Seleziona tutto" / "Deseleziona tutto" (toggle)
- "Riassunto" → genera riassunto AI per i link selezionati
- "Sposta" → mostra lista board esistenti + opzione "Nuova board"
- "Elimina" → con conferma
- "Esporta Mail" → apre client mail con i link selezionati nell'ordine attuale

**Senza selezione attiva:**
- Bottone "Esporta tutti" → apre client mail con TUTTI i link nell'ordine della board
- Bottone "Riassunti" → va alla vista riassunti della board

### 3. Vista Riassunti (per board)

- Accessibile dalla board
- Lista dei riassunti generati, nell'ordine dei link nella board
- Ogni riassunto mostra:
  - Titolo dell'articolo originale
  - Contenuto del riassunto (espandibile/collassabile)
  - Link all'articolo originale
- Bottone "Esporta tutti" → apre client mail con tutti i riassunti
- Bottone "Esporta come file" → genera e scarica un file .txt o .md con tutti i riassunti

---

## Funzionalità Dettagliate

### Salvataggio Link

1. L'utente incolla un URL nel campo
2. L'app valida il formato URL
3. L'app fa un fetch della pagina per estrarre:
   - `<title>` tag → diventa il titolo del link
   - `<meta property="og:title">` come fallback
   - Dominio estratto dall'URL
4. Se il fetch fallisce (CORS, ecc.), il link viene salvato con il dominio come titolo
5. Il link appare immediatamente nella lista con il sortOrder corretto

### Generazione Riassunto (AI)

**Flusso:**
1. L'utente seleziona uno o più link e preme "Riassunto"
2. Per ogni link, l'app:
   a. Tenta di scaricare il contenuto dell'articolo (fetch → Jina Reader → fallback manuale)
   b. Se fallback manuale: mostra un modal con campo di testo "Incolla il contenuto dell'articolo"
   c. Invia il contenuto a Claude API con questo prompt:

```
Sei un assistente editoriale. Analizza questo articolo e fornisci un riassunto schematico che includa:

- **Titolo e fonte** dell'articolo
- **Tesi principale**: la tesi o il messaggio chiave in 1-2 frasi
- **Dati chiave**: numeri, statistiche, date rilevanti (elenco puntato)
- **Attori coinvolti**: persone, aziende, organizzazioni menzionate
- **Contesto**: perché questo articolo è rilevante nel panorama attuale
- **Citazioni notevoli**: massimo 2 citazioni dirette significative

Sii conciso e schematico. Il riassunto serve per decidere rapidamente se e come usare questo articolo in una newsletter su AI e tecnologia.
```

3. Il riassunto viene salvato in IndexedDB associato al link e alla board
4. L'icona/badge sul link nella board si aggiorna per indicare che il riassunto è disponibile

**Configurazione API:**
- L'utente inserisce la propria API key Anthropic nelle impostazioni dell'app (salvata in localStorage, cifrata)
- Modello: claude-sonnet-4-20250514 (buon rapporto qualità/costo per riassunti)
- Max tokens: 1000

### Fetch Contenuto Articolo (approccio a livelli)

**Livello 1 — Fetch diretto:**
```
fetch(url) → parse HTML → estrai contenuto testuale principale
```
Usare una logica di estrazione che cerchi il tag `<article>`, o il blocco di contenuto più lungo, rimuovendo nav, sidebar, footer, ads.

**Livello 2 — Jina Reader:**
```
fetch('https://r.jina.ai/' + url) → riceve testo pulito in markdown
```
Jina Reader è gratuito per volumi bassi e gestisce bene la maggior parte dei siti.

**Livello 3 — Incolla manuale:**
Modal con textarea dove l'utente incolla il testo dell'articolo copiato dal browser.

### Drag & Drop

- Deve funzionare fluidamente su touch (iPhone)
- Handle visibile a sinistra di ogni card
- Animazione fluida durante il trascinamento
- Al drop: aggiorna sortOrder di tutti i link nella board
- Libreria consigliata: SortableJS (ottimo supporto touch) o @dnd-kit

### Esportazione Mail

**Link:**
Costruire un `mailto:` link con:
- Subject: nome della board
- Body: lista dei link nell'ordine della board, uno per riga, con titolo
- Formato body:
```
[Nome Board] — Link selezionati

1. Titolo Articolo 1
   https://url1.com/article

2. Titolo Articolo 2
   https://url2.com/article

...
```

**Riassunti:**
- Subject: "[Nome Board] — Riassunti"
- Body: tutti i riassunti in sequenza, separati da righe vuote

### Esportazione File

- Genera un blob .md con tutti i riassunti
- Usa l'API `navigator.share()` se disponibile (per share sheet iOS)
- Fallback: download diretto del file

---

## Design e UX

### Principi
- **Mobile-first**: progettata per iPhone, tutto deve funzionare con il pollice
- **Velocità**: il salvataggio di un link deve richiedere 2 tap massimo (incolla + invio)
- **Chiarezza**: ogni link deve mostrare chiaramente titolo e provenienza
- **Touch-friendly**: target touch minimi 44px, drag handle generoso

### Palette colori suggerita
- Background: scuro (reduce eye strain per uso frequente)
- Cards: leggermente più chiare del background
- Accent: colore vivace per azioni principali (salva, esporta)
- Testo: alto contrasto su sfondo scuro

### Tipografia
- Font system iOS (-apple-system, SF Pro) per performance e familiarità
- Titoli articoli: 16-17px, medium weight
- Domini/metadata: 13-14px, regular, colore secondario

### Layout
- Tab bar in basso NON necessaria (navigazione lineare: Home → Board → Riassunti)
- Campo input link sempre visibile in alto nella board (sticky)
- Barra azioni contestuale in basso (appare con selezione)

---

## Impostazioni App

Accessibili da icona ingranaggio nella Home:
- **API Key Anthropic**: campo di testo per inserire/modificare la key
- **Info**: versione app, link a documentazione
- **Esporta dati**: esporta tutto il database come JSON (backup)
- **Importa dati**: importa un JSON di backup

---

## PWA Configuration

### manifest.json
```json
{
  "name": "Newsletter Curator",
  "short_name": "Curator",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#1a1a2e",
  "icons": [...]
}
```

### Service Worker
- Cache delle risorse statiche per funzionamento offline
- L'app deve funzionare offline per consultazione (ovviamente fetch articoli e AI richiedono connessione)

---

## Fuori Scope V1 (per versioni future)

- Trascrizione integrale degli articoli
- Cartelle trascrizioni con esportazione
- Sync cloud tra dispositivi
- Share sheet iOS (richiede app nativa)
- Notifiche push
- Ricerca full-text tra board
- Tag/categorie per i link
- Collaborazione multi-utente

---

## Note Implementative

1. **CORS**: il fetch diretto degli articoli avrà problemi di CORS dal browser. Soluzioni:
   - Usare Jina Reader come default (bypassa CORS)
   - Oppure un piccolo proxy CORS (es. cors-anywhere self-hosted, o un worker Cloudflare gratuito)
   - Per V1 potrebbe bastare Jina Reader + fallback manuale

2. **IndexedDB**: usare Dexie.js per semplificare le operazioni DB. Supporta bene il versioning dello schema.

3. **Performance drag & drop su iOS**: SortableJS è testato e affidabile su Safari mobile. Evitare soluzioni che dipendono da eventi mouse.

4. **mailto: limiti**: il body del mailto ha un limite pratico di circa 2000 caratteri nell'URL. Per board con molti link, potrebbe essere necessario usare `navigator.clipboard.writeText()` come alternativa e avvisare l'utente di incollare manualmente.

5. **API Key sicurezza**: essendo un'app locale, la key è salvata nel browser dell'utente. Non è mai inviata a server terzi. Le chiamate API vanno dirette ad api.anthropic.com.
