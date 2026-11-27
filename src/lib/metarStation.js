// Estação do METAR no mapa. Segue o símbolo de estação meteorológica: um círculo com a cobertura de
// nuvens preenchida, a cor pela categoria de voo, e o vento numa haste (apontando para de onde ele sopra)
// com plumas. O texto original do METAR fica ao lado. Nada aqui é decodificado para o texto: o original é usado como vem.

// Dados do METAR que o desenho usa. São copiados no momento de plotar, então uma consulta nova não muda a estação.
export function stationFromMetar(metar) {
  return {
    icao: metar.icaoId ?? null,
    raw: metar.rawOb ?? "",
    fltCat: metar.fltCat ?? null,
    wdir: metar.wdir ?? null,
    wspd: metar.wspd ?? null,
    cover: metar.cover ?? null,
    clouds: Array.isArray(metar.clouds) ? metar.clouds.map((c) => ({ cover: c.cover ?? null, base: c.base ?? null })) : [],
  };
}

// Fração do céu coberta pela camada mais densa: 0 (limpo) a 1 (encoberto). Códigos de cobertura do METAR.
const COVER_FRACTION = { SKC: 0, CLR: 0, NSC: 0, NCD: 0, CAVOK: 0, FEW: 0.25, SCT: 0.5, BKN: 0.75, OVC: 1, OVX: 1 };
export function skyFraction(station) {
  return [...station.clouds.map((c) => c.cover), station.cover].reduce(
    (max, cover) => Math.max(max, COVER_FRACTION[cover] ?? 0),
    0,
  );
}

// Classe de cor da categoria de voo: VFR, MVFR, IFR ou LIFR. Sem categoria conhecida, "none".
const CATEGORY_CLASS = { VFR: "vfr", MVFR: "mvfr", IFR: "ifr", LIFR: "lifr" };
export const flightCategoryClass = (fltCat) => CATEGORY_CLASS[fltCat] ?? "none";

// Plumas do vento, pela convenção de estação: bandeira = 50 kt, pluma inteira = 10 kt, meia pluma = 5 kt.
// A velocidade é arredondada para o múltiplo de 5 mais perto. Calmo (menos de 3 kt) não tem plumas.
export function windBarb(speed) {
  const knots = Math.round((speed ?? 0) / 5) * 5;
  const rest = knots % 50;
  return {
    flags: Math.floor(knots / 50),
    full: Math.floor(rest / 10),
    half: rest % 10 >= 5 ? 1 : 0,
  };
}

// Haste e plumas do vento, a partir do centro da estação, no mesmo sistema da superfície (y cresce para baixo).
// `wdir` é a direção de onde o vento sopra, em graus. Sem direção numérica (VRB) ou sem vento, não há haste: devolve null.
// A haste sai da borda do círculo (`start`) e aponta para `wdir`. As plumas ficam do lado esquerdo da haste,
// inclinadas para a ponta, e as bandeiras vêm primeiro, da ponta para dentro.
export function barbGeometry(wdir, speed, { start, staff, feather, space }) {
  if (typeof wdir !== "number" || !(speed > 0)) return null;
  const { flags, full, half } = windBarb(speed);
  if (flags + full + half === 0) return null;
  const rad = (wdir * Math.PI) / 180;
  const u = { x: Math.sin(rad), y: -Math.cos(rad) }; // para onde o vento vem: a haste
  const n = { x: -Math.cos(rad), y: -Math.sin(rad) }; // lado esquerdo da haste: onde ficam as plumas
  const f = { x: n.x * 0.866 + u.x * 0.5, y: n.y * 0.866 + u.y * 0.5 }; // pluma inclinada para a ponta
  const at = (d) => ({ x: u.x * d, y: u.y * d });
  const shift = (p, q, k) => ({ x: p.x + q.x * k, y: p.y + q.y * k });

  const out = {
    staff: { x1: at(start).x, y1: at(start).y, x2: at(staff).x, y2: at(staff).y },
    flags: [],
    feathers: [],
  };
  let t = 0; // distância, para dentro a partir da ponta, do próximo símbolo
  for (let i = 0; i < flags; i += 1) {
    const outer = at(staff - t);
    const inner = at(staff - t - space);
    out.flags.push([outer, shift(outer, f, feather), inner]);
    t += space;
  }
  const feathersLeft = [...Array(full).fill(1), ...Array(half).fill(0.5)];
  for (const size of feathersLeft) {
    const base = at(staff - t);
    const tip = shift(base, f, feather * size);
    out.feathers.push({ x1: base.x, y1: base.y, x2: tip.x, y2: tip.y });
    t += space;
  }
  return out;
}

// Setor preenchido da cobertura, do norte no sentido horário, até `fraction` do círculo de raio `radius`.
// Cobertura cheia (1) ou nenhuma (0) não tem setor: devolve null.
export function skyPath(fraction, radius) {
  if (!(fraction > 0) || fraction >= 1) return null;
  const angle = 2 * Math.PI * fraction;
  const x = radius * Math.sin(angle);
  const y = -radius * Math.cos(angle);
  const large = fraction > 0.5 ? 1 : 0;
  return `M 0 0 L 0 ${-radius} A ${radius} ${radius} 0 ${large} 1 ${x} ${y} Z`;
}

// Lado do texto original em relação ao símbolo: do lado oposto à haste do vento, para a caixa não cobrir a haste.
// `left`: a caixa vai para a esquerda (a haste aponta para a direita). `up`: a caixa vai para cima (a haste aponta para baixo).
// Sem haste (calmo, variável, sem direção), a caixa fica à direita e embaixo.
export function calloutSide(wdir, speed) {
  if (typeof wdir !== "number" || !(speed > 0)) return { left: false, up: false };
  const rad = (wdir * Math.PI) / 180;
  return { left: Math.sin(rad) >= 0, up: -Math.cos(rad) >= 0 };
}

// Quebra o METAR original em linhas de até `width` caracteres, sem cortar palavras (uma palavra longa fica sozinha).
export function wrapRaw(text, width = 28) {
  const lines = [];
  let line = "";
  for (const word of String(text ?? "").trim().split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
