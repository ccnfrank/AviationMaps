import { forwardRef, useRef, useState } from "react";

// Área que rola nos dois sentidos. Com `grabbable`, o conteúdo pode ser arrastado com o
// mouse (o arrasto só mexe na rolagem). O conteúdo filho é centralizado com margin: auto,
// assim, quando é maior que a área, a borda esquerda e a de cima continuam alcançáveis.
const PanView = forwardRef(function PanView({ children, grabbable = false, className = "" }, ref) {
  const drag = useRef(null);
  const [dragging, setDragging] = useState(false);

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
      ref={ref}
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
