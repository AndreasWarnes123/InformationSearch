import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Tar en liste med tekster og returnerer en embedding-vektor per tekst
export async function embedTexts(texts) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small", // 1536 dimensjoner - matcher schema.sql
    input: texts,
  });

  return response.data.map((item) => item.embedding);
}
