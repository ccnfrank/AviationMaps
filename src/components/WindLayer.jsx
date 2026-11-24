import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "../lib/measure";
import { formatBearing } from "../lib/route";
import { fromKnots, parseTas, parseWind, toKnots, windArrow } from "../lib/wind";

// Setas de vento, dentro do SVG da camada de medição. `length` é o comprimento da seta, em unidades da superfície.
export function WindArrows({ winds, length }) {
  return winds.map((w) => {
    const arrow = windArrow({ x: w.x, y: w.y }, w.dir, length);
    // Haste fina, cabeça com o recorte e um pino no início: a seta lê como uma só, mesmo pequena.
    const head = [arrow.end, arrow.heads[0], arrow.notch, arrow.heads[1]].map((p) => `${p.x},${p.y}`).join(" ");
    return (
      <g key={w.id} className="wind-arrow" data-wind-id={w.id}>
        <line x1={arrow.start.x} y1={arrow.start.y} x2={arrow.end.x} y2={arrow.end.y} vectorEffect="non-scaling-stroke" />
        <polygon points={head} vectorEffect="non-scaling-stroke" />
        <circle cx={arrow.start.x} cy={arrow.start.y} r={2.5} vectorEffect="non-scaling-stroke" />
      </g>
    );
  });
}

// Velocidade e TAS embaixo de cada seta: "270° · 15 kt · TAS 120 kt". Fica abaixo da seta, centralizada no ponto.
// `unit` é a unidade mostrada ("kt" ou "kmh"); a seta guarda tudo em nós.
export function WindLabels({ winds, length, viewW, viewH, onEdit, unit = "kt" }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const unitText = t(unit === "kmh" ? "wind.kmh" : "wind.unit");
  const num = (kt) => {
    const v = fromKnots(kt, unit);
    return formatNumber(v, Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1, language);
  };
  return winds.map((w) => {
    const tas = w.tas != null ? ` · TAS ${num(w.tas)} ${unitText}` : "";
    return (
      <span
        key={w.id}
        className="wind-label"
        title={t("wind.editTitle")}
        style={{ left: `${(w.x / viewW) * 100}%`, top: `${((w.y + length * 0.6) / viewH) * 100}%` }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEdit?.(w.id);
        }}
      >
        {`${formatBearing(w.dir)} · ${num(w.speed)} ${unitText}${tas}`}
      </span>
    );
  });
}

// Entrada da direção, da velocidade e da TAS, no ponto clicado (ou para corrigir uma seta). Enter confirma, Esc cancela.
// Os cliques dentro do formulário não chegam à área que rola, então o campo não arrasta a imagem.
// Número para o campo: sem casas decimais se for inteiro, senão com uma casa.
const fieldNumber = (v) => (Number.isInteger(Math.round(v * 10) / 10) ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1));

// `unit` é a unidade dos campos ("kt" ou "kmh"); a seta guarda sempre em nós. `onUnit` troca a unidade e os
// campos já digitados são convertidos, para o valor continuar o mesmo.
// O botão de referência marca o vento como magnético; sem ele, o vento é verdadeiro.
// `initial` ({ dir, speed, tas em nós, magnetic }) preenche o formulário para corrigir uma seta existente.
// A TAS é de cada vento: é opcional, e sem ela o trecho que usa este vento pede a TAS na rota.
export function WindForm({ x, y, viewW, viewH, unit = "kt", onUnit, initial = null, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [dir, setDir] = useState(initial ? fieldNumber(initial.dir) : "");
  const [speed, setSpeed] = useState(initial ? fieldNumber(fromKnots(initial.speed, unit)) : "");
  const [tas, setTas] = useState(initial?.tas != null ? fieldNumber(fromKnots(initial.tas, unit)) : "");
  const [magnetic, setMagnetic] = useState(Boolean(initial?.magnetic));
  const dirRef = useRef(null);
  useEffect(() => {
    dirRef.current?.focus();
  }, []);

  const parsed = parseWind(dir, speed);
  const tasKnots = parseTas(tas, unit);
  const tasInvalid = tas.trim() !== "" && tasKnots == null;
  const submit = (e) => {
    e.preventDefault();
    if (parsed && !tasInvalid) onSubmit({ dir: parsed.dir, speed: toKnots(parsed.speed, unit), magnetic, tas: tasKnots });
  };
  // Troca a unidade e converte o que já foi digitado na velocidade e na TAS.
  const switchUnit = () => {
    const next = unit === "kt" ? "kmh" : "kt";
    const convert = (text) => {
      const v = Number(text.trim().replace(",", "."));
      if (text.trim() === "" || !Number.isFinite(v)) return text;
      return fieldNumber(fromKnots(toKnots(v, unit), next));
    };
    setSpeed(convert(speed));
    setTas(convert(tas));
    onUnit?.();
  };
  const unitText = t(unit === "kmh" ? "wind.kmh" : "wind.unit");
  // Esc cancela sem chegar aos atalhos da janela; o formulário não deixa o evento subir.
  const onKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <form
      className="wind-form"
      style={{ left: `${(x / viewW) * 100}%`, top: `${(y / viewH) * 100}%` }}
      onSubmit={submit}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={onKeyDown}
    >
      <label className="wind-form__field">
        <span className="wind-form__name">{t("wind.direction")}</span>
        <input
          ref={dirRef}
          className="wind-form__input"
          type="number"
          inputMode="decimal"
          min="0"
          max="360"
          step="1"
          placeholder="0–360"
          aria-label={t("wind.directionAria")}
          value={dir}
          onChange={(e) => setDir(e.target.value)}
        />
        <span className="wind-form__unit">°</span>
      </label>
      <label className="wind-form__field">
        <span className="wind-form__name">{t("wind.speed")}</span>
        <input
          className="wind-form__input"
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          aria-label={t("wind.speedAria")}
          value={speed}
          onChange={(e) => setSpeed(e.target.value)}
        />
        <span className="wind-form__unit">{unitText}</span>
      </label>
      <label className="wind-form__field">
        <span className="wind-form__name">TAS</span>
        <input
          className="wind-form__input"
          type="text"
          inputMode="decimal"
          aria-label={t("wind.tasAria")}
          aria-invalid={tasInvalid || undefined}
          placeholder="TAS"
          value={tas}
          onChange={(e) => setTas(e.target.value)}
        />
        <span className="wind-form__unit">{unitText}</span>
      </label>
      <button
        type="button"
        className="wind-form__ref"
        onClick={switchUnit}
        aria-label={t("wind.unitAria")}
        title={t("wind.unitAria")}
      >
        {unitText}
      </button>
      <button
        type="button"
        className="wind-form__ref"
        aria-pressed={magnetic}
        onClick={() => setMagnetic((m) => !m)}
        aria-label={t("wind.magneticAria")}
        title={t("wind.magneticAria")}
      >
        {magnetic ? "°M" : "°V"}
      </button>
      <button type="submit" className="wind-form__btn" disabled={!parsed || tasInvalid} aria-label={t("wind.add")} title={t("wind.add")}>
        <Check strokeWidth={2} aria-hidden="true" />
      </button>
      <button type="button" className="wind-form__btn" onClick={onCancel} aria-label={t("common.cancel")} title={t("common.cancel")}>
        <X strokeWidth={2} aria-hidden="true" />
      </button>
    </form>
  );
}

// Avião de topo, com o nariz para cima (norte). Desenhado numa caixa de 24 unidades, centrada na origem.
const PLANE_D = "M0,-12 C0.9,-12 1.6,-10.5 1.6,-9 L1.6,-2 L11,2 L11,4 L1.6,2.2 L1.6,8 L4.5,10.3 L4.5,11.8 L0,11 L-4.5,11.8 L-4.5,10.3 L-1.6,8 L-1.6,2.2 L-11,4 L-11,2 L-1.6,-2 L-1.6,-9 C-1.6,-10.5 -0.9,-12 0,-12 Z";
// Tamanho do avião na tela, em pixels, e comprimento da linha da proa (tracejada) a partir do avião.
const PLANE_PX = 30;
const HEADING_PX = 56;

// Ponto da reta A→B mais perto de `p` (projeção, limitada ao trecho).
export function projectOnSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { x: a.x + dx * t, y: a.y + dy * t };
}

// Posição e direção do avião de um trecho: fica no ponto da linha mais perto da âncora (o vento, ou o meio do trecho).
function planeOf(link) {
  const p = projectOnSegment(link.anchor, link.from, link.to);
  return { p, rad: (link.heading * Math.PI) / 180 };
}

// Aviõezinhos sobre os trechos. O nariz aponta para a proa (com a declinação, se houver), e uma linha tracejada
// sai dele na mesma direção. `screenScale` (pixels da tela por unidade da superfície) mantém os tamanhos na tela.
export function RoutePlanes({ links, screenScale }) {
  return links
    .filter((l) => l.heading != null && l.anchor)
    .map((l) => {
      const { p, rad } = planeOf(l);
      const scale = PLANE_PX / screenScale / 24;
      const len = HEADING_PX / screenScale;
      return (
        <g key={`plane-${l.key}`} className="route-plane-group">
          <line
            className="route-heading"
            x1={p.x}
            y1={p.y}
            x2={p.x + Math.sin(rad) * len}
            y2={p.y - Math.cos(rad) * len}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="route-plane"
            d={PLANE_D}
            vectorEffect="non-scaling-stroke"
            transform={`translate(${p.x} ${p.y}) rotate(${l.heading}) scale(${scale})`}
          />
        </g>
      );
    });
}

// O grau que o nariz aponta, na ponta da linha da proa.
export function NoseLabels({ links, viewW, viewH, screenScale }) {
  return links
    .filter((l) => l.heading != null && l.anchor)
    .map((l) => {
      const { p, rad } = planeOf(l);
      const d = (HEADING_PX + 10) / screenScale;
      const x = p.x + Math.sin(rad) * d;
      const y = p.y - Math.cos(rad) * d;
      return (
        <span key={`nose-${l.key}`} className="nose-label" style={{ left: `${(x / viewW) * 100}%`, top: `${(y / viewH) * 100}%` }}>
          {formatBearing(l.heading)}
        </span>
      );
    });
}

