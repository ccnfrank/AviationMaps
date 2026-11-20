// Escala do mapa: 1 cm no papel equivale a `denominator` cm no terreno (escala 1:denominator).
// Ex.: 1:1.000.000 → 1 cm = 10 km.

// Milha náutica em metros: a unidade de distância de aviação e de navegação.
export const NM_METERS = 1852;

// Número digitado: aceita vírgula decimal e ponto (ou vírgula) como separador de milhar.
const toNumber = (text) => {
  if (!text) return NaN;
  const clean = /^\d{1,3}([.,]\d{3})+$/.test(text) ? text.replace(/[.,]/g, "") : text.replace(",", ".");
  return Number(clean);
};

// Denominador da escala a partir do texto digitado: "1:500000", "500000", "1:500.000" ou "2:100000"
// (que dá 1:50000). Devolve null quando não é uma escala válida.
export function parseScale(text) {
  const raw = String(text ?? "").replace(/\s+/g, "");
  if (!raw) return null;
  const colon = raw.indexOf(":");
  const left = colon === -1 ? "1" : raw.slice(0, colon);
  const right = colon === -1 ? raw : raw.slice(colon + 1);
  const a = toNumber(left);
  const b = toNumber(right);
  return a > 0 && b > 0 ? b / a : null;
}

// Distância real, em metros, correspondente a `cm` centímetros medidos no mapa.
export function groundMeters(cm, denominator) {
  return (cm / 100) * denominator;
}

// O que mostrar para 1 cm no mapa, conforme o tipo de mapa:
// - aviação e náutico: milhas náuticas (NM), com quilômetros ao lado;
// - terrestre: metros para trechos curtos e quilômetros a partir de 1 km.
export function scaleReadout(denominator, type) {
  const meters = groundMeters(1, denominator);
  if (type === "aviation" || type === "sea") {
    return {
      primary: { value: meters / NM_METERS, unit: "NM" },
      secondary: { value: meters / 1000, unit: "km" },
    };
  }
  return meters < 1000
    ? { primary: { value: meters, unit: "m" }, secondary: null }
    : { primary: { value: meters / 1000, unit: "km" }, secondary: null };
}
