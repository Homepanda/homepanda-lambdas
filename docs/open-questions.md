# Domande aperte

1. Il branch di lavoro su `Homepanda/homepanda-lambdas` è `main`? Il remoto `origin/main` non esiste in questo clone.
2. La cartella CommonJS in `project/lambda-immobiliare-ads-handler` va ignorata, o va conservata come storico a parte?
3. `IMMOBILIARE_AGENCY_HP` e `IMMOBILIARE_AGENCY_RLB` sono sulla funzione ma non nel sorgente recuperato. Sono residue o usate da un percorso non presente nello zip?
4. Quando si potrà costruire lo zip e confrontare il `CodeSha256` con `TBbIN+yfQqPFi70Cviy0ZvJL2CDQJAgBrKB/X24hx10=`?
5. Il pacchetto in AWS non fa il parse. Si pubblica la correzione locale di `generateXml.mjs`, oppure si lascia la funzione com'è finché non si decide il pilota di deploy?
6. Questa funzione è il pilota di deploy, o l'impostazione si ferma al sorgente finché non si sceglie un'altra funzione meno critica?
7. Si autorizza più avanti l'inventario in sola lettura delle altre funzioni nello stesso account e nella stessa regione? Il 2026-10-16 è stata letta solo `lambda-immobiliare-leads-handler`.
8. In `services/immobiliare.mjs` di leads l'identificatore `nseDetail` non è dichiarato. Si pubblica una correzione, oppure il sorgente resta identico al pacchetto AWS finché non si decide un deploy?
9. In `lambda-homepanda-whatsapp-bitrix-message` il sorgente usa `SQS_WHATSAPP_OUTBOUND`, ma la variabile non risulta nella configurazione della funzione. È stata rimossa in AWS o va aggiunta alla configurazione?
10. La policy IAM del ruolo `lambda-homepanda-whatsapp-bitrix-message-role-irqlmjye` non è stata letta. Si autorizza la verifica in sola lettura?
