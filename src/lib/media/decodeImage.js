import i18n from "../../i18n";
import { getExtension } from "../fileTypes";
import { toDisplayUrl } from "../displayUrl";
import { findLargestJpeg } from "./embeddedJpeg";

// Formatos que o <img> do navegador mostra sem ajuda.
const NATIVE = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif", "ico"]);
// HEIC: Safari mostra direto; nos outros navegadores usamos o decodificador (carregado sob demanda).
const HEIF = new Set(["heic", "heif", "hif"]);

// Decodificar é pesado (TIFF grande, PSD, EXR). Uma grade com muitas miniaturas
// não pode disparar tudo de uma vez, então roda no máximo duas por vez.
const MAX_PARALLEL = 2;
let running = 0;
const queue = [];
function limit(task) {
  return new Promise((resolve, reject) => {
    const run = () => {
      running += 1;
      task().then(resolve, reject).finally(() => {
        running -= 1;
        queue.shift()?.();
      });
    };
    if (running < MAX_PARALLEL) run();
    else queue.push(run);
  });
}

// Cache por arquivo (WeakMap: some sozinho quando o arquivo sai da memória).
const cache = new WeakMap();

// Devolve um Blob que o <img> consegue mostrar. Com `maxSide`, o resultado é
// reduzido para esse lado maior (usado nas miniaturas). Sem `maxSide`, formato nativo
// volta o próprio arquivo, sem copiar nada.
export function getImageBlob(file, { maxSide = null } = {}) {
  const ext = getExtension(file.name);
  if (!maxSide && NATIVE.has(ext)) return Promise.resolve(file);

  let byScale = cache.get(file);
  if (!byScale) {
    byScale = new Map();
    cache.set(file, byScale);
  }
  const key = maxSide ?? 0;
  if (!byScale.has(key)) byScale.set(key, limit(() => decode(file, ext, maxSide)));
  return byScale.get(key);
}

async function decode(file, ext, maxSide) {
  if (HEIF.has(ext)) {
    if (await showsNatively(file)) return maxSide ? drawFromImg(file, maxSide) : file;
    const { heicTo } = await import("heic-to");
    const bitmap = await heicTo({ blob: file, type: "bitmap" });
    return drawToBlob(bitmap, bitmap.width, bitmap.height, maxSide);
  }
  // Formato nativo só chega aqui para miniatura: o navegador abre e a gente reduz.
  if (NATIVE.has(ext)) return drawFromImg(file, maxSide);

  const chain = DECODERS[ext] ?? [decodeEmbeddedJpeg];
  const buffer = await file.arrayBuffer();
  let lastError = null;
  for (const decoder of chain) {
    try {
      const source = await decoder(buffer);
      return await drawToBlob(source, source.width, source.height, maxSide);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("Formato sem decodificador");
}

// Decodificadores por extensão, em ordem de tentativa. Cada um recebe o ArrayBuffer
// e devolve algo desenhável (canvas ou ImageBitmap) com width/height.
const DECODERS = {
  tif: [decodeTiff, decodeEmbeddedJpeg],
  tiff: [decodeTiff, decodeEmbeddedJpeg],
  psd: [decodePsd],
  exr: [decodeExr],
};

async function decodeTiff(buffer) {
  const { default: UTIF } = await import("utif");
  const ifds = UTIF.decode(buffer);
  const page = ifds[0];
  if (!page) throw new Error("TIFF sem imagem");
  UTIF.decodeImage(buffer, page, ifds);
  return rgbaToCanvas(UTIF.toRGBA8(page), page.width, page.height);
}

async function decodePsd(buffer) {
  const { readPsd } = await import("ag-psd");
  const psd = readPsd(buffer, { skipLayerImageData: true, skipThumbnail: true });
  if (!psd.canvas) throw new Error("PSD sem imagem composta");
  return psd.canvas;
}

async function decodeExr(buffer) {
  const [{ EXRLoader }, { DataUtils }] = await Promise.all([
    import("three/examples/jsm/loaders/EXRLoader.js"),
    import("three"),
  ]);
  const { width, height, data } = new EXRLoader().parse(buffer);
  // Dados em half-float chegam como Uint16; em float, como Float32.
  const toLinear = data instanceof Uint16Array ? (v) => DataUtils.fromHalfFloat(v) : (v) => v;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let k = 0; k < out.length; k += 4) {
    for (let c = 0; c < 3; c += 1) out[k + c] = toSrgb8(toLinear(data[k + c]));
    out[k + 3] = toSrgb8(toLinear(data[k + 3]), true);
  }
  return rgbaToCanvas(out, width, height);
}

// Linear -> sRGB de 0 a 255, cortando o que passa de 1 (sem tone mapping).
function toSrgb8(v, alphaOnly = false) {
  const x = Math.min(Math.max(v, 0), 1);
  if (alphaOnly) return Math.round(x * 255);
  const s = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  return Math.round(s * 255);
}

async function decodeEmbeddedJpeg(buffer) {
  const jpeg = findLargestJpeg(new Uint8Array(buffer));
  if (!jpeg) throw new Error("Sem JPEG de prévia dentro do arquivo");
  return createImageBitmap(new Blob([jpeg], { type: "image/jpeg" }));
}

function rgbaToCanvas(rgba, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const pixels = new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, width * height * 4);
  canvas.getContext("2d").putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas;
}

// Desenha a fonte (reduzida se preciso). Miniatura (com maxSide) sai em JPEG, menor e
// próprio para o cache; o fundo transparente vira branco. Sem maxSide, sai em PNG.
function drawToBlob(source, width, height, maxSide) {
  const scale = maxSide && Math.max(width, height) > maxSide ? maxSide / Math.max(width, height) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (maxSide) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const type = maxSide ? "image/jpeg" : "image/png";
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar imagem"))), type, 0.85);
  });
}

// Abre o arquivo no <img> do próprio navegador (sem copiar os bytes) e reduz o resultado.
async function drawFromImg(file, maxSide) {
  const img = await loadWithImg(file);
  // SVG sem tamanho próprio chega com naturalWidth 0: usa um tamanho de segurança.
  const width = img.naturalWidth || 512;
  const height = img.naturalHeight || 512;
  return drawToBlob(img, width, height, maxSide);
}

function loadWithImg(file) {
  return new Promise((resolve, reject) => {
    const { url, revoke } = toDisplayUrl(file);
    const img = new Image();
    img.onload = () => { revoke(); resolve(img); };
    img.onerror = () => { revoke(); reject(new Error(i18n.t("errors.imageOpen"))); };
    img.src = url;
  });
}

// Testa se o navegador mostra o arquivo sem decodificar nada extra (ex.: HEIC no Safari).
function showsNatively(file) {
  return loadWithImg(file).then(() => true, () => false);
}
