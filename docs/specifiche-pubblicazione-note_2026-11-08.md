# Pubblicazione delle note su humansai.it

Data: 8 novembre 2026

## Il problema osservato

Pubblicando una nota dall'iPhone, soprattutto se lunga, l'app dava spesso errore dopo circa un minuto. Riprovando la nota di solito passava; a volte non passava affatto.

La mattina dell'8 novembre su humansai.it sono risultati due post identici, "The Information – Can Cheaper AI Outrun the Data Center Backlash?": id 905 delle 08.33.46 e id 907 delle 08.35.26, ora italiana. Il primo era stato quindi salvato e pubblicato da WordPress anche se l'app aveva segnalato l'errore.

## La causa

Che cosa è accertato:

- WordPress aveva pubblicato il post, ma l'app non ha ricevuto la conferma e ha considerato fallita l'operazione.
- La scritta di errore non è nel codice dell'app, che mostra il messaggio ricevuto dal browser. Matteo ricorda "failed upload"; su iPhone il messaggio tipico di una connessione caduta è "Load failed".

Che cosa resta da verificare:

- Perché WordPress impieghi tanto a rispondere, in particolare con le note lunghe. Serve un controllo dei plugin attivi su humansai.it.
- Quanto incidessero il backup automatico, che partiva 10 secondi dopo verso lo stesso sito, e il passaggio a un'altra app durante l'attesa.
- I casi in cui la nota non passa nemmeno riprovando.

## Come funziona la pubblicazione

File: `js/views/article.js`, `js/views/board.js`, `js/backup.js`.

1. Premendo Pubblica, l'app aggiunge alla board un link provvisorio e sospende il backup automatico.
2. La nota viene creata su WordPress come bozza. L'app conserva l'id della bozza finché la finestra resta aperta.
3. L'app chiede a WordPress di pubblicare quella bozza. Il testo viene inviato di nuovo solo se nel frattempo titolo o testo sono stati modificati.
4. Se la risposta arriva, il link provvisorio diventa il link definitivo del post.
5. Se la connessione cade o WordPress risponde con un errore del server, l'app controlla lo stato del post fino a 8 volte, una ogni 5 secondi, quindi per circa 35 secondi. Se il post risulta pubblicato, la nota è considerata riuscita.
6. Se il post non risulta pubblicato, compare "Nota non ancora pubblicata: premi di nuovo Pubblica". La finestra resta aperta con il testo e il nuovo tentativo lavora sulla stessa bozza.
7. Un rifiuto esplicito di WordPress (credenziali o permessi) viene mostrato subito, senza controlli.
8. Alla fine, riuscita o no, il backup automatico riparte e tiene conto delle modifiche arrivate nel frattempo.

Se la connessione cade durante la creazione della bozza, l'app segnala l'errore e il testo resta nella finestra. In quel caso su WordPress può restare una bozza senza link in board: non è visibile ai lettori e si può eliminare dal pannello del sito. La stessa cosa accade se si chiude la finestra dopo un errore. Se il backup automatico è già in corso quando si preme Pubblica, viene lasciato terminare.

## Verifiche

Suite Playwright con un finto WordPress e Chromium in formato iPhone, 21 verifiche superate, conservata fuori dal repository come le precedenti:

- pubblicazione normale;
- connessione caduta con post pubblicato, senza doppioni e con il link giusto in board;
- connessione caduta con post non pubblicato, poi nuovo tentativo sulla stessa bozza con il titolo corretto;
- errore durante la creazione della bozza;
- backup automatico fermo durante la pubblicazione e ripartito dopo;
- rifiuto di WordPress mostrato subito.

La verifica finale spetta all'uso reale sull'iPhone, con il sito vero.

## Da fare

- Cestinare da WordPress il post doppio con id 905.
- Controllare i plugin di humansai.it per capire la lentezza nella pubblicazione.
