import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MeasureLayer from "./MeasureLayer";

// jsdom não faz layout: o SVG ocupa uma área de 100 × 100 px na tela, e a superfície tem 200 × 200 unidades.
const setup = (props = {}) => {
  const handlers = { onPoint: vi.fn(), onMove: vi.fn(), onFinish: vi.fn() };
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

describe("MeasureLayer (cliques)", () => {
  it("clique converte para unidades da superfície", () => {
    const { svg, onPoint } = setup();
    fireEvent.pointerDown(svg, { clientX: 10, clientY: 20, button: 0 });
    expect(onPoint).toHaveBeenCalledWith({ x: 20, y: 40 });
  });

  it("movimento do ponteiro informa a posição ao vivo", () => {
    const { svg, onMove } = setup();
    fireEvent.pointerMove(svg, { clientX: 60, clientY: 30 });
    expect(onMove).toHaveBeenCalledWith({ x: 120, y: 60 });
  });

  it("clique direito e duplo clique concluem a medição", () => {
    const { svg, onFinish } = setup();
    fireEvent.contextMenu(svg);
    fireEvent.doubleClick(svg);
    expect(onFinish).toHaveBeenCalledTimes(2);
  });

  it("com a medição desligada, nada reage ao ponteiro", () => {
    const { svg, onPoint, onMove, onFinish } = setup({ enabled: false });
    fireEvent.pointerDown(svg, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(svg, { clientX: 80, clientY: 80 });
    fireEvent.contextMenu(svg);
    expect(onPoint).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("desenha só as linhas da própria superfície, com o texto de cada trecho", () => {
    const lines = [
      { id: "a", surface: "img", points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] },
      { id: "b", surface: "pdf:0", points: [{ x: 0, y: 0 }, { x: 90, y: 0 }] },
    ];
    const { container } = setup({ lines });
    expect(container.querySelectorAll("polyline.measure-layer__line")).toHaveLength(1);
    expect(container.querySelector(".measure-layer__label").textContent).toBe("50 px");
  });

  it("mostra a linha ao vivo até o ponteiro, com o texto do trecho ao vivo", () => {
    const draft = { surface: "img", points: [{ x: 0, y: 0 }], cursor: { x: 30, y: 40 } };
    const { container } = setup({ draft });
    const live = container.querySelector("polyline.is-live");
    expect(live).not.toBeNull();
    expect(container.querySelector(".measure-layer__label.is-live").textContent).toBe("50 px");
  });

  it("não desenha pontas nos extremos (sem bolinhas)", () => {
    const lines = [{ id: "a", surface: "img", points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] }];
    const { container } = setup({ lines });
    expect(container.querySelectorAll("circle")).toHaveLength(0);
  });
});
