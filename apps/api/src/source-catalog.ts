import { readFile } from "node:fs/promises";
import path from "node:path";
import { fail } from "./api-error.js";

export type CatalogDocument = {
  id: string; kind: string; year: number; area: string; modality: string;
  officialUrl: string; sha256: string | null; byteSize?: number; pageCount?: number;
  family?: string; variant?: string | null;
  auxiliary?: boolean; originalBytesAvailable?: boolean;
  derivation?: Record<string, unknown>;
};

export async function sourceCatalog(requireAuxiliary = false): Promise<CatalogDocument[]> {
  const catalogs = await Promise.all(["official-sources.json", "auxiliary-sources.json"].map(async (file) => {
    try {
      const catalog = JSON.parse(await readFile(path.resolve("data", file), "utf8"));
      if (!Array.isArray(catalog?.documents))
        fail("Catálogo de procedência inválido. Restaure os arquivos de dados antes de continuar.", 409);
      return catalog.documents as CatalogDocument[];
    }
    catch (error) {
      if (file === "auxiliary-sources.json" && (error as { code?: string }).code === "ENOENT") {
        if (requireAuxiliary) fail("Catálogo de procedência indisponível. Restaure os arquivos de dados antes de criar ou publicar questões oficiais.", 409);
        return [];
      }
      throw error;
    }
  }));
  const documents = catalogs.flat();
  if (new Set(documents.map((d) => d.id)).size !== documents.length)
    fail("Há identificadores repetidos nos catálogos de fontes.", 400);
  return documents;
}
