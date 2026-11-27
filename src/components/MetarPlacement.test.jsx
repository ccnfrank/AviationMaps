import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MeasureLayer from "./MeasureLayer";

const station = {
  icao: "SBSP",
  raw: "METAR SBSP 270800Z AUTO 14006KT 9999 FEW022 BKN032 17/16 Q1021",
  fltCat: "VFR",
  wdir: 140,
  wspd: 6,
  cover: "BKN",
  clouds: [{ cover: "BKN", base: 3200 }],
};

// jsdom não faz layout: a camada ocupa 100 × 100 px na tela, e a superfície tem 200 × 200 unidades.
function setup(props = {}) {
  const handlers = { onPoint: vi.fn(), onMove: vi.fn(), onFinish: vi.fn(), onMetarPlace: vi.fn() };
  const { container } = render(
    <MeasureLayer
      surface="img"
      viewW={200}
      viewH={200}
      enabled
      lines={[]}
      draft={null}
      format={() => null}
      {...handlers}
      {...props}
    />,
  );
  const svg = container.querySelector("svg.measure-layer");
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
  return { svg, container, ...handlers };
}

describe("colocar a estação do METAR na camada", () => {
  it("com a colocação pendente, o clique põe a estação no ponto, sem começar medição", () => {
    const { svg, onMetarPlace, onPoint } = setup({ metarPlacing: true });
    fireEvent.pointerDown(svg, { clientX: 10, clientY: 20, button: 0 });
    expect(onMetarPlace).toHaveBeenCalledWith({ x: 20, y: 40 });
    expect(onPoint).not.toHaveBeenCalled();
  });

  it("sem colocação pendente, o clique segue como medição", () => {
    const { svg, onMetarPlace, onPoint } = setup({ metarPlacing: false });
    fireEvent.pointerDown(svg, { clientX: 10, clientY: 20, button: 0 });
    expect(onPoint).toHaveBeenCalledWith({ x: 20, y: 40 });
    expect(onMetarPlace).not.toHaveBeenCalled();
  });

  it("mostra só as estações da própria superfície (página do PDF ou imagem)", () => {
    const metars = [
      { id: "a", surface: "img", x: 10, y: 10, station },
      { id: "b", surface: "pdf:1", x: 30, y: 30, station },
    ];
    const { container } = setup({ metars });
    expect(container.querySelectorAll(".metar-station")).toHaveLength(1);
    expect(container.querySelector("[data-metar-id='a']")).toBeInTheDocument();
    expect(container.querySelector(".metar-callout")).toBeInTheDocument();
  });
});
