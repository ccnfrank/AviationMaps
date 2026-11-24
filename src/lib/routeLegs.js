import { angleOf, addDeclination } from "./measure";
import { distanceNm } from "./route";
import { nearestWind, windCorrection } from "./wind";

// Contas de um trecho da rota, usadas pelo mapa e pela exportação. `ctx` traz as superfícies já resolvidas:
// { winds (da superfície), declination (número ou null), tas (nós ou null), cmPerUnit, denominator }.
// O vento é o mais perto do meio do trecho. Ele é verdadeiro; o magnético vira verdadeiro pela declinação
// (verdadeiro = magnético − declinação). Sem declinação, o vento magnético não entra na conta.
export function legFigures(link, ctx) {
  const { winds, declination, tas, cmPerUnit, denominator } = ctx;
  const trueTrack = angleOf(link.from, link.to);
  const magTrack = declination == null ? null : addDeclination(trueTrack, declination);
  const nm = distanceNm(link.px, cmPerUnit, denominator);
  const mid = { x: (link.from.x + link.to.x) / 2, y: (link.from.y + link.to.y) / 2 };
  const wind = nearestWind(winds, mid);
  const needsDeclination = Boolean(wind && wind.magnetic && declination == null);
  const windTrue = wind && !needsDeclination
    ? { dir: wind.magnetic ? addDeclination(wind.dir, -declination) : wind.dir, speed: wind.speed }
    : null;
  const correction = windTrue && tas != null ? windCorrection(trueTrack, windTrue, tas) : null;
  const base = correction ? correction.heading : trueTrack;
  return {
    trueTrack,
    magTrack,
    nm,
    mid,
    wind,
    needsDeclination,
    correction,
    // Proa a voar: verdadeira e magnética (com a declinação, se houver).
    headingTrue: correction ? correction.heading : null,
    headingMag: correction && declination != null ? addDeclination(correction.heading, declination) : null,
    // Direção do nariz do avião: a proa do cálculo, ou o rumo, com a declinação somada.
    noseHeading: declination == null ? base : addDeclination(base, declination),
  };
}
