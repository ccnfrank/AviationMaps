import { IMAGE_EXTENSIONS, getExtension } from "./fileTypes";

// Só imagens e PDF. Os demais formatos caem em "unsupported" e não aparecem no Mapa Reader.
const PDF_EXTENSIONS = ["pdf"];

const BY_EXT = Object.fromEntries([
  ...IMAGE_EXTENSIONS.map((e) => [e, "image"]),
  ...PDF_EXTENSIONS.map((e) => [e, "pdf"]),
]);

// Valor do atributo `accept` do seletor de arquivos.
export const ACCEPT = [...IMAGE_EXTENSIONS, ...PDF_EXTENSIONS].map((e) => `.${e}`).join(",");

export function getPreviewKind(name) {
  return BY_EXT[getExtension(name)] ?? "unsupported";
}
