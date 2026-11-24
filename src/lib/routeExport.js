// Exportação da rota em CSV. Português usa ponto e vírgula, com vírgula decimal (abre direto no Excel em
// português); os demais idiomas usam vírgula, com ponto decimal. Começa com BOM, para os acentos abrirem certo.
export function routeCsv(rows, language) {
  const sep = String(language ?? "").toLowerCase().startsWith("pt") ? ";" : ",";
  const cell = (v) => {
    const s = v == null ? "" : String(v);
    return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + rows.map((r) => r.map(cell).join(sep)).join("\r\n") + "\r\n";
}
