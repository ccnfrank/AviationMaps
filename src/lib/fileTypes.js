// Imagens que o Mapa Reader abre (inclui os formatos com decodificador próprio e os RAW, que trazem
// um JPEG embutido). PDF é tratado à parte, em previewKind.js.
export const IMAGE_EXTENSIONS = [
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif", "ico",
  "tif", "tiff", "psd", "exr", "heic", "heif", "hif",
  "dng", "cr2", "cr3", "nef", "nrw", "arw", "orf", "rw2", "raf", "pef", "srw", "erf", "3fr", "iiq", "rwl",
];

const BY_EXT = Object.fromEntries(IMAGE_EXTENSIONS.map((e) => [e, "image"]));

// Extensão em minúsculas, sem o ponto. Nomes sem extensão (ou que começam com ponto) devolvem "".
export function getExtension(name) {
  const i = name.lastIndexOf(".");
  return i <= 0 ? "" : name.slice(i + 1).toLowerCase();
}

// Tipo usado na busca e nas cores das miniaturas. Imagem é "image"; PDF e o resto ficam em "other",
// como no Media Manager.
export function getFileType(name) {
  return BY_EXT[getExtension(name)] ?? "other";
}
