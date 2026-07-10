// Enkel chunking basert på tegn (grovt sett ~4 tegn per token).
// chunkSize og overlap er i tegn, ikke tokens - enkelt å justere senere.
export function chunkText(text, chunkSize = 3000, overlap = 300) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const chunks = [];

  let start = 0;
  let index = 0;

  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);
    const content = cleaned.slice(start, end).trim();

    if (content.length > 0) {
      chunks.push({ chunk_index: index, content });
      index += 1;
    }

    if (end === cleaned.length) break;
    start = end - overlap; // gå litt tilbake for å ikke miste kontekst mellom chunks
  }

  return chunks;
}
