import { useEffect, useRef, useState } from "react";
import MeasureLayer from "./MeasureLayer";

// Imagem com tamanho exato: encaixa na área (sem aumentar), e com zoom ocupa zoom × a largura da área.
// Com o tamanho conhecido, a camada de medição cobre a imagem com precisão, em qualquer zoom.
// `brightness` em porcentagem (100 = original). Só a imagem recebe o filtro; a medição fica por cima, intacta.
export default function ImageStage({ src, alt, zoom, brightness = 100, measure, onError }) {
  const boxRef = useRef(null);
  const [nat, setNat] = useState(null);
  const [area, setArea] = useState({ w: 0, h: 0 });

  // Mede a área que contém a imagem (o painel rolável) e acompanha o redimensionamento.
  useEffect(() => {
    const host = boxRef.current?.parentElement;
    if (!host) return undefined;
    const read = () => setArea({ w: host.clientWidth, h: host.clientHeight });
    read();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", read);
      return () => window.removeEventListener("resize", read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  let box = null;
  if (nat && area.w) {
    const fit = Math.min(1, area.w / nat.w, area.h ? area.h / nat.h : Infinity);
    const w = zoom > 1 ? area.w * zoom : nat.w * fit;
    box = { w, h: (w * nat.h) / nat.w };
  }

  return (
    <div
      ref={boxRef}
      className="measure-box"
      style={box ? { width: box.w, height: box.h } : { maxWidth: "100%", maxHeight: "100%", opacity: nat ? 1 : 0 }}
    >
      <img
        className="preview__media measure-box__img"
        src={src}
        alt={alt}
        draggable={false}
        style={{
          filter: `brightness(${brightness / 100})`,
          ...(box ? { width: "100%", height: "100%", maxWidth: "none", maxHeight: "none" } : null),
        }}
        onLoad={(e) => {
          const img = e.currentTarget;
          const size = { w: img.naturalWidth, h: img.naturalHeight };
          setNat(size);
        }}
        onError={onError}
      />
      {nat && measure && (
        <MeasureLayer
          surface="img"
          viewW={nat.w}
          viewH={nat.h}
          enabled={measure.enabled}
          lines={measure.lines}
          draft={measure.draft}
          protractor={measure.protractor}
          windAim={measure.windAim}
          format={measure.format("img")}
          onPoint={(p) => measure.onPoint("img", p)}
          onMove={(p) => measure.onMove("img", p)}
          onFinish={measure.onFinish}
          plotting={measure.plotting}
          plots={measure.plots}
          onPlot={(p) => measure.onPlot("img", p)}
          route={measure.routeOf("img")}
          windOn={measure.windOn}
          winds={measure.winds}
          windPending={measure.windPending}
          onWind={(p) => measure.onWind("img", p)}
          onWindSubmit={measure.onWindSubmit}
          onWindCancel={measure.onWindCancel}
          windUnit={measure.windUnit}
          windEdit={measure.windEdit}
          onRenamePlot={measure.onRenamePlot}
          onMovePlot={measure.onMovePlot}
          onDeletePlot={measure.onDeletePlot}
          onDeleteWind={measure.onDeleteWind}
        />
      )}
    </div>
  );
}
