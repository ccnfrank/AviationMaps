import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// Menor largura de cada painel do split maps, em px. Abaixo disso o mapa e a barra de ferramentas não cabem.
const MIN_PANE_PX = 200;
// Quanto cada seta do teclado move a divisão (fração da área dos dois painéis).
const STEP = 0.05;

// Linha entre os dois painéis do split maps. Arrastar a linha muda a largura: o painel de um lado cresce
// e o do outro diminui. Com o teclado, as setas fazem o mesmo; duplo clique volta ao meio.
// `ratio` é a fração da área dos dois painéis que cabe ao da esquerda; `onRatio` recebe o novo valor.
// Os painéis são os irmãos vizinhos da linha, e a área é medida pela borda de fora deles.
export default function SplitDivider({ ratio, onRatio }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const stopDrag = useRef(null);  // desliga os ouvintes do arrasto em andamento
  const [dragging, setDragging] = useState(false);

  // Cada painel fica com pelo menos MIN_PANE_PX; se a área for pequena, a divisão fica no meio.
  const clamp = (value, width) => {
    const min = Math.min(0.5, MIN_PANE_PX / width);
    return Math.min(1 - min, Math.max(min, value));
  };

  // Borda esquerda e largura da área dos dois painéis. Sem medida (área zerada), null.
  const area = () => {
    const left = ref.current?.previousElementSibling?.getBoundingClientRect();
    const right = ref.current?.nextElementSibling?.getBoundingClientRect();
    if (!left || !right) return null;
    const width = right.right - left.left;
    return width > 0 ? { left: left.left, width } : null;
  };

  // Ao arrastar, os ouvintes ficam na janela: o ponteiro pode sair da linha e a divisão continua.
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    const measured = area();
    if (!measured) return;
    e.preventDefault(); // não seleciona texto enquanto arrasta
    const move = (ev) => onRatio(clamp((ev.clientX - measured.left) / measured.width, measured.width));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      stopDrag.current = null;
      setDragging(false);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    stopDrag.current = up;
    setDragging(true);
  };

  // Se a linha sair da tela no meio do arrasto, os ouvintes não ficam para trás.
  useEffect(() => () => stopDrag.current?.(), []);

  const onKeyDown = (e) => {
    const dir = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!dir) return;
    e.preventDefault();
    const measured = area();
    if (measured) onRatio(clamp(ratio + dir * STEP, measured.width));
  };

  return (
    <div
      ref={ref}
      className={`viewer-divider${dragging ? " is-dragging" : ""}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={t("split.resize")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      title={t("split.resize")}
      tabIndex={0}
      onMouseDown={onMouseDown}
      onDoubleClick={() => onRatio(0.5)}
      onKeyDown={onKeyDown}
    />
  );
}
