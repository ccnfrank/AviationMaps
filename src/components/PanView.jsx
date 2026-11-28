import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { BRIGHTNESS_MAX, BRIGHTNESS_MIN, ZOOM_MAX, ZOOM_MIN, clamp } from "../lib/viewRange";

// Roda do mouse: quanto o zoom muda por pixel de rolagem. É multiplicativo, então cada marca
// aumenta ou diminui uma fração do zoom atual (100 px ≈ 16%).
const WHEEL_ZOOM_RATE = 0.0015;
// Option + roda: pontos de brilho por pixel de rolagem (100 px ≈ 10 pontos).
const WHEEL_BRIGHTNESS_RATE = 0.1;
// Firefox manda a rolagem em linhas, não em pixels.
const LINE_PX = 40;

const scrollPixels = (e) => (e.deltaMode === 1 ? e.deltaY * LINE_PX : e.deltaY);

// Área que rola nos dois sentidos. Com `grabbable`, o conteúdo pode ser arrastado com o
// mouse (o arrasto só mexe na rolagem). O conteúdo filho é centralizado com margin: auto,
// assim, quando é maior que a área, a borda esquerda e a de cima continuam alcançáveis.
//
// Com `onZoom` e `onBrightness`, a roda do mouse muda o zoom no ponto onde está o ponteiro,
// e Option (Alt) + roda muda o brilho. A tecla X centraliza o conteúdo de novo.
const PanView = forwardRef(function PanView(
  { children, grabbable = false, className = "", zoom, onZoom, brightness, onBrightness, active = true },
  ref,
) {
  const view = useRef(null);
  const drag = useRef(null);
  const [dragging, setDragging] = useState(false);
  // Último valor de cada prop, para os ouvintes nativos (registrados uma vez).
  const live = useRef({});
  // Ponto sob o mouse no instante do zoom: fração dentro do conteúdo e posição na tela.
  const anchor = useRef(null);

  useImperativeHandle(ref, () => view.current, []);

  useEffect(() => {
    live.current = { zoom, onZoom, brightness, onBrightness, active };
  });

  // Roda do mouse. Precisa ser nativo e não passivo: o React marca o `onWheel` como passivo,
  // e aí não dá para impedir a rolagem da própria área.
  useEffect(() => {
    const el = view.current;
    const onWheel = (e) => {
      const { zoom: z, onZoom: setZoom, brightness: b, onBrightness: setBrightness } = live.current;
      const dy = scrollPixels(e);
      if (!dy) return;
      if (e.altKey) {
        if (!setBrightness) return;
        e.preventDefault();
        const next = clamp(b - dy * WHEEL_BRIGHTNESS_RATE, BRIGHTNESS_MIN, BRIGHTNESS_MAX);
        if (next !== b) setBrightness(next);
        return;
      }
      if (!setZoom) return;
      e.preventDefault();
      const next = clamp(z * Math.exp(-dy * WHEEL_ZOOM_RATE), ZOOM_MIN, ZOOM_MAX);
      if (next === z) return;
      const content = el.firstElementChild;
      const r = content?.getBoundingClientRect();
      if (r?.width && r?.height) {
        anchor.current = {
          x: e.clientX,
          y: e.clientY,
          fx: (e.clientX - r.left) / r.width,
          fy: (e.clientY - r.top) / r.height,
        };
      }
      setZoom(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Depois que o zoom muda, rola para que o ponto que estava sob o mouse continue sob ele.
  useLayoutEffect(() => {
    const a = anchor.current;
    anchor.current = null;
    const el = view.current;
    const content = el?.firstElementChild;
    if (!a || !content) return;
    const r = content.getBoundingClientRect();
    el.scrollLeft += r.left + a.fx * r.width - a.x;
    el.scrollTop += r.top + a.fy * r.height - a.y;
  }, [zoom]);

  // X: centraliza o conteúdo na área, sem mudar o zoom. Sem campo em foco, e só no painel ativo.
  useEffect(() => {
    const onKey = (e) => {
      if (!live.current.active) return;
      if (e.key.toLowerCase() !== "x" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest?.("input, textarea, [contenteditable]")) return;
      const el = view.current;
      if (!el) return;
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
      el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onPointerDown = (e) => {
    if (!grabbable || e.button !== 0) return;
    const el = e.currentTarget;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture?.(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e) => {
    const start = drag.current;
    if (!start) return;
    const el = e.currentTarget;
    el.scrollLeft = start.left - (e.clientX - start.x);
    el.scrollTop = start.top - (e.clientY - start.y);
  };

  const stop = (e) => {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setDragging(false);
  };

  const classes = ["pan-view", grabbable && "pan-view--grab", dragging && "is-dragging", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={view}
      className={classes}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      {children}
    </div>
  );
});

export default PanView;
