import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Du trekker ut strukturert informasjon fra bedriftsdokumenter.
Les teksten og finn:
- entities: personer, kunder, prosjekter, steder, saker som nevnes
- relations: relasjoner mellom to entiteter, f.eks. "signerte_kontrakt_med", "jobber_pa", "deltok_i_mote_om"

Svar KUN med gyldig JSON, ingen annen tekst, i dette formatet:
{
  "entities": [{ "name": "...", "type": "person|kunde|prosjekt|sted|sak" }],
  "relations": [{ "entity_a": "...", "entity_b": "...", "relation_type": "..." }]
}

Bruk nøyaktig samme navn i "relations" som i "entities". Hvis du ikke finner noe, returner tomme lister.`;

export async function extractEntities(text) {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: text.slice(0, 12000) }], // grovt kutt for å holde seg innenfor kontekst
  });

  const raw = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("Klarte ikke å parse LLM-svar som JSON:", raw);
    return { entities: [], relations: [] };
  }
}
