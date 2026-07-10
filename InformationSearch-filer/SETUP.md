# Kunnskapsverktøy - ingestion-pipeline

Tar en fil (PDF, docx, txt), henter ut tekst, deler den i chunks, lager embeddings,
og bruker Claude til å finne entiteter/relasjoner. Alt lagres i Supabase.

## Oppsett

1. Installer avhengigheter:
   ```
   npm install
   ```

2. Kopier `.env.example` til `.env` og fyll inn nøklene dine:
   ```
   cp .env.example .env
   ```
   - `SUPABASE_URL` og `SUPABASE_SERVICE_KEY` finner du under Project Settings > API i Supabase
   - `OPENAI_API_KEY` fra platform.openai.com
   - `ANTHROPIC_API_KEY` fra console.anthropic.com

3. Kjør databaseskjemaet (`schema.sql`) i Supabase SQL Editor hvis du ikke allerede har gjort det.

## Bruk

```
node src/ingest.js sti/til/dokument.pdf
```

Scriptet gjør alt automatisk:
1. Leser og parser filen
2. Lagrer dokumentet i `documents`-tabellen
3. Deler teksten i chunks og lager embeddings (OpenAI)
4. Lagrer chunks med embeddings i `chunks`-tabellen
5. Bruker Claude til å finne entiteter og relasjoner
6. Lagrer disse i `entities`, `entity_mentions` og `relations`

## Kjente begrensninger (greit å vite for videre arbeid)

- Entitetsuttrekk kjøres på hele dokumentet (kuttet til ~12000 tegn), ikke per chunk.
  Det betyr at `entity_mentions.chunk_id` ikke settes ennå - bare `document_id`.
  For mer presise "hvor i dokumentet ble dette nevnt"-svar, kan man kjøre
  extractEntities per chunk i stedet for på hele teksten.
- Ingen deduplisering på tvers av stavevarianter ("Ola Nordmann" vs "O. Nordmann")
  - entitetene matches kun på eksakt navn + type.
- Store PDF-er (mange sider) kan bli kuttet av 12000-tegns-grensen i extractEntities.js
  før entitetsuttrekk - juster grensen eller kjør chunk-vis om nødvendig.
