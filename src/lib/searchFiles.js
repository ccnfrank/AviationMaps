import { filterFiles } from "./filterFiles";

// Procura em todas as pastas. Devolve o total e só os primeiros `limit` resultados,
// para a lista continuar leve mesmo com dezenas de milhares de arquivos.
export function searchAll(folders, query, limit = 200) {
  if (!query.trim()) return { total: 0, items: [] };
  const items = [];
  let total = 0;
  folders.forEach((folder, folderIndex) => {
    for (const entry of filterFiles(folder.files, query, "all")) {
      total++;
      if (items.length < limit) items.push({ folderIndex, folder: folder.name, entry });
    }
  });
  return { total, items };
}

// Quebra o texto em trechos marcando os que casam com a busca (sem diferenciar maiúsculas).
export function splitHighlight(text, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const parts = [];
  let i = 0;
  for (let j = lower.indexOf(q); j >= 0; j = lower.indexOf(q, i)) {
    if (j > i) parts.push({ text: text.slice(i, j), hit: false });
    parts.push({ text: text.slice(j, j + q.length), hit: true });
    i = j + q.length;
  }
  if (i < text.length) parts.push({ text: text.slice(i), hit: false });
  return parts;
}
