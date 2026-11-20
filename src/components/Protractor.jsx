import { useTranslation } from "react-i18next";
import { addDeclination, angleOf, parseDeclination } from "../lib/measure";

// Transferidor de aviação, sem fundo: anel com marcas de 1° em 1°, médias a cada 5° e longas a
// cada 10°. Os números ficam por dentro do anel, escritos ao longo da borda; N, E, S e W e as
// direções intermediárias substituem os números onde caem. Uma marca "0°" fica no topo.
// 0° é o norte (em cima) e os graus crescem no sentido horário. O gume (linha de 0°) sai do
// centro para cima, e a seta sai do centro na direção do ponteiro, com o ângulo na ponta.
// Tudo é desenhado em pixels da tela: o transferidor tem o mesmo tamanho em qualquer zoom.
const R = 124;             // raio do anel (px)
const S = R + 26;          // metade da caixa do SVG (px); a marca do topo passa um pouco da borda
const NUMBER_R = R - 17;   // raio dos números de 10 em 10
const LETTER_R = R - 36;   // raio das letras de direção
const LABELS = Array.from({ length: 36 }, (_, i) => i * 10).filter((deg) => deg % 90 !== 0);
const CARDINALS = [{ deg: 0, text: "N" }, { deg: 90, text: "E" }, { deg: 180, text: "S" }, { deg: 270, text: "W" }];
const DIAGONALS = [{ deg: 45, text: "NE" }, { deg: 135, text: "SE" }, { deg: 225, text: "SW" }, { deg: 315, text: "NW" }];

// Ponto a `r` pixels do centro, na direção de `deg` (0° = norte, sentido horário). Y cresce para baixo na tela.
const polar = (deg, r) => ({ x: r * Math.sin(deg * (Math.PI / 180)), y: -r * Math.cos(deg * (Math.PI / 180)) });

// Todas as marcas num caminho só: é calculado uma vez, não a cada movimento do mouse.
const TICKS = (() => {
  let d = "";
  for (let deg = 0; deg < 360; deg += 1) {
    const len = deg % 10 === 0 ? 9 : deg % 5 === 0 ? 5 : 2.5;
    const outer = polar(deg, R);
    const inner = polar(deg, R - len);
    d += `M${outer.x.toFixed(2)} ${outer.y.toFixed(2)}L${inner.x.toFixed(2)} ${inner.y.toFixed(2)}`;
  }
  return d;
})();

// Texto ao longo da borda: a base do texto fica tangente ao anel, com o topo para fora.
function RingText({ deg, r, className, children }) {
  const at = polar(deg, r);
  return (
    <text
      className={className}
      transform={`translate(${at.x.toFixed(2)} ${at.y.toFixed(2)}) rotate(${deg})`}
      textAnchor="middle"
      dominantBaseline="middle"
    >
      {children}
    </text>
  );
}

// `center` é o centro fixo (pivot) ou, antes do primeiro clique, o próprio ponteiro.
// `cursor` e `pivot` juntos dão a seta; `text` é o ângulo mostrado na ponta.
// `declination` (graus, com sinal) põe uma segunda agulha em ângulo + desvio magnético.
export default function Protractor({ viewW, viewH, pivot, cursor, locked, text, declination }) {
  const center = pivot ?? cursor;
  if (!center) return null;
  const deg = pivot && cursor ? angleOf(pivot, cursor) : null;
  const tip = deg != null ? polar(deg, 1) : null;
  const declinationDeg = deg != null && declination != null ? addDeclination(deg, declination) : null;

  return (
    <div
      className="protractor"
      style={{ left: `${(center.x / viewW) * 100}%`, top: `${(center.y / viewH) * 100}%` }}
    >
      <svg
        className="protractor__svg"
        width={2 * S}
        height={2 * S}
        viewBox={`${-S} ${-S} ${2 * S} ${2 * S}`}
        style={{ left: -S, top: -S }}
        aria-hidden="true"
      >
        <circle className="protractor__ring" r={R} />
        <path className="protractor__ticks" d={TICKS} />
        <line className="protractor__axis" x1={0} y1={-R} x2={0} y2={R} />
        <line className="protractor__axis" x1={-R} y1={0} x2={R} y2={0} />
        <line className="protractor__gume" x1={0} y1={0} x2={0} y2={-R} />

        {LABELS.map((deg) => (
          <RingText key={deg} deg={deg} r={NUMBER_R} className="protractor__label">{deg}</RingText>
        ))}
        {CARDINALS.map((c) => (
          <RingText key={c.text} deg={c.deg} r={LETTER_R} className="protractor__cardinal">{c.text}</RingText>
        ))}
        {DIAGONALS.map((c) => (
          <RingText key={c.text} deg={c.deg} r={LETTER_R} className="protractor__diagonal">{c.text}</RingText>
        ))}

        <g className="protractor__tab">
          <rect x={-15} y={-R - 25} width={30} height={15} rx={3} />
          <text x={0} y={-R - 17.5} textAnchor="middle" dominantBaseline="middle">0°</text>
        </g>

        {deg != null && (
          // A seta é desenhada apontando para a direita; girar em (deg - 90) a põe na direção certa.
          <g transform={`rotate(${deg - 90})`} className={`protractor__arrow${locked ? "" : " is-live"}`}>
            <line x1={0} y1={0} x2={R - 8} y2={0} />
            <path d={`M${R} 0 L${R - 9} -4.5 L${R - 9} 4.5 Z`} />
          </g>
        )}
        {declinationDeg != null && (
          // Segunda agulha, do desvio magnético: mesma forma, em outra cor, no ângulo + desvio.
          <g transform={`rotate(${declinationDeg - 90})`} className={`protractor__arrow protractor__arrow--declination${locked ? "" : " is-live"}`}>
            <line x1={0} y1={0} x2={R - 8} y2={0} />
            <path d={`M${R} 0 L${R - 9} -4.5 L${R - 9} 4.5 Z`} />
          </g>
        )}
        <circle className="protractor__pivot" r={4} />
        <circle className="protractor__pivot-dot" r={1.3} />
      </svg>
      {text && tip && (
        <span
          className={`measure-layer__label${locked ? "" : " is-live"}`}
          style={{ left: tip.x * (R + 44), top: tip.y * (R + 44), transform: "translate(-50%, -50%)" }}
        >
          {text}
        </span>
      )}
    </div>
  );
}

// Campo do desvio magnético, logo à direita do botão do transferidor. Aceita número com sinal.
export function DeclinationInput({ value, onChange }) {
  const { t } = useTranslation();
  const invalid = value.trim() !== "" && parseDeclination(value) == null;
  return (
    <label className="declination" title={t("protractor.declinationTitle")}>
      <input
        type="text"
        inputMode="decimal"
        className="declination__input"
        aria-label={t("protractor.declination")}
        aria-invalid={invalid || undefined}
        placeholder={t("protractor.declinationPlaceholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="declination__unit" aria-hidden="true">°</span>
    </label>
  );
}

// Botão da barra de ferramentas que liga o transferidor. Mesmo jeito dos outros controles: ícone só.
export function ProtractorToggle({ enabled, onToggle }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="tool-toggle"
      aria-pressed={enabled}
      onClick={onToggle}
      aria-label={t("protractor.toggle")}
      title={t("protractor.title")}
    >
      {/* Transferidor de 360°: anel completo, marcas de 30° (longas) e de 10° (curtas), e uma agulha. */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 2.5v2.6M16.75 3.77l-1.3 2.25M20.23 7.25l-2.25 1.3M21.5 12h-2.6M20.23 16.75l-2.25-1.3M16.75 20.23l-1.3-2.25M12 21.5v-2.6M7.25 20.23l1.3-2.25M3.77 16.75l2.25-1.3M2.5 12h2.6M3.77 7.25l2.25 1.3M7.25 3.77l1.3 2.25" />
        <path d="M13.65 2.64l-.21 1.19M15.25 3.07l-.41 1.13M18.11 4.72l-.77.92M19.28 5.89l-.92.77M20.93 8.75l-1.13.41M21.36 10.35l-1.19.21M21.36 13.65l-1.19-.21M20.93 15.25l-1.13-.41M19.28 18.11l-.92-.77M18.11 19.28l-.77-.92M15.25 20.93l-.41-1.13M13.65 21.36l-.21-1.19M10.35 21.36l.21-1.19M8.75 20.93l.41-1.13M5.89 19.28l.77-.92M4.72 18.11l.92-.77M3.07 15.25l1.13-.41M2.64 13.65l1.19-.21M2.64 10.35l1.19.21M3.07 8.75l1.13.41M4.72 5.89l.92.77M5.89 4.72l.77.92M8.75 3.07l.41 1.13M10.35 2.64l.21 1.19" strokeWidth={0.9} />
        <path d="M12 12l4.4-4.4" />
        <path d="M12 12h.01" />
      </svg>
    </button>
  );
}
