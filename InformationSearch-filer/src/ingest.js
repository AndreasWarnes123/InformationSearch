import "dotenv/config";
import path from "path";
import { parseDocument } from "./parseDocument.js";
import { chunkText } from "./chunkText.js";
import { embedTexts } from "./embeddings.js";
import { extractEntities } from "./extractEntities.js";
import { supabase } from "./supabaseClient.js";

async function ingest(filePath) {
  console.log(`\n1/5 Leser fil: ${filePath}`);
  const rawText = await parseDocument(filePath);
  console.log(`   -> ${rawText.length} tegn hentet ut`);

  console.log("2/5 Lagrer dokument i database");
  const { data: document, error: docError } = await supabase
    .from("documents")
    .insert({
      filename: path.basename(filePath),
      raw_text: rawText,
    })
    .select()
    .single();

  if (docError) throw docError;
  console.log(`   -> document_id: ${document.id}`);

  console.log("3/5 Deler opp i chunks og lager embeddings");
  const chunks = chunkText(rawText);
  const embeddings = await embedTexts(chunks.map((c) => c.content));

  const chunkRows = chunks.map((chunk, i) => ({
    document_id: document.id,
    chunk_index: chunk.chunk_index,
    content: chunk.content,
    embedding: embeddings[i],
  }));

  const { error: chunkError } = await supabase.from("chunks").insert(chunkRows);
  if (chunkError) throw chunkError;
  console.log(`   -> ${chunkRows.length} chunks lagret`);

  console.log("4/5 Trekker ut entiteter og relasjoner med Claude");
  const { entities, relations } = await extractEntities(rawText);
  console.log(`   -> ${entities.length} entiteter, ${relations.length} relasjoner funnet`);

  console.log("5/5 Lagrer entiteter og relasjoner");
  const entityIdByName = new Map();

  for (const entity of entities) {
    // upsert: hvis entiteten finnes fra før (samme navn+type), bruk den i stedet for å lage duplikat
    const { data: existing } = await supabase
      .from("entities")
      .select("id")
      .eq("name", entity.name)
      .eq("type", entity.type)
      .maybeSingle();

    let entityId = existing?.id;

    if (!entityId) {
      const { data: created, error: createError } = await supabase
        .from("entities")
        .insert({ name: entity.name, type: entity.type })
        .select()
        .single();
      if (createError) throw createError;
      entityId = created.id;
    }

    entityIdByName.set(entity.name, entityId);

    await supabase.from("entity_mentions").insert({
      entity_id: entityId,
      document_id: document.id,
    });
  }

  for (const relation of relations) {
    const entityAId = entityIdByName.get(relation.entity_a);
    const entityBId = entityIdByName.get(relation.entity_b);

    if (!entityAId || !entityBId) {
      console.warn(`   Hopper over relasjon - ukjent entitet: ${relation.entity_a} / ${relation.entity_b}`);
      continue;
    }

    await supabase.from("relations").insert({
      entity_a_id: entityAId,
      entity_b_id: entityBId,
      relation_type: relation.relation_type,
      source_document_id: document.id,
    });
  }

  console.log("\nFerdig! Dokumentet er nå søkbart og en del av tankekartet.\n");
}

const filePath = process.argv[2];
if (!filePath) {
  console.error("Bruk: node src/ingest.js sti/til/dokument.pdf");
  process.exit(1);
}

ingest(filePath).catch((err) => {
  console.error("Noe gikk galt:", err);
  process.exit(1);
});
