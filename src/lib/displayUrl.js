// URL que o navegador consegue carregar a partir de um arquivo.
// - Arquivo do Tauri: tem `src` (protocolo de assets). O navegador pede só os trechos
//   que precisa, e nada é copiado para a memória. O revoke não faz nada.
// - Blob ou File comum: vira object URL, que precisa ser revogada depois.
export function toDisplayUrl(source) {
  if (typeof source.src === "string") return { url: source.src, revoke() {} };
  const url = URL.createObjectURL(source);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}
