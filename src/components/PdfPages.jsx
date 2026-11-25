import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { loadPdfjs } from "../lib/media/pdfjs";
import PanView from "./PanView";
import MeasureLayer from "./MeasureLayer";

// Quantas páginas são desenhadas; PDFs maiores mostram só o começo, para não travar a aba.
const MAX_PAGES = 200;
// Maior lado de cada canvas em pixels reais. Acima disso o canvas fica pesado demais
// (memória da aba), então o zoom máximo é menos nítido, mas nunca some conteúdo.
const MAX_CANVAS_SIDE = 5000;
// Margem interna da área de páginas (px), descontada da largura de encaixe.
const VIEW_PADDING = 32;
// Tempo de espera depois da última mudança de zoom antes de redesenhar (ms).
const REDRAW_DELAY = 120;

// Desenha o PDF com pdf.js em canvas, página por página. Não depende do visualizador
// embutido do navegador. Cada página ocupa a largura da área vezes o zoom, e a área
// rola e arrasta nos dois sentidos quando o zoom passa de 100%.
// `measure` (opcional) liga a medição em cada página. `onZoom` e `onBrightness` recebem os valores
// da roda do mouse (ver PanView).
export default function PdfPages({ file, name, zoom = 1, brightness = 100, onZoom, onBrightness, measure }) {
  const { t } = useTranslation();
  const viewRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [status, setStatus] = useState("loading");
  const [sizes, setSizes] = useState([]); // [{ w, h }] em pontos, uma por página desenhada
  const [fit, setFit] = useState(0);      // largura de encaixe da área, em px

  // Abre o documento uma vez por arquivo.
  useEffect(() => {
    let alive = true;
    let task = null;
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
        const opened = await task.promise;
        if (!alive) {
          task.destroy();
          return;
        }
        setDoc(opened);
        setStatus("ready");
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
      task?.destroy();
    };
  }, [file]);

  // Tamanho de cada página (em pontos). Só lê a geometria, não desenha nada.
  useEffect(() => {
    if (!doc) return undefined;
    let alive = true;
    (async () => {
      const count = Math.min(doc.numPages, MAX_PAGES);
      const out = [];
      for (let i = 1; i <= count && alive; i += 1) {
        const page = await doc.getPage(i);
        const v = page.getViewport({ scale: 1 });
        out.push({ w: v.width, h: v.height });
      }
      if (alive) setSizes(out);
    })();
    return () => { alive = false; };
  }, [doc]);

  // Largura de encaixe: acompanha o tamanho da área (inclusive ao abrir a janela em outro tamanho).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return undefined;
    const read = () => setFit(Math.max(200, view.clientWidth - VIEW_PADDING));
    read();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", read);
      return () => window.removeEventListener("resize", read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(view);
    return () => ro.disconnect();
  }, [status]);

  const cssWidth = Math.max(200, fit) * zoom;

  return (
    <div className="pdf-pages">
      {status === "loading" && <p className="preview__note">{t("preview.loading")}</p>}
      {status === "error" && <p className="preview__note">{t("pdf.error")}</p>}
      {status === "ready" && doc.numPages > MAX_PAGES && (
        <p className="preview__note">{t("pdf.first", { max: MAX_PAGES, total: doc.numPages })}</p>
      )}
      <PanView
        ref={viewRef}
        grabbable
        className="pdf-pages__view"
        zoom={zoom}
        onZoom={onZoom}
        brightness={brightness}
        onBrightness={onBrightness}
      >
        <div className="pdf-pages__list">
          {sizes.map((size, i) => (
            <PdfPage
              key={i}
              doc={doc}
              index={i}
              name={name}
              cssWidth={cssWidth}
              size={size}
              brightness={brightness}
              measure={measure}
            />
          ))}
        </div>
      </PanView>
    </div>
  );
}

// Uma página: canvas redesenhado quando o zoom para, e a camada de medição por cima.
function PdfPage({ doc, index, name, cssWidth, size, brightness, measure }) {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const cssHeight = cssWidth * (size.h / size.w);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let alive = true;
    let task = null;
    const timer = setTimeout(async () => {
      try {
        const page = await doc.getPage(index + 1);
        if (!alive) return;
        const dpr = window.devicePixelRatio || 1;
        // Resolução real do canvas: a da tela, limitada para não estourar a memória.
        const pixelSide = Math.max(cssWidth * dpr, cssHeight * dpr);
        const shrink = Math.min(1, MAX_CANVAS_SIDE / pixelSide);
        const viewport = page.getViewport({ scale: (cssWidth * dpr * shrink) / size.w });
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        task = page.render({ canvasContext: canvas.getContext("2d"), viewport });
        await task.promise;
      } catch {
        // Redesenho cancelado por um zoom mais novo, ou página que não abriu: fica em branco.
      }
    }, REDRAW_DELAY);
    return () => {
      alive = false;
      clearTimeout(timer);
      task?.cancel();
    };
  }, [doc, index, cssWidth, cssHeight, size.w]);

  return (
    <div className="pdf-pages__cell" style={{ width: cssWidth, height: cssHeight }}>
      <canvas
        ref={canvasRef}
        className="pdf-pages__page"
        role="img"
        aria-label={t("pdf.page", { name, page: index + 1 })}
        style={{ width: cssWidth, height: cssHeight, filter: `brightness(${brightness / 100})` }}
      />
      {measure && (
        <MeasureLayer
          surface={`pdf:${index}`}
          viewW={size.w}
          viewH={size.h}
          enabled={measure.enabled}
          lines={measure.lines}
          draft={measure.draft}
          protractor={measure.protractor}
          windAim={measure.windAim}
          format={measure.format(`pdf:${index}`)}
          onPoint={(p) => measure.onPoint(`pdf:${index}`, p)}
          onMove={(p) => measure.onMove(`pdf:${index}`, p)}
          onFinish={measure.onFinish}
          plotting={measure.plotting}
          plots={measure.plots}
          onPlot={(p) => measure.onPlot(`pdf:${index}`, p)}
          route={measure.routeOf(`pdf:${index}`)}
          windOn={measure.windOn}
          winds={measure.winds}
          windPending={measure.windPending}
          onWind={(p) => measure.onWind(`pdf:${index}`, p)}
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
