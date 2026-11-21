import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MeasureLayer from "./MeasureLayer";
import Preview from "./Preview";

// jsdom não faz layout: o SVG ocupa uma área de 100 × 100 px, e a superfície tem 200 × 200 unidades.
const setupLayer = (props = {}) => {
  const handlers = { onPoint: vi.fn(), onMove: vi.fn(), onFinish: vi.fn(), onPlot: vi.fn() };
  const { container } = render(
    <MeasureLayer
      surface="img"
      viewW={200}
      viewH={200}
      enabled
      lines={[]}
      draft={null}
      format={(px) => `${Math.round(px)} px`}
      {...handlers}
      {...props}
    />,
  );
  const svg = container.querySelector("svg");
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
  return { svg, container, ...handlers };
};

describe("plotar pontos na camada", () => {
  it("com plotar ligado, o clique marca um ponto e não começa medição", () => {
    const { svg, onPlot, onPoint } = setupLayer({ plotting: true });
    fireEvent.pointerDown(svg, { clientX: 10, clientY: 20, button: 0 });
    expect(onPlot).toHaveBeenCalledWith({ x: 20, y: 40 });
    expect(onPoint).not.toHaveBeenCalled();
  });

  it("ao plotar, o movimento do ponteiro não alimenta a medição", () => {
    const { svg, onMove } = setupLayer({ plotting: true });
    fireEvent.pointerMove(svg, { clientX: 60, clientY: 30 });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("duplo clique e clique direito não concluem nada ao plotar", () => {
    const { svg, onFinish } = setupLayer({ plotting: true });
    fireEvent.doubleClick(svg);
    fireEvent.contextMenu(svg);
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("mostra só os pontos desta superfície, numerados na ordem em que foram plotados", () => {
    const plots = [
      { id: "a", surface: "pdf:0", x: 10, y: 10 },
      { id: "b", surface: "img", x: 50, y: 100 },
      { id: "c", surface: "img", x: 100, y: 150 },
    ];
    const { container } = setupLayer({ plots });
    const markers = container.querySelectorAll(".plot-marker");
    expect(Array.from(markers).map((m) => m.textContent)).toEqual(["2", "3"]);
    expect(markers[0].style.left).toBe("25%");
    expect(markers[0].style.top).toBe("50%");
  });
});

describe("botão de plotar na barra da visualização", () => {
  const entry = { name: "capa.png", size: 10, file: new File(["x"], "capa.png") };
  const nav = { hasPrev: false, hasNext: false, onPrev: () => {}, onNext: () => {}, onClose: () => {} };

  it("fica à direita do campo de escala", () => {
    render(<Preview entry={entry} {...nav} />);
    const scale = screen.getByRole("textbox", { name: "Map scale" });
    const plot = screen.getByRole("button", { name: "Plot points" });
    expect(scale.compareDocumentPosition(plot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("liga exclusivo com a medição", () => {
    render(<Preview entry={entry} {...nav} />);
    const plot = screen.getByRole("button", { name: "Plot points" });
    const measure = screen.getByRole("button", { name: "Measure" });
    fireEvent.click(measure);
    expect(measure).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(plot);
    expect(plot).toHaveAttribute("aria-pressed", "true");
    expect(measure).toHaveAttribute("aria-pressed", "false");
  });
});
