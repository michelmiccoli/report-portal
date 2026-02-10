# Report Portal (Astro + Decap CMS) – Deploy Netlify

Questo progetto pubblica **report Word (.docx)** come pagine web navigabili (indice, filtri, ricerca), mantenendo **Word** come sorgente.

## Requisiti
- Node.js 18+ (consigliato)
- Un repository Git (GitHub/GitLab)
- Un account Netlify

## Avvio locale
```bash
npm install
npm run dev
```

CMS: http://localhost:4321/admin/

## Come funziona
1. Decap CMS salva un file JSON in `content/reports/` con metadata + path del DOCX
2. Il DOCX viene caricato in `public/report-docx/`
3. In build viene eseguito:
   - `npm run build:reports` → converte DOCX → `src/generated/<slug>/<version>.json`
   - `astro build` → genera le pagine statiche in `dist/`

## Convenzione link (pubblici)
- Versione specifica: `/reports/<slug>/<version>`
- “Latest + elenco versioni”: `/reports/<slug>/`

Esempio:
- `/reports/agricom-legal-red-flag/v1`

---

# Deploy su Netlify (Opzione B: CMS + Git Gateway)

## 1) Crea il sito su Netlify
1. Pusha questo progetto su GitHub/GitLab
2. Netlify → **Add new site** → **Import from Git**
3. Impostazioni build:
   - Build command: `npm run build`
   - Publish directory: `dist`

Astro è statico di default e non richiede configurazioni speciali per Netlify. Vedi guida Astro: Deploy su Netlify. citeturn0search1

## 2) Abilita Identity + Git Gateway (necessario per Decap CMS)
Netlify → Site settings:
1. **Identity** → Enable
2. **Identity → Registration**: scegli “Invite only” (consigliato)
3. **Identity → Services** → Enable **Git Gateway**

Guida ufficiale Netlify su Git Gateway. citeturn0search4  
Guida Decap su Git Gateway backend. citeturn0search0

## 3) Aggiungi utenti editor (chi carica i report)
Netlify → **Identity** → **Invite users**
Gli invitati riceveranno email per impostare password e potranno entrare in `/admin/`.

## 4) Accedi al CMS
Apri:
- `https://<tuo-sito>.netlify.app/admin/`

Dovresti vedere il login (Identity) e poi l’interfaccia Decap CMS.

Astro ha una guida dedicata per configurare Decap CMS (struttura cartelle /admin). citeturn0search10

---

# Workflow: pubblicare una nuova versione del report
1. Vai in `/admin/`
2. **Reports → New**
3. Compila:
   - slug (es. `agricom-legal-red-flag`)
   - version (es. `v2`)
   - title, date
   - carica il `.docx`
4. **Save** → **Publish**
5. Netlify rebuilda e avrai il link:
   - `/reports/agricom-legal-red-flag/v2`

---

# Note importanti
- Se usi un dominio custom, assicurati che HTTPS sia attivo prima di Identity/Git Gateway. citeturn0search4
- L’estrazione delle “issues” dalle tabelle è **best effort**: per massima precisione, mantenete un template Word coerente (intestazioni tabelle e sezioni).
