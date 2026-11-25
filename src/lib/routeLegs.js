import { angleOf, addDeclination } from "./measure";
import { distanceNm } from "./route";
import { nearestWind, windCorrection } from "./wind";

// Contas de um trecho da rota, usadas pelo mapa e pela exportação. `ctx` traz as superfícies já resolvidas:
// { winds (da superfície), declination (número ou null), cmPerUnit, denominator }.
// Sem declinação digitada, considera 0. O vento é o mais perto do meio do trecho, e a TAS é a desse vento
// (cada vento tem a sua). Ele é verdadeiro; se for magnético, vira verdadeiro pela declinação
// (verdadeiro = magnético − declinação).
// O nariz do avião fica no rumo verdadeiro, como a linha do trecho: sem vento, segue a linha; com vento e TAS,
// aponta para a proa verdadeira (TH). A declinação não entra no nariz; ela só aparece nos valores magnéticos.
export function legFigures(link, ctx) {
  const { winds, declination, cmPerUnit, denominator } = ctx;
  const dev = declination ?? 0;
  const trueTrack = angleOf(link.from, link.to);
  const magTrack = declination == null ? null : addDeclination(trueTrack, declination);
  const nm = distanceNm(link.px, cmPerUnit, denominator);
  const mid = { x: (link.from.x + link.to.x) / 2, y: (link.from.y + link.to.y) / 2 };
  const wind = nearestWind(winds, mid);
  const tas = wind?.tas ?? null;
  const windTrue = wind
    ? { dir: wind.magnetic ? addDeclination(wind.dir, -dev) : wind.dir, speed: wind.speed }
    : null;
  const correction = windTrue && tas != null ? windCorrection(trueTrack, windTrue, tas) : null;
  return {
    trueTrack,
    magTrack,
    nm,
    mid,
    wind,
    tas,
    correction,
    // Proa a voar: verdadeira e magnética (com a declinação, se houver).
    headingTrue: correction ? correction.heading : null,
    headingMag: correction && declination != null ? addDeclination(correction.heading, declination) : null,
    // Direção do nariz do avião, em verdadeiro: sem vento, a mesma direção da linha entre os dois pontos.
    // Com vento e TAS, a proa verdadeira (TH), sem declinação, para bater com a linha verdadeira do mapa.
    noseHeading: correction ? correction.heading : trueTrack,
  };
}
