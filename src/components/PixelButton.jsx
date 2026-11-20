import { useEffect, useRef } from "react";

const CELL = 6;
const GAP = 3;
const STEP = CELL + GAP;
const GLOW_RADIUS = 96;
const RIPPLE_MS = 650;
const RGB = "255, 255, 255"; // pixels claros sobre o botão violeta

// Botão com uma malha de pixels no canvas: acende perto do ponteiro e emite
// uma onda ao clicar. Sem movimento quando o sistema pede redução de movimento.
export default function PixelButton({ children, onClick, className = "", ...rest }) {
  const btnRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const btn = btnRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.("2d");
    if (!btn || !ctx) return undefined;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const s = {
      w: 0, h: 0, cols: 0, rows: 0,
      x: 0, y: 0, hover: false,
      rx: 0, ry: 0, ripple: -1e9,
      raf: 0,
    };

    const size = () => {
      const dpr = window.devicePixelRatio || 1;
      s.w = btn.clientWidth;
      s.h = btn.clientHeight;
      canvas.width = s.w * dpr;
      canvas.height = s.h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.cols = Math.ceil((s.w + GAP) / STEP);
      s.rows = Math.ceil((s.h + GAP) / STEP);
      draw(performance.now());
    };

    const draw = (now) => {
      ctx.clearRect(0, 0, s.w, s.h);
      const ox = (s.w - (s.cols * STEP - GAP)) / 2;
      const oy = (s.h - (s.rows * STEP - GAP)) / 2;
      const age = now - s.ripple;
      const rippleOn = age < RIPPLE_MS;
      const rippleR = (age / RIPPLE_MS) * Math.hypot(s.w, s.h);
      for (let r = 0; r < s.rows; r++) {
        for (let c = 0; c < s.cols; c++) {
          const cx = ox + c * STEP + CELL / 2;
          const cy = oy + r * STEP + CELL / 2;
          let a = 0.1;
          if (s.hover) {
            const d = Math.hypot(cx - s.x, cy - s.y);
            a = Math.max(a, Math.max(0, 1 - d / GLOW_RADIUS) * 0.55);
          }
          if (rippleOn) {
            const dr = Math.abs(Math.hypot(cx - s.rx, cy - s.ry) - rippleR);
            a = Math.max(a, Math.max(0, 1 - dr / 18));
          }
          ctx.fillStyle = `rgba(${RGB}, ${a.toFixed(3)})`;
          ctx.fillRect(ox + c * STEP, oy + r * STEP, CELL, CELL);
        }
      }
    };

    const frame = (now) => {
      draw(now);
      const busy = s.hover || now - s.ripple < RIPPLE_MS;
      s.raf = busy ? requestAnimationFrame(frame) : 0;
    };
    const kick = () => {
      if (!s.raf && !reduce) s.raf = requestAnimationFrame(frame);
    };

    const onEnter = (e) => {
      if (reduce) return;
      s.hover = true;
      const r = btn.getBoundingClientRect();
      s.x = e.clientX - r.left;
      s.y = e.clientY - r.top;
      kick();
    };
    const onMove = (e) => {
      if (reduce) return;
      const r = btn.getBoundingClientRect();
      s.x = e.clientX - r.left;
      s.y = e.clientY - r.top;
    };
    const onLeave = () => {
      s.hover = false;
      kick();
    };
    const onDown = (e) => {
      if (reduce) return;
      const r = btn.getBoundingClientRect();
      s.rx = e.clientX - r.left;
      s.ry = e.clientY - r.top;
      s.ripple = performance.now();
      kick();
    };

    size();
    window.addEventListener("resize", size);
    btn.addEventListener("pointerenter", onEnter);
    btn.addEventListener("pointermove", onMove);
    btn.addEventListener("pointerleave", onLeave);
    btn.addEventListener("pointerdown", onDown);
    return () => {
      cancelAnimationFrame(s.raf);
      window.removeEventListener("resize", size);
      btn.removeEventListener("pointerenter", onEnter);
      btn.removeEventListener("pointermove", onMove);
      btn.removeEventListener("pointerleave", onLeave);
      btn.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return (
    <button ref={btnRef} type="button" className={`pixel-btn ${className}`.trim()} onClick={onClick} {...rest}>
      <canvas ref={canvasRef} className="pixel-btn__canvas" aria-hidden="true" />
      <span className="pixel-btn__label">{children}</span>
    </button>
  );
}
