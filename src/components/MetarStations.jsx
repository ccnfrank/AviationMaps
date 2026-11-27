import { barbGeometry, calloutSide, flightCategoryClass, skyFraction, skyPath, wrapRaw } from "../lib/metarStation";

// Tamanhos na tela, em pixels. A camada converte para unidades da superfície com `screenScale`, como as setas de vento,
// então o símbolo tem o mesmo tamanho na tela qualquer que seja o zoom.
const RING_PX = 7;
const STAFF_PX = 26;
const FEATHER_PX = 9;
const FEATHER_SPACE_PX = 3.5;
const HIT_PX = 12;

// Símbolo da estação no SVG: círculo, cobertura preenchida, haste e plumas do vento. A cor vem da categoria de voo.
// Option + clique numa estação apaga só ela (`onDelete` recebe o id). Sem Option, o clique não faz nada aqui.
export function MetarStations({ stations, screenScale, onDelete }) {
  const k = 1 / screenScale;
  return stations.map((m) => {
    const { station } = m;
    const ring = RING_PX * k;
    const fraction = skyFraction(station);
    const fill = skyPath(fraction, (RING_PX - 1.2) * k);
    const barb = barbGeometry(station.wdir, station.wspd, {
      start: ring,
      staff: STAFF_PX * k,
      feather: FEATHER_PX * k,
      space: FEATHER_SPACE_PX * k,
    });
    return (
      <g
        key={m.id}
        className={`metar-station metar-cat--${flightCategoryClass(station.fltCat)}`}
        data-metar-id={m.id}
        transform={`translate(${m.x} ${m.y})`}
        onPointerDown={(e) => {
          // A estação não começa medição nem arraste da área que rola.
          e.stopPropagation();
          if (e.button === 0 && e.altKey) onDelete?.(m.id);
        }}
      >
        <circle className="metar-station__hit" r={HIT_PX * k} />
        {barb && (
          <>
            <line className="metar-station__staff" x1={barb.staff.x1} y1={barb.staff.y1} x2={barb.staff.x2} y2={barb.staff.y2} />
            {barb.flags.map((pts, i) => (
              <polygon key={`flag-${i}`} className="metar-station__flag" points={pts.map((p) => `${p.x},${p.y}`).join(" ")} />
            ))}
            {barb.feathers.map((l, i) => (
              <line key={`feather-${i}`} className="metar-station__feather" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
            ))}
          </>
        )}
        {fraction >= 1 && <circle className="metar-station__sky" r={(RING_PX - 1.2) * k} />}
        {fill && <path className="metar-station__sky" d={fill} />}
        <circle className="metar-station__ring" r={ring} />
      </g>
    );
  });
}

// Texto original do METAR ao lado de cada estação, sem decodificar, em linhas curtas (ver wrapRaw).
// Fica na camada de rótulos, com a posição em porcentagem da superfície, como os outros rótulos.
// A caixa vai para o lado oposto à haste do vento (calloutSide), para não cobrir a haste.
export function MetarCallouts({ stations, viewW, viewH }) {
  return stations
    .filter((m) => m.station.raw)
    .map((m) => {
      const side = calloutSide(m.station.wdir, m.station.wspd);
      const dx = side.left ? "calc(-100% - 12px)" : "12px";
      const dy = side.up ? "calc(-100% - 6px)" : "6px";
      return (
        <span
          key={`callout-${m.id}`}
          className={`metar-callout metar-cat--${flightCategoryClass(m.station.fltCat)}`}
          style={{ left: `${(m.x / viewW) * 100}%`, top: `${(m.y / viewH) * 100}%`, transform: `translate(${dx}, ${dy})` }}
        >
          {wrapRaw(m.station.raw).join("\n")}
        </span>
      );
    });
}
