import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MeasureLayer from "./MeasureLayer";

const layer = (route) => render(
  <MeasureLayer
    surface="img"
    viewW={200}
    viewH={200}
    enabled={false}
    lines={[]}
    draft={null}
    format={() => null}
    onPoint={vi.fn()}
    onMove={vi.fn()}
    onFinish={vi.fn()}
    route={route}
  />,
);

const east = {
  key: "a>b",
  from: { x: 0, y: 100 },
  to: { x: 100, y: 100 },
  trackText: "090°",
  distance: "5.4 nm",
};

describe("rota na camada de medição", () => {
  it("desenha uma linha por trecho, entre os dois pontos", () => {
    const { container } = layer([east]);
    const lines = container.querySelectorAll("line.route-line");
    expect(lines).toHaveLength(1);
    expect(lines[0].getAttribute("x1")).toBe("0");
    expect(lines[0].getAttribute("x2")).toBe("100");
  });

  it("mostra o rumo e a distância de cada trecho", () => {
    layer([east]);
    expect(screen.getByText("090°")).toHaveClass("route-label--track");
    expect(screen.getByText("5.4 nm")).toHaveClass("route-label--dist");
  });

  it("sem escala, mostra só o rumo", () => {
    const { container } = layer([{ ...east, distance: null }]);
    expect(screen.getByText("090°")).toBeInTheDocument();
    expect(container.querySelector(".route-label--dist")).toBeNull();
  });

  it("o rumo fica acima da linha e a distância abaixo: deslocamentos em sentidos opostos", () => {
    layer([east]);
    const track = screen.getByText("090°");
    const dist = screen.getByText("5.4 nm");
    // Linha horizontal: a normal para cima tem y negativo, e a distância recebe o sinal oposto.
    expect(parseFloat(track.style.getPropertyValue("--oy"))).toBeLessThan(0);
    expect(parseFloat(dist.style.getPropertyValue("--oy"))).toBeGreaterThan(0);
  });
});
