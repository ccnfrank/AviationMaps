import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { segmentsOf } from "../lib/measure";
import { parseBearing } from "../lib/route";
import { WIND_ARROW_PX } from "../lib/wind";
import Protractor from "./Protractor";
import { NoseLabels, RoutePlanes, WindArrows, WindForm, WindLabels } from "./WindLayer";

// Camada de medição sobre uma superfície (imagem inteira ou uma página de PDF).
// Cada clique fixa um ponto; a linha ao vivo segue o ponteiro até o próximo clique, e o texto
// de cada trecho mostra o comprimento na unidade escolhida. Esc, clique direito ou duplo clique
// concluem a medição. Com `enabled` desligado, a camada não recebe ponteiro e a área rola.
// Com `plotting`, cada clique só marca um ponto numerado (`onPlot`); a medição fica de lado.
// `plots` são todos os pontos plotados ({ id, surface, x, y }); a camada mostra os desta superfície.
// Com `windOn`, cada clique abre a entrada de vento no ponto (`onWind`); `windPending` é o ponto
// aguardando a direção e a velocidade, e `winds` são as setas já marcadas ({ id, surface, x, y, dir, speed }).
export default function MeasureLayer({
  surface, viewW, viewH, enabled, lines, draft, protractor, onPoint, onMove, onFinish, format,
  plotting = false, plots = [], onPlot, route = [],
  windOn = false, winds = [], windPending = null, onWind, onWindSubmit, onWindCancel, windUnit = "kt",
  windEdit = null, onRenamePlot,
}) {
  const svgRef = useRef(null);
  const mine = lines.filter((l) => l.surface === surface);
  // Numeração global, na ordem em que os pontos foram plotados; a camada mostra só os desta superfície.
  const myPlots = plots.map((p, i) => ({ ...p, n: i + 1 })).filter((p) => p.surface === surface);
  // Vento: só as setas desta superfície. O comprimento é medido na tela, para a seta não crescer com o zoom.
  const myWinds = winds.filter((w) => w.surface === surface);
  const pending = windPending && windPending.surface === surface ? windPending : null;
  // Correção de uma seta existente (duplo clique): o formulário abre na seta, com os valores atuais.
  const editing = windEdit?.id ? myWinds.find((w) => w.id === windEdit.id) : null;
  // Pixels da tela por unidade da superfície: a seta mede WIND_ARROW_PX na tela, qualquer que seja o zoom.
  const [screenScale, setScreenScale] = useState(1);
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const read = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setScreenScale(w / viewW);
    };
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewW]);
  const windLength = WIND_ARROW_PX / screenScale;
  const live = draft && draft.surface === surface ? draft : null;
  // Transferidor: só desenha na superfície onde ele está.
  const angle = protractor && protractor.surface === surface ? protractor : null;

  const toView = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * viewW,
      y: ((e.clientY - r.top) / r.height) * viewH,
    };
  };

  const onDown = (e) => {
    if (!enabled || e.button !== 0) return;
    // Sem isto, o clique também começaria o arraste que rola a área.
    e.stopPropagation();
    if (windOn) {
      // Clicar numa seta não cria ponto: o duplo clique é que abre a correção.
      if (e.target.closest?.(".wind-arrow")) return;
      onWind?.(toView(e));
      return;
    }
    if (plotting) {
      onPlot?.(toView(e));
      return;
    }
    onPoint(toView(e));
  };
  const onPointerMove = (e) => {
    if (enabled && !plotting && !windOn) onMove(toView(e));
  };
  const finishFrom = (e) => {
    if (windOn && e.type === "dblclick") {
      const arrow = e.target.closest?.(".wind-arrow");
      if (arrow && windEdit?.onEdit) {
        e.preventDefault();
        e.stopPropagation();
        windEdit.onEdit(arrow.dataset.windId);
      }
      return;
    }
    if (!enabled || plotting || windOn) return;
    e.preventDefault();
    e.stopPropagation();
    onFinish();
  };

  // Trechos já confirmados (com texto) e, para a medição em andamento, o trecho ao vivo.
  // `format` devolve null quando a superfície não tem escala: então o trecho fica sem rótulo.
  const labelsOf = (points, key, live = false) => {
    const segs = segmentsOf(points);
    return segs.map((s, i) => {
      const text = format(s.px);
      return text == null ? null : (
        <Label key={`${key}-${i}`} x={(s.x1 + s.x2) / 2} y={(s.y1 + s.y2) / 2} viewW={viewW} viewH={viewH} text={text} live={live} />
      );
    });
  };
  // Trecho ao vivo só aparece com comprimento real: logo após um clique ele tem zero de tamanho.
  const liveSeg = live && live.cursor ? segmentsOf([live.points[live.points.length - 1], live.cursor])[0] : null;
  const liveSegment = liveSeg && liveSeg.px >= 0.5 ? liveSeg : null;
  const liveText = liveSegment ? format(liveSegment.px) : null;

  return (
    <>
      <svg
        ref={svgRef}
        className={`measure-layer${enabled ? " is-active" : ""}`}
        viewBox={`0 0 ${viewW} ${viewH}`}
        preserveAspectRatio="none"
        onPointerDown={onDown}
        onPointerMove={onPointerMove}
        onContextMenu={finishFrom}
        onDoubleClick={finishFrom}
        aria-hidden="true"
      >
        {mine.map((l) => (
          <Path key={l.id} points={l.points} />
        ))}
        {live && <Path points={live.points} />}
        {route.map((l) => (
          <line
            key={l.key}
            className="route-line"
            x1={l.from.x}
            y1={l.from.y}
            x2={l.to.x}
            y2={l.to.y}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {liveSegment && <Path points={[live.points[live.points.length - 1], live.cursor]} live />}
        <WindArrows winds={myWinds} length={windLength} />
        <RoutePlanes links={route} screenScale={screenScale} />
      </svg>
      <div className="measure-layer__labels" aria-hidden="true">
        {mine.map((l) => labelsOf(l.points, l.id))}
        {live && labelsOf(live.points, "draft")}
        {route.map((l) => <RouteLabels key={l.key} link={l} viewW={viewW} viewH={viewH} />)}
        <WindLabels winds={myWinds} length={windLength} viewW={viewW} viewH={viewH} onEdit={windEdit?.onEdit} />
        <NoseLabels links={route} viewW={viewW} viewH={viewH} screenScale={screenScale} />
        {pending && (
          <span className="wind-pending" style={{ left: `${(pending.x / viewW) * 100}%`, top: `${(pending.y / viewH) * 100}%` }} />
        )}
        {myPlots.map((p) => (
          <PlotMarker
            key={p.id}
            plot={p}
            style={{ left: `${(p.x / viewW) * 100}%`, top: `${(p.y / viewH) * 100}%` }}
            onRename={onRenamePlot}
          />
        ))}
        {angle && (
          <Protractor
            viewW={viewW}
            viewH={viewH}
            pivot={angle.pivot}
            cursor={angle.cursor}
            locked={angle.locked}
            text={angle.text}
            declination={angle.declination}
          />
        )}
        {liveSegment && liveText != null && (
          <Label
            x={(liveSegment.x1 + liveSegment.x2) / 2}
            y={(liveSegment.y1 + liveSegment.y2) / 2}
            viewW={viewW}
            viewH={viewH}
            text={liveText}
            live
          />
        )}
      </div>
      {editing && (
        <WindForm
          key={`edit-${editing.id}`}
          x={editing.x}
          y={editing.y}
          viewW={viewW}
          viewH={viewH}
          unit={windUnit}
          initial={editing}
          tas={windEdit.tas}
          onTas={windEdit.onTas}
          onSubmit={windEdit.onSubmit}
          onCancel={windEdit.onCancel}
        />
      )}
      {pending && (
        <WindForm
          key={`${pending.x}-${pending.y}`}
          x={pending.x}
          y={pending.y}
          viewW={viewW}
          viewH={viewH}
          unit={windUnit}
          onSubmit={onWindSubmit}
          onCancel={onWindCancel}
        />
      )}
    </>
  );
}

// Folga entre a borda do rótulo e a linha, em pixels da tela.
const ROUTE_GAP_PX = 6;

// Rótulos de um trecho da rota: o rumo acima da linha e a distância abaixo, no meio do trecho.
// O deslocamento segue a normal da linha, então os rótulos ficam de cada lado em qualquer direção.
function RouteLabels({ link, viewW, viewH }) {
  const { from, to } = link;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  // Normal que aponta para cima (y menor); numa linha quase horizontal, para a esquerda.
  let nx = -dy / len;
  let ny = dx / len;
  if (ny > 1e-9 || (Math.abs(ny) <= 1e-9 && nx > 0)) {
    nx = -nx;
    ny = -ny;
  }
  // Afastamento até o centro do rótulo: metade da caixa projetada na normal (caixa larga numa linha
  // inclinada ocupa mais do lado da normal), mais a folga. Assim o rótulo nunca cobre a linha.
  const clearance = (text) => (Math.abs(nx) * (text.length * 5.4 + 14)) / 2 + Math.abs(ny) * 7 + ROUTE_GAP_PX;
  const place = (side, text) => {
    const d = clearance(text);
    return {
      left: `${(((from.x + to.x) / 2) / viewW) * 100}%`,
      top: `${(((from.y + to.y) / 2) / viewH) * 100}%`,
      "--ox": `${side * nx * d}px`,
      "--oy": `${side * ny * d}px`,
    };
  };
  return (
    <>
      <TrackLabel link={link} style={place(1, link.trackText)} />
      {link.distance && (
        <span className="route-label route-label--dist" style={place(-1, link.distance)}>{link.distance}</span>
      )}
    </>
  );
}

function Path({ points, live = false }) {
  if (points.length < 2) return null;
  const d = points.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <polyline
      points={d}
      fill="none"
      className={`measure-layer__line${live ? " is-live" : ""}`}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function Label({ x, y, viewW, viewH, text, live = false }) {
  return (
    <span
      className={`measure-layer__label${live ? " is-live" : ""}`}
      style={{ left: `${(x / viewW) * 100}%`, top: `${(y / viewH) * 100}%` }}
    >
      {text}
    </span>
  );
}

// Rótulo do rumo: o duplo clique abre o campo para corrigir o rumo do trecho. Enter confirma, Esc cancela.
function TrackLabel({ link, style }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  // O clique no rótulo não pode começar o arraste da área que rola.
  const stop = (e) => e.stopPropagation();
  if (editing) {
    return (
      <input
        className="route-edit"
        style={style}
        autoFocus
        inputMode="decimal"
        aria-label={t("route.editTrack")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onPointerDown={stop}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") setEditing(false);
          if (e.key === "Enter") {
            const deg = parseBearing(value);
            if (deg != null) link.onTrack(deg);
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <span
      className="route-label route-label--track"
      style={style}
      title={t("route.editTitle")}
      onPointerDown={stop}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setValue(String(Math.round(link.track)));
        setEditing(true);
      }}
    >
      {link.trackText}
    </span>
  );
}

// Marcador de um ponto plotado. O duplo clique abre o nome para editar: Enter confirma, Esc cancela.
// Nome vazio volta ao número do ponto.
function PlotMarker({ plot, style, onRename }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const stop = (e) => e.stopPropagation();
  if (editing) {
    return (
      <input
        className="plot-edit"
        style={style}
        autoFocus
        maxLength={8}
        aria-label={t("points.renameAria")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onPointerDown={stop}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") setEditing(false);
          if (e.key === "Enter") {
            onRename?.(plot.id, value.trim());
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <span
      className="plot-marker"
      style={style}
      title={t("points.renameTitle")}
      onPointerDown={stop}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setValue(plot.name ?? String(plot.n));
        setEditing(true);
      }}
    >
      {plot.name ?? plot.n}
    </span>
  );
}
