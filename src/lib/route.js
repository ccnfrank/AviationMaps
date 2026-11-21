import { groundMeters, NM_METERS } from "./scale";

// Rota: os pontos plotados, ligados na ordem em que foram plotados. Só liga dois pontos seguidos
// quando os dois estão na mesma superfície (a imagem, ou uma página do PDF): trocar de página
// quebra a rota. Trechos sem comprimento (dois cliques no mesmo lugar) não viram ligação.
export function routeLinks(plots, surface) {
  const links = [];
  for (let i = 0; i + 1 < plots.length; i++) {
    const from = plots[i];
    const to = plots[i + 1];
    if (from.surface !== surface || to.surface !== surface) continue;
    const px = Math.hypot(to.x - from.x, to.y - from.y);
    if (px < 1) continue;
    links.push({ key: `${from.id}>${to.id}`, from, to, px });
  }
  return links;
}

// Distância real, em milhas náuticas, de `px` unidades da superfície. Null sem escala do mapa
// (denominador) ou sem resolução da superfície (cm por unidade).
export function distanceNm(px, cmPerUnit, denominator) {
  if (cmPerUnit == null || denominator == null) return null;
  return groundMeters(px * cmPerUnit, denominator) / NM_METERS;
}

// Rumo com três dígitos, como se lê numa carta: 045°. 359,6° arredonda para 000°.
export function formatBearing(deg) {
  return `${String(Math.round(deg) % 360).padStart(3, "0")}°`;
}
