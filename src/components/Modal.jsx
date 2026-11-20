import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

// Janelas empilhadas: só a de cima reage ao Esc e ao Tab, então fechar a pré-visualização
// não fecha a lista por trás dela, e o foco não sai da janela de cima.
const stack = [];

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

// Janela sobreposta, renderizada fora da árvore da página. Fecha com Esc ou clique no fundo,
// trava a rolagem, prende o Tab dentro dela e devolve o foco ao elemento que a abriu.
export default function Modal({ label, onClose, className = "", children }) {
  const { t } = useTranslation();
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const token = {};
    stack.push(token);
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector(`[aria-label="${t("common.close")}"]`)?.focus();

    const onKey = (e) => {
      if (stack[stack.length - 1] !== token) return;
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      // Ciclo do foco: Tab no último volta ao primeiro, Shift+Tab no primeiro vai ao último.
      const items = [...panel.current.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(token), 1);
      document.body.style.overflow = previousOverflow;
      if (opener?.focus) opener.focus();
    };
  }, []);

  const onBackdropClick = (e) => {
    if (e.target === e.currentTarget) closeRef.current();
  };

  return createPortal(
    <div className="modal-backdrop" onClick={onBackdropClick}>
      <div ref={panel} className={`modal ${className}`.trim()} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
