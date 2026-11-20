// A maioria dos RAW (CR2, NEF, ARW, DNG…) traz um JPEG de prévia dentro do arquivo.
// Achamos o maior deles para mostrar a foto sem decodificar o sensor.

// Percorre os segmentos de um JPEG a partir do SOI e devolve a posição logo após o EOI.
// Pular os segmentos (em vez de procurar o primeiro FFD9) evita parar na miniatura
// EXIF que fica aninhada dentro da prévia principal.
function jpegEnd(b, start) {
  const n = b.length;
  let p = start + 2;
  while (p + 1 < n) {
    if (b[p] !== 0xff) return -1;
    const m = b[p + 1];
    if (m === 0xd9) return p + 2;
    if (m === 0xff) { p += 1; continue; }
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01 || m === 0x00) { p += 2; continue; }
    if (p + 3 >= n) return -1;
    const len = (b[p + 2] << 8) | b[p + 3];
    if (len < 2) return -1;
    p += 2 + len;
    if (m === 0xda) {
      // Dados comprimidos: FF00 e RSTn são parte deles; qualquer outro FFxx encerra.
      while (p + 1 < n) {
        if (b[p] === 0xff) {
          const nx = b[p + 1];
          if (nx === 0x00 || (nx >= 0xd0 && nx <= 0xd7)) { p += 2; continue; }
          if (nx === 0xff) { p += 1; continue; }
          break;
        }
        p += 1;
      }
    }
  }
  return -1;
}

function isSoi(b, i) {
  return b[i] === 0xff && b[i + 1] === 0xd8 && b[i + 2] === 0xff;
}

// Devolve a fatia do maior JPEG completo encontrado nos bytes, ou null.
export function findLargestJpeg(bytes) {
  let best = null;
  let i = 0;
  while (i + 3 < bytes.length) {
    if (!isSoi(bytes, i)) { i += 1; continue; }
    const end = jpegEnd(bytes, i);
    if (end > i && (!best || end - i > best.end - best.start)) best = { start: i, end };
    i = end > i ? end : i + 2;
  }
  return best ? bytes.subarray(best.start, best.end) : null;
}
