# App Curation — Specifiche di Design

**Progetto:** documentazione di design e specifiche funzionali per la PWA **Newsletter Curator**.
**Questa cartella** contiene i documenti di progettazione. Il codice dell'app si trova in `../newsletter-curator/`.

---

## File presenti

| File | Descrizione |
|------|-------------|
| `newsletter-curator-v1-specs.md` | Specifiche complete V1: panoramica, stack tecnico, struttura dati, schermate, UX, funzionalita' dettagliate, design, configurazione PWA, limiti noti |
| `prompt-claude-code.md` | Prompt originale a fasi usato per far costruire l'app a Claude Code |

---

## Relazione con le altre cartelle

Questa cartella e' il **brief di progetto**. L'app costruita a partire da queste specifiche e' in:

- **`../newsletter-curator/`** — Codice sorgente della PWA (HTML/CSS/JS, IndexedDB, SortableJS, service worker)

L'app fa parte della catena di produzione della newsletter [humans/AI]:

- **`../NEWSLETTER/`** — File di lavoro della newsletter (template, bozze, workflow, database link)

---

## Quando usare questa cartella

- Per **consultare le specifiche originali** dell'app (funzionalita', UX, struttura dati)
- Per **pianificare nuove feature** (V2, V3...) — aggiungere nuovi file di specs qui
- Per **verificare cosa era previsto vs cosa e' stato implementato**

Per **modificare il codice** dell'app, lavorare nella cartella `../newsletter-curator/`.

---

## Regole operative

1. **Versioning**: NON sovrascrivere mai file esistenti. Creare nuove versioni (es. `newsletter-curator-v2-specs.md`).
2. Questa cartella e' di sola documentazione: nessun codice eseguibile.
