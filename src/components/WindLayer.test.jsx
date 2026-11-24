import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MeasureLayer from "./MeasureLayer";

// jsdom não faz layout: o SVG ocupa uma área de 100 × 100 px, e a superfície tem 200 × 200 unidades.
const setupLayer = (props = {}) => {
  const handlers = { onWind: vi.fn(), onWindSubmit: vi.fn(), onWindCancel: vi.fn(), onPoint: vi.fn(), onMove: vi.fn(), onFinish: vi.fn() };
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
  const svg = container.querySelector("svg");
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
  return { svg, container, ...handlers };
};

const arrow = { id: "a1", surface: "img", x: 100, y: 100, dir: 270, speed: 15 };

describe("vento na camada de medição", () => {
  it("desenha uma seta por vento, com a velocidade embaixo", () => {
    const { container } = setupLayer({ windOn: true, winds: [arrow] });
    expect(container.querySelectorAll(".wind-arrow")).toHaveLength(1);
    expect(screen.getByText("270° · 15 kt")).toHaveClass("wind-label");
  });

  it("não desenha ventos de outra superfície", () => {
    const { container } = setupLayer({ windOn: true, winds: [{ ...arrow, surface: "pdf:2" }] });
    expect(container.querySelectorAll(".wind-arrow")).toHaveLength(0);
  });

  it("com vento ligado, o clique marca o ponto em unidades da superfície, sem começar medição", () => {
    const { svg, onWind, onPoint } = setupLayer({ windOn: true });
    fireEvent.pointerDown(svg, { clientX: 25, clientY: 50, button: 0 });
    expect(onWind).toHaveBeenCalledWith({ x: 50, y: 100 });
    expect(onPoint).not.toHaveBeenCalled();
  });

  it("o formulário não aparece para um ponto pendente de outra superfície", () => {
    setupLayer({ windOn: true, windPending: { surface: "pdf:1", x: 10, y: 10 } });
    expect(screen.queryByRole("spinbutton", { name: "Wind direction, in degrees, where it comes from" })).toBeNull();
  });

  it("o formulário aparece no ponto pendente da própria superfície", () => {
    setupLayer({ windOn: true, windPending: { surface: "img", x: 10, y: 10 } });
    expect(screen.getByRole("spinbutton", { name: "Wind direction, in degrees, where it comes from" })).toBeInTheDocument();
  });

  it("confirma direção e velocidade com o botão ou com Enter", () => {
    const { onWindSubmit } = setupLayer({ windOn: true, windPending: { surface: "img", x: 10, y: 10 } });
    const dir = screen.getByRole("spinbutton", { name: "Wind direction, in degrees, where it comes from" });
    const speed = screen.getByRole("spinbutton", { name: "Wind speed" });
    const add = screen.getByRole("button", { name: "Add wind" });

    expect(add).toBeDisabled();
    fireEvent.change(dir, { target: { value: "270" } });
    expect(add).toBeDisabled();
    fireEvent.change(speed, { target: { value: "15" } });
    expect(add).toBeEnabled();
    fireEvent.click(add);
    expect(onWindSubmit).toHaveBeenCalledWith({ dir: 270, speed: 15, magnetic: false });
  });

  it("recusa direção acima de 360 e velocidade negativa", () => {
    setupLayer({ windOn: true, windPending: { surface: "img", x: 10, y: 10 } });
    const dir = screen.getByRole("spinbutton", { name: "Wind direction, in degrees, where it comes from" });
    const speed = screen.getByRole("spinbutton", { name: "Wind speed" });
    fireEvent.change(dir, { target: { value: "400" } });
    fireEvent.change(speed, { target: { value: "5" } });
    expect(screen.getByRole("button", { name: "Add wind" })).toBeDisabled();
    fireEvent.change(dir, { target: { value: "90" } });
    fireEvent.change(speed, { target: { value: "-2" } });
    expect(screen.getByRole("button", { name: "Add wind" })).toBeDisabled();
  });

  it("Esc no formulário cancela a entrada", () => {
    const { onWindCancel } = setupLayer({ windOn: true, windPending: { surface: "img", x: 10, y: 10 } });
    const dir = screen.getByRole("spinbutton", { name: "Wind direction, in degrees, where it comes from" });
    fireEvent.keyDown(dir, { key: "Escape" });
    expect(onWindCancel).toHaveBeenCalledTimes(1);
  });
});

describe("avião sobre a rota", () => {
  it("fica na linha, no ponto mais perto do vento, com o nariz na proa", () => {
    const link = {
      key: "a>b",
      from: { x: 0, y: 100 },
      to: { x: 200, y: 100 },
      trackText: "090°",
      distance: null,
      heading: 80,
      anchor: { x: 100, y: 50 },
    };
    const { container } = render(
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
        route={[link]}
      />,
    );
    const plane = container.querySelector(".route-plane");
    expect(plane).not.toBeNull();
    expect(plane.getAttribute("transform")).toContain("translate(100 100)");
    expect(plane.getAttribute("transform")).toContain("rotate(80)");
  });

  it("sem proa corrigida, não desenha avião", () => {
    const link = { key: "a>b", from: { x: 0, y: 100 }, to: { x: 200, y: 100 }, trackText: "090°", distance: null, heading: null, anchor: null };
    const { container } = render(
      <MeasureLayer surface="img" viewW={200} viewH={200} enabled={false} lines={[]} draft={null} format={() => null} onPoint={vi.fn()} onMove={vi.fn()} onFinish={vi.fn()} route={[link]} />,
    );
    expect(container.querySelector(".route-plane")).toBeNull();
  });
});
