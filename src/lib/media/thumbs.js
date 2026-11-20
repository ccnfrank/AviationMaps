import { getImageBlob } from "./decodeImage";
import { renderPdfThumb } from "./pdfThumb";

// Miniaturas são geradas sob demanda. Uma pasta pode ter milhares de mapas, mas
// só as células na tela pedem miniatura. Por isso:
// - a fila roda poucas por vez;
// - atende primeiro os pedidos mais novos (o que acabou de aparecer na tela);
// - pedidos de células que já saíram da tela são descartados sem trabalho;
// - o resultado fica num cache limitado, então voltar a uma busca é imediato.
const THUMB_SIDE = 480;
const MAX_PARALLEL = 3;
const CACHE_LIMIT = 400;

const cache = new Map(); // chave -> Blob; a ordem de inserção dá o LRU
const waiting = [];
let running = 0;

function remember(key, blob) {
  cache.delete(key);
  cache.set(key, blob);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
}

function thumbKey(file, kind) {
  return [file.path ?? file.webkitRelativePath, file.size, file.lastModified ?? 0, kind].join("|");
}

function enqueue(task) {
  return new Promise((resolve, reject) => {
    waiting.push(() => task().then(resolve, reject));
    pump();
  });
}

function pump() {
  while (running < MAX_PARALLEL && waiting.length) {
    running += 1;
    // pop(): o último pedido é o mais recente, ou seja, o que está na tela agora.
    waiting.pop()().finally(() => {
      running -= 1;
      pump();
    });
  }
}

// Devolve um Blob de miniatura, ou null se não há miniatura para o tipo.
// `isAlive` diz se quem pediu ainda está na tela; se não estiver, o trabalho é pulado.
export function getThumb(file, kind, isAlive = () => true) {
  const key = thumbKey(file, kind);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  return enqueue(async () => {
    if (!isAlive()) return null;
    const blob = await produce(file, kind);
    if (blob) remember(key, blob);
    return blob;
  });
}

function produce(file, kind) {
  if (kind === "image") return getImageBlob(file, { maxSide: THUMB_SIDE });
  if (kind === "pdf") return renderPdfThumb(file, THUMB_SIDE);
  return Promise.resolve(null);
}
