// Medição na pré-visualização: distância e dimensões em px e cm.
//
// Unidades: "px" é o pixel real da imagem; num PDF é o ponto (pt), que equivale a px a 72 dpi.
// Para virar cm, cada unidade precisa de uma escala (cm por px):
// - PDF: exata, 1 pt = 2,54 / 72 cm.
// - Imagem: pela resolução gravada no arquivo (DPI, em PNG ou JPEG), ou por calibração
//   (o usuário desenha uma linha de tamanho conhecido e informa o comprimento real).

export const CM_PER_INCH = 2.54;
export const PDF_CM_PER_UNIT = CM_PER_INCH / 72;

// Comprimento de uma linha (x1,y1)-(x2,y2) nas unidades da superfície, e em cm se houver escala.
export function lineMetrics(line, cmPerUnit = null) {
  const dx = Math.abs(line.x2 - line.x1);
  const dy = Math.abs(line.y2 - line.y1);
  const px = Math.hypot(dx, dy);
  const scaled = cmPerUnit != null;
  return {
    px,
    dx,
    dy,
    cm: scaled ? px * cmPerUnit : null,
    dxCm: scaled ? dx * cmPerUnit : null,
    dyCm: scaled ? dy * cmPerUnit : null,
  };
}

export function cmPerUnitFromDpi(dpi) {
  return dpi > 0 ? CM_PER_INCH / dpi : null;
}

// Calibração: o usuário mediu `px` unidades e diz que o tamanho real é `knownCm`.
export function cmPerUnitFromCalibration(knownCm, px) {
  return knownCm > 0 && px > 0 ? knownCm / px : null;
}

// Número com as casas decimais pedidas, no formato do idioma (vírgula em português).
export function formatNumber(value, digits = 0, language = "en") {
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

const u32be = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

// PNG: o bloco pHYs guarda os pixels por metro (unidade 1). Precisa vir antes dos dados da imagem.
export function parsePngDpi(b) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((v, i) => b[i] === v)) return null;
  let o = 8;
  while (o + 8 <= b.length) {
    const len = u32be(b, o);
    const type = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7]);
    if (type === "pHYs" && len >= 9) {
      const perMeter = u32be(b, o + 8);
      const unit = b[o + 16];
      return unit === 1 && perMeter > 0 ? perMeter * 0.0254 : null;
    }
    if (type === "IDAT" || type === "IEND") return null;
    o += 12 + len;
  }
  return null;
}

// EXIF (dentro do JPEG): XResolution e ResolutionUnit do IFD0. `t` é o início do bloco TIFF.
function parseExifDpi(b, t) {
  const le = b[t] === 0x49 && b[t + 1] === 0x49;
  if (!le && !(b[t] === 0x4d && b[t + 1] === 0x4d)) return null;
  const u16 = (o) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o) => (le
    ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
    : u32be(b, o));
  const ifd = t + u32(t + 4);
  if (ifd + 2 > b.length) return null;
  const count = u16(ifd);
  let xres = null;
  let unit = 2; // padrão do EXIF: polegada
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > b.length) return null;
    const tag = u16(e);
    if (tag === 0x011a) {
      const off = t + u32(e + 8);
      if (off + 8 > b.length) return null;
      const den = u32(off + 4);
      if (den) xres = u32(off) / den;
    } else if (tag === 0x0128) {
      unit = u16(e + 8);
    }
  }
  if (!xres) return null;
  if (unit === 2) return xres;
  if (unit === 3) return xres * CM_PER_INCH; // pontos por cm
  return null;
}

// JPEG: JFIF (APP0) e EXIF (APP1). Lê os marcadores até o início dos dados da imagem.
export function parseJpegDpi(b) {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let o = 2;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) return null;
    const marker = b[o + 1];
    if (marker === 0xd9 || marker === 0xda) return null; // fim da imagem ou dados: sem metadados
    const len = (b[o + 2] << 8) | b[o + 3];
    const data = o + 4;
    const isJfif = b[data] === 0x4a && b[data + 1] === 0x46 && b[data + 2] === 0x49 && b[data + 3] === 0x46 && b[data + 4] === 0;
    const isExif = b[data] === 0x45 && b[data + 1] === 0x78 && b[data + 2] === 0x69 && b[data + 3] === 0x66 && b[data + 4] === 0 && b[data + 5] === 0;
    if (marker === 0xe0 && isJfif) {
      const units = b[data + 7];
      const x = (b[data + 8] << 8) | b[data + 9];
      if (x > 0 && units === 1) return x;
      if (x > 0 && units === 2) return x * CM_PER_INCH;
    }
    if (marker === 0xe1 && isExif) {
      const dpi = parseExifDpi(b, data + 6);
      if (dpi) return dpi;
    }
    o += 2 + len;
  }
  return null;
}

// Resolução (dpi) gravada no arquivo, ou null quando não há. Formatos sem metadados caem em null.
export async function readImageDpi(file) {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return parsePngDpi(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return parseJpegDpi(bytes);
    return null;
  } catch {
    return null;
  }
}

// Cadeia de pontos clicados: cada par de pontos consecutivos é um segmento.
export function segmentsOf(points) {
  return points.slice(1).map((p, i) => {
    const a = points[i];
    return { x1: a.x, y1: a.y, x2: p.x, y2: p.y, px: Math.hypot(p.x - a.x, p.y - a.y) };
  });
}

// Comprimento total da cadeia, nas unidades da superfície.
export function chainLength(points) {
  return segmentsOf(points).reduce((sum, s) => sum + s.px, 0);
}

// Ângulo de `to` a partir de `from`, de 0 a 360 graus. 0° aponta para cima (norte, o gume do
// transferidor) e o ângulo cresce no sentido horário. Y cresce para baixo na tela, por isso o
// eixo x vem do seno e o y, do cosseno negativo.
export function angleOf(from, to) {
  const deg = (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI;
  const wrapped = deg < 0 ? deg + 360 : deg;
  return wrapped >= 360 ? 0 : wrapped;
}

// Desvio magnético digitado: número com sinal (positivo ou negativo), em graus. Aceita vírgula
// decimal, como no português. Texto vazio ou inválido vira null.
export function parseDeclination(text) {
  const value = Number(String(text ?? "").trim().replace(",", "."));
  return String(text ?? "").trim() !== "" && Number.isFinite(value) ? value : null;
}

// Desvio magnético com sinal, a partir da variação digitada (sem sinal) e do lado: "E" (leste) ou "W" (oeste).
// Magnético = verdadeiro + desvio, então a variação Leste entra negativa e a Oeste, positiva
// (leste é menos: 23° E vira −23). Vazio, inválido ou negativo vira null.
export function declinationFrom(text, side) {
  const magnitude = parseDeclination(text);
  if (magnitude == null || magnitude < 0) return null;
  return side === "E" ? -magnitude : magnitude;
}

// Ângulo somado ao desvio, normalizado para 0 a 360 graus.
export function addDeclination(deg, declination) {
  const wrapped = (((deg + declination) % 360) + 360) % 360;
  return wrapped >= 360 ? 0 : wrapped;
}
