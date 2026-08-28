# Task Corrente

Niente in corso.

## Ultimo intervento completato

Gli **aerei ADS-B che non arrivano più**, segnalato dal sito pubblicato con la
console piena di errori di CORS. Non era una porta guasta: erano **tutte**, in
una sera sola e per tre motivi diversi — le quattro reti dirette rispondevano
senza `Access-Control-Allow-Origin`, `corsproxy.io` con un **401** (ha
cominciato a pretendere una chiave e un'origine registrata) e `allorigins` con
un **408**. La corsa con affiancamento e la pagella non potevano niente: sono
il modo di *scegliere* fra le porte, e qui non ce n'era nessuna da scegliere.

Quattro cambiamenti, in ordine di quanto risolvono.

- **Il proxy proprio si incolla dal pannello** (`aerei.js` §2-bis, nuovo). È
  la sola porta che si possa garantire, e prima si poteva indicare solo dal
  deploy: chi resta senza aerei vuole rimediare stasera. `CHIAVE_PROXY`
  (`astrocalendario_adsb_proxy`) vince su `ADSB_PROXY_URL`, e
  `providerDalProxy` riconosce due forme da sé — l'indirizzo del Worker (la
  rotta `/api/adsb` la aggiunge se manca e non la raddoppia a chi l'ha già
  scritta) e qualunque altro ponte scritto come modello con `{url}`.
  Scriverlo azzera la pagella.
- **Il mazzo dei ponti** (`PONTI`, §1): sei porte su infrastrutture diverse al
  posto di tre, `corsproxy.io` **fuori** — una porta che non può aprirsi non è
  una riserva, è un tentativo buttato a ogni giro — e di ogni ponte sono
  dichiarate le due cose che si sbagliano: se vuole l'indirizzo codificato o
  in chiaro, e se la risposta arriva **imbustata** (`sbusta`, tolta prima
  dell'interprete del feed). Ognuno è appaiato a un feed diverso: appaiarli
  tutti allo stesso vuol dire buttare metà della ridondanza appena pagata.
- **OpenSky è una porta e non solo un interprete.** `interpretaOpenSky` e
  `urlOpenSky` c'erano da sempre e non erano agganciati a niente: codice
  scritto, provato in `verifica.html`, e mai chiamato. È l'unica riserva
  diretta che non sia un mirror readsb.
- **Il guasto si racconta** (`riassumi`, `stato.tutteBloccate`). Tredici
  rifiuti di CORS non sono tredici guasti: sono un fatto solo — «da questa
  rete non passiamo» — e la cura è un'altra, non riprovare fra tre secondi. Il
  pannello adesso lo scrive e indica il campo del proxy due dita più in basso,
  e la scala delle riprove salta avanti invece di bussare a tredici porte
  chiuse ogni tre secondi.

Attorno: `PROVIDER_ATTESA_MS` da 9 a 12 s (un ponte fa due viaggi, e la
sveglia corta lo mandava in castigo per una colpa che non aveva), `sw.js` che
lascia passare i ponti nuovi **e** il proxy proprio riconoscendolo dalla forma
della richiesta (`.workers.dev`, la rotta `/api/adsb`), il Worker che risponde
anche sulla radice e dice in `X-Feed-ADSB` quale rete ha risposto,
`ADSB-PROXY.md` riscritto.

Prove nuove nel §27 di `verifica.html` (24 in più, 844 in tutto, zero
fallite), fra cui il contro-esempio della doppia codifica (`%253A`) e quello
della busta con dentro dell'HTML, che è il difetto di §1 travestito da ponte.

Cache PWA portata ad `astrocal-v217`.
