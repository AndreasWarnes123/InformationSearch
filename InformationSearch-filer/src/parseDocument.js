import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

// Leser en fil fra disk og returnerer ren tekst, uansett filtype
export async function parseDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);

  if (ext === ".pdf") {
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === ".txt" || ext === ".md") {
    return buffer.toString("utf-8");
  }

  throw new Error(`Filtype ${ext} støttes ikke ennå. Legg til støtte i parseDocument.js`);
}
