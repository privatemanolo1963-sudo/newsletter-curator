# Sezioni, colori e rinomina dei tag (7 novembre 2026)

Specifica concordata in chat con Matteo il 7 novembre 2026.

## Flusso d'uso

Durante la settimana Matteo salva i link, li tagga e ordina le sezioni (i tag) nell'ordine
logico del numero. Il lavoro principale è taggare e ordinare le sezioni; l'eccezione è
aggiungere due o tre link a lavoro avviato e farli finire sotto il tag giusto.

## Pulsante Tag e pannello Sezioni

- Un tocco su **Tag** riordina la board secondo l'ordine delle sezioni di quella board e apre
  il pannello **Sezioni**: una riga per tag, con colore, nome e numero dei link.
- Le righe si trascinano; la board dietro si riordina mentre si sposta.
- Il pannello si chiude con la X (o toccando fuori).
- I link senza tag stanno sempre in fondo; nel pannello compaiono come ultima riga fissa.
- Dentro ogni sezione i link mantengono il loro ordine. Un link nuovo nasce in testa alla board
  e, dopo il tocco su Tag, finisce in testa alla sua sezione. Dentro la sezione si sposta a mano
  con il drag & drop.
- Ogni board ricorda il proprio ordine delle sezioni (campo `tagOrder` della board). Alla prima
  apertura l'ordine si ricava dalla posizione attuale dei tag nella board.
- Un tag che compare per la prima volta in una board entra in fondo all'ordine, prima dei link
  senza tag.
- Copiando o spostando link in un'altra board, l'ordine delle loro sezioni passa alla board di
  destinazione (i tag che la destinazione non conosce si aggiungono in coda, nell'ordine della
  board di partenza).
- L'ordine alfabetico non si usa più.

## Colori

- Tavolozza di 8 colori ben distinti. Ogni tag ha un indice colore fisso, valido in tutte le board.
- Un tag nuovo prende l'indice libero più basso: i primi 8 tag vivi hanno colori puri, dal nono
  in poi si usano sfumature degli stessi 8 colori.
- Eliminando un tag (crocetta nella finestra dei tag) il suo indice torna libero. Lo stesso vale
  per un tag che non è più assegnato a nessun link: sparisce dall'elenco e libera il colore.
- Alla prima esecuzione della nuova versione i colori puri vanno ai tag usati più di recente
  (data di inserimento del link più recente con quel tag), gli altri prendono le sfumature.

## Rinomina

- Nella finestra dei tag ogni tag ha una matita accanto alla crocetta.
- Il nome nuovo vale su tutti i link di tutte le board e negli ordini delle sezioni; il colore resta.
- Se il nome nuovo coincide con un tag esistente (anche solo per maiuscole e minuscole),
  l'app chiede conferma e unisce i due tag: resta il nome e il colore del tag esistente,
  il colore dell'altro torna libero.

## Dati e backup

- Nuova tabella IndexedDB `tags` (chiave `name`, campi `colorIndex`, `createdAt`),
  versione 2 dello schema Dexie.
- `tagOrder` (array di nomi) salvato sul record della board.
- La tabella `tags` entra in export, import e backup automatico su WordPress (hook e confronto
  dei dati). Un backup senza tabella `tags` resta ripristinabile: i colori vengono ricostruiti
  dai link. La protezione anti disastro non cambia.
