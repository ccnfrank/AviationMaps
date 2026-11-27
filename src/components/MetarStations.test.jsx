import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MetarCallouts, MetarStations } from "./MetarStations";

const RAW = "METAR SBSP 270800Z AUTO 14006KT 9999 FEW022 BKN032 17/16 Q1021";
const station = {
  icao: "SBSP",
  raw: RAW,
  fltCat: "VFR",
  wdir: 140,
  wspd: 6,
  cover: "BKN",
  clouds: [{ cover: "FEW", base: 2200 }, { cover: "BKN", base: 3200 }],
};
const placed = { id: "m1", surface: "img", x: 50, y: 60, station };

describe("símbolo da estação", () => {
  it("fica no ponto, na cor da categoria de voo, com haste e cobertura", () => {
    const { container } = render(
      <svg>
        <MetarStations stations={[placed]} screenScale={1} />
      </svg>,
    );
    const group = container.querySelector("[data-metar-id='m1']");
    expect(group).toHaveClass("metar-station", "metar-cat--vfr");
    expect(group).toHaveAttribute("transform", "translate(50 60)");
    expect(container.querySelector(".metar-station__staff")).toBeInTheDocument();
    expect(container.querySelector(".metar-station__sky")).toBeInTheDocument();
  });

  it("vento variável não desenha haste", () => {
    const { container } = render(
      <svg>
        <MetarStations stations={[{ ...placed, station: { ...station, wdir: "VRB", wspd: 0 } }]} screenScale={1} />
      </svg>,
    );
    expect(container.querySelector(".metar-station__staff")).toBeNull();
  });

  it("Option + clique apaga só aquela estação", () => {
    const onDelete = vi.fn();
    const { container } = render(
      <svg>
        <MetarStations stations={[placed]} screenScale={1} onDelete={onDelete} />
      </svg>,
    );
    fireEvent.pointerDown(container.querySelector("[data-metar-id='m1']"), { button: 0, altKey: true });
    expect(onDelete).toHaveBeenCalledWith("m1");
  });

  it("clique sem Option não apaga a estação", () => {
    const onDelete = vi.fn();
    const { container } = render(
      <svg>
        <MetarStations stations={[placed]} screenScale={1} onDelete={onDelete} />
      </svg>,
    );
    fireEvent.pointerDown(container.querySelector("[data-metar-id='m1']"), { button: 0 });
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe("texto original ao lado da estação", () => {
  it("aparece em linhas, sem decodificação, na posição da estação", () => {
    const { container } = render(<MetarCallouts stations={[placed]} viewW={200} viewH={100} />);
    const callout = container.querySelector(".metar-callout");
    expect(callout).toHaveClass("metar-cat--vfr");
    expect(callout.textContent).toBe("METAR SBSP 270800Z AUTO\n14006KT 9999 FEW022 BKN032\n17/16 Q1021");
    expect(callout.style.left).toBe("25%");
    expect(callout.style.top).toBe("60%");
  });

  it("a caixa fica do lado oposto à haste (vento de 140°: à esquerda e para cima)", () => {
    const { container } = render(<MetarCallouts stations={[placed]} viewW={200} viewH={100} />);
    const transform = container.querySelector(".metar-callout").style.transform;
    expect(transform).toContain("calc(-100% - 12px)");
    expect(transform).toContain("calc(-100% - 6px)");
  });

  it("estação sem texto original não mostra caixa", () => {
    const { container } = render(<MetarCallouts stations={[{ ...placed, station: { ...station, raw: "" } }]} viewW={200} viewH={100} />);
    expect(container.querySelector(".metar-callout")).toBeNull();
  });
});
