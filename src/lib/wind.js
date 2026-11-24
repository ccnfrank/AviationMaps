// Vento: a direção é de onde o vento sopra, em graus (0° = norte, como no METAR). A velocidade é em nós.
// A seta aponta para onde o vento vai: a direção informada mais 180°. Vento de 280° aponta para 100°.

// Tamanho da seta na tela, em pixels. Fica igual em qualquer zoom, para continuar legível.
export const WIND_ARROW_PX = 40;

// Converte o texto de um campo para número. Vazio, inválido ou infinito vira null. Aceita vírgula decimal.
function toNumber(text) {
  const s = String(text ?? "").trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Valida os dois campos. Direção de 0 a 360 (360 é o mesmo que 0); velocidade não negativa.
export function parseWind(dirText, speedText) {
  const dir = toNumber(dirText);
  const speed = toNumber(speedText);
  if (dir == null || dir < 0 || dir > 360) return null;
  if (speed == null || speed < 0) return null;
  return { dir: dir % 360, speed };
}

// Geometria da seta centrada no ponto `center`, em unidades da superfície (`length`).
// Devolve o trecho (start → end), as duas pontas da base da cabeça (heads) e o recorte de trás da cabeça (notch).
// A cabeça é a ponta `end`, as duas pontas e o recorte: um desenho com a parte de trás côncava, mais leve que um triângulo.
export function windArrow(center, dir, length) {
  // Sentido em que o vento vai: a direção de onde ele vem, mais 180°. 0° aponta para cima (norte), e o ângulo cresce no sentido horário.
  const to = (((dir + 180) % 360) * Math.PI) / 180;
  // y cresce para baixo na tela, então o norte fica para cima.
  const ux = Math.sin(to);
  const uy = -Math.cos(to);
  const half = length / 2;
  const start = { x: center.x - ux * half, y: center.y - uy * half };
  const end = { x: center.x + ux * half, y: center.y + uy * half };
  // A cabeça tem as pontas 150° para trás da ponta, de cada lado, e o recorte um pouco mais atrás, no eixo.
  const head = length * 0.34;
  const base = Math.atan2(uy, ux);
  const wing = (sign) => {
    const a = base + sign * (5 * Math.PI) / 6;
    return { x: end.x + Math.cos(a) * head, y: end.y + Math.sin(a) * head };
  };
  const notch = { x: end.x + Math.cos(base + Math.PI) * head * 0.55, y: end.y + Math.sin(base + Math.PI) * head * 0.55 };
  return { start, end, heads: [wing(1), wing(-1)], notch };
}

// Quilômetros por hora em um nó.
export const KMH_PER_KT = 1.852;

// Converte um valor digitado para nós. A unidade é "kt" ou "kmh"; o cálculo sempre roda em nós.
export function toKnots(value, unit = "kt") {
  return unit === "kmh" ? value / KMH_PER_KT : value;
}

// Converte nós para a unidade de exibição ("kt" ou "kmh"), para preencher um campo já existente.
export function fromKnots(value, unit = "kt") {
  return unit === "kmh" ? value * KMH_PER_KT : value;
}

// TAS (velocidade verdadeira) digitada, convertida para nós. Vazio, inválido ou não positivo vira null.
export function parseTas(text, unit = "kt") {
  const n = toNumber(text);
  return n != null && n > 0 ? toKnots(n, unit) : null;
}

// A seta de vento mais próxima de um ponto (ex.: o meio de um trecho). Null sem setas.
export function nearestWind(winds, p) {
  let best = null;
  let bestD = Infinity;
  for (const w of winds) {
    const d = Math.hypot(w.x - p.x, w.y - p.y);
    if (d < bestD) {
      best = w;
      bestD = d;
    }
  }
  return best;
}

// Correção de deriva (triângulo do vento). `track` é o rumo verdadeiro que se quer seguir, em graus.
// `wind` é { dir, speed }: dir é de onde o vento sopra, em graus verdadeiros; speed em nós.
// `tas` é a velocidade verdadeira da aeronave, em nós.
// Devolve a proa verdadeira (heading), a correção (wca, positiva para a direita do rumo) e a velocidade
// sobre o solo (groundSpeed). Null sem vento ou TAS, ou quando o vento cruzado passa da TAS.
export function windCorrection(track, wind, tas) {
  if (!wind || !(tas > 0)) return null;
  const deg = (r) => (r * 180) / Math.PI;
  const rad = (d) => (d * Math.PI) / 180;
  // Direção para onde o vento vai, em relação ao rumo: 0 é vento de cauda, 180 é vento de proa.
  const rel = rad((((wind.dir + 180 - track) % 360) + 360) % 360);
  // Componente do vento perpendicular ao rumo. Positiva: o vento empurra para a direita.
  const cross = wind.speed * Math.sin(rel);
  const s = -cross / tas;
  if (Math.abs(s) > 1) return null;
  const wca = Math.asin(s);
  const heading = (((track + deg(wca)) % 360) + 360) % 360;
  const groundSpeed = tas * Math.cos(wca) + wind.speed * Math.cos(rel);
  return { heading, wca: deg(wca), groundSpeed };
}
