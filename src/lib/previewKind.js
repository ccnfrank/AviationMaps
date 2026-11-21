import { IMAGE_EXTENSIONS, getExtension } from "./fileTypes";

// Só imagens e PDF. Os demais formatos caem em "unsupported" e não aparecem no Mapa Reader.
const PDF_EXTENSIONS = ["pdf"];

const BY_EXT = Object.fromEntries([
  ...IMAGE_EXTENSIONS.map((e) => [e, "image"]),
  ...PDF_EXTENSIONS.map((e) => [e, "pdf"]),
]);

// Todas as extensões que o app abre (imagens e PDF), sem o ponto.
export const MAP_EXTENSIONS = [...IMAGE_EXTENSIONS, ...PDF_EXTENSIONS];

// Valor do atributo `accept` do seletor de arquivos.
export const ACCEPT = MAP_EXTENSIONS.map((e) => `.${e}`).join(",");

export function getPreviewKind(name) {
  return BY_EXT[getExtension(name)] ?? "unsupported";
}

// Primeiro arquivo da lista que o app abre (imagem ou PDF), ou null se nenhum abre.
export function firstMapFile(files) {
  return Array.from(files).find((f) => getPreviewKind(f.name) !== "unsupported") ?? null;
}
