import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MeasureLayer from "./MeasureLayer";
import { WindForm } from "./WindLayer";

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

  it("o rótulo no mapa mostra direção e velocidade, sem a TAS (ela fica no vento e na rota)", () => {
    const { container } = setupLayer({ windOn: true, winds: [{ ...arrow, tas: 120 }] });
    const label = container.querySelector(".wind-label");
    expect(label.textContent).toBe("270° · 15 kt");
    expect(container.textContent).not.toMatch(/TAS/);
  });

  it("Option + clique na seta apaga esse vento, sem marcar outro", () => {
    const onDeleteWind = vi.fn();
    const { container, onWind } = setupLayer({ windOn: true, winds: [arrow], onDeleteWind });
    fireEvent.pointerDown(container.querySelector(".wind-arrow polygon"), { button: 0, altKey: true });
    expect(onDeleteWind).toHaveBeenCalledWith("a1");
    expect(onWind).not.toHaveBeenCalled();
  });

  it("Option + clique no rótulo do vento apaga esse vento", () => {
    const onDeleteWind = vi.fn();
    setupLayer({ windOn: true, winds: [arrow], onDeleteWind });
    fireEvent.pointerDown(screen.getByText("270° · 15 kt"), { button: 0, altKey: true });
    expect(onDeleteWind).toHaveBeenCalledWith("a1");
  });

  it("clique na seta sem Option não apaga o vento", () => {
    const onDeleteWind = vi.fn();
    const { container } = setupLayer({ windOn: true, winds: [arrow], onDeleteWind });
    fireEvent.pointerDown(container.querySelector(".wind-arrow polygon"), { button: 0 });
    expect(onDeleteWind).not.toHaveBeenCalled();
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
    expect(onWindSubmit).toHaveBeenCalledWith({ dir: 270, speed: 15, magnetic: false, tas: null });
  });

  it("a TAS é de cada vento: com ela, vai junto na confirmação; inválida, não deixa confirmar", () => {
    const { onWindSubmit } = setupLayer({ windOn: true, windPending: { surface: "img", x: 10, y: 10 } });
    const tas = screen.getByRole("textbox", { name: "True airspeed (TAS)" });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Wind direction, in degrees, where it comes from" }), { target: { value: "270" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Wind speed" }), { target: { value: "15" } });
    fireEvent.change(tas, { target: { value: "abc" } });
    expect(screen.getByRole("button", { name: "Add wind" })).toBeDisabled();
    fireEvent.change(tas, { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Add wind" }));
    expect(onWindSubmit).toHaveBeenCalledWith({ dir: 270, speed: 15, magnetic: false, tas: 120 });
  });

  it("trocar a unidade converte a velocidade e a TAS já digitadas", () => {
    setupLayer({ windOn: true, windPending: { surface: "img", x: 10, y: 10 } });
    const speed = screen.getByRole("spinbutton", { name: "Wind speed" });
    fireEvent.change(speed, { target: { value: "15" } });
    fireEvent.change(screen.getByRole("textbox", { name: "True airspeed (TAS)" }), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Speed unit: knots or km/h" }));
    expect(speed).toHaveValue(27.8);
    expect(screen.getByRole("textbox", { name: "True airspeed (TAS)" })).toHaveValue("222.2");
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

describe("pontos plotados arrastáveis", () => {
  it("arrastar o marcador move o ponto, sem saltar para o ponteiro", () => {
    const onMovePlot = vi.fn();
    const plots = [{ id: "p1", surface: "img", x: 50, y: 50 }];
    setupLayer({ plotting: true, plots, onMovePlot });
    const marker = screen.getByText("1");
    // Escala 2 (200 unidades em 100 px). O centro do marcador fica em (50, 50) da superfície.
    fireEvent.pointerDown(marker, { clientX: 27, clientY: 27, button: 0 });
    fireEvent.pointerMove(marker, { clientX: 60, clientY: 40 });
    // Ponteiro em (120, 80) da superfície, com um deslocamento de (4, 4) da pegada: o ponto vai a (116, 76).
    expect(onMovePlot).toHaveBeenLastCalledWith("p1", { x: 116, y: 76 });
    fireEvent.pointerUp(marker, { clientX: 60, clientY: 40 });
    fireEvent.pointerMove(marker, { clientX: 90, clientY: 90 });
    expect(onMovePlot).toHaveBeenCalledTimes(1);
  });

  it("o arraste fica dentro da superfície", () => {
    const onMovePlot = vi.fn();
    const plots = [{ id: "p1", surface: "img", x: 50, y: 50 }];
    setupLayer({ plots, onMovePlot });
    const marker = screen.getByText("1");
    fireEvent.pointerDown(marker, { clientX: 25, clientY: 25, button: 0 });
    fireEvent.pointerMove(marker, { clientX: 999, clientY: -50 });
    expect(onMovePlot).toHaveBeenLastCalledWith("p1", { x: 200, y: 0 });
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

describe("direção vinda do transferidor no mapa", () => {
  it("o formulário preenche a direção quando chega dirFromMap, e atualiza quando muda", () => {
    const { rerender } = render(<WindForm x={0} y={0} viewW={100} viewH={100} onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("spinbutton", { name: "Wind direction, in degrees, where it comes from" })).toHaveValue(null);
    rerender(<WindForm x={0} y={0} viewW={100} viewH={100} dirFromMap={270} onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("spinbutton", { name: "Wind direction, in degrees, where it comes from" })).toHaveValue(270);
    rerender(<WindForm x={0} y={0} viewW={100} viewH={100} dirFromMap={45} onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("spinbutton", { name: "Wind direction, in degrees, where it comes from" })).toHaveValue(45);
  });
});
