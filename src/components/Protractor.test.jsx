import { render, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Protractor, { DeclinationInput } from "./Protractor";

// Pivô em (100, 100) e ponteiro em (200, 100): o ângulo é 90°, a seta aponta para a direita.
const pivot = { x: 100, y: 100 };
const cursor = { x: 200, y: 100 };
const draw = (props = {}) => render(
  <Protractor viewW={400} viewH={400} pivot={pivot} cursor={cursor} locked {...props} />,
);

describe("agulha do desvio magnético", () => {
  it("sem desvio, só existe a agulha principal", () => {
    const { container } = draw();
    expect(container.querySelector(".protractor__arrow")).not.toBeNull();
    expect(container.querySelector(".protractor__arrow--declination")).toBeNull();
  });

  it("com desvio, a segunda agulha aponta para ângulo + desvio (90° - 15° = 75°)", () => {
    const { container } = draw({ declination: -15 });
    const needle = container.querySelector(".protractor__arrow--declination");
    expect(needle).not.toBeNull();
    // A seta é desenhada para a direita (90°), então o giro é (75 - 90) = -15.
    expect(needle).toHaveAttribute("transform", "rotate(-15)");
    expect(container.querySelector(".protractor__arrow:not(.protractor__arrow--declination)"))
      .toHaveAttribute("transform", "rotate(0)");
  });

  it("o desvio dá a volta no círculo (350° + 20° = 10°)", () => {
    // Ponteiro 10° a oeste do norte: ângulo de 350°.
    const west = { x: 100 - 100 * Math.sin((10 * Math.PI) / 180), y: 100 - 100 * Math.cos((10 * Math.PI) / 180) };
    const { container } = draw({ cursor: west, declination: 20 });
    expect(container.querySelector(".protractor__arrow--declination"))
      .toHaveAttribute("transform", "rotate(-80)");
  });

  it("sem ponteiro fixado (só o centro), não há agulha de desvio", () => {
    const { container } = draw({ cursor: null, declination: 10 });
    expect(container.querySelector(".protractor__arrow--declination")).toBeNull();
  });

  it("a agulha de desvio segue o ponteiro enquanto não está fixada", () => {
    const { container } = draw({ locked: false, declination: 5 });
    expect(container.querySelector(".protractor__arrow--declination")).toHaveClass("is-live");
  });
});

describe("campo do desvio magnético", () => {
  it("entrega o texto digitado a cada tecla", () => {
    const onChange = vi.fn();
    render(<DeclinationInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Magnetic declination in degrees" }), { target: { value: "-12" } });
    expect(onChange).toHaveBeenCalledWith("-12");
  });

  it("marca como inválido o que não é número", () => {
    render(<DeclinationInput value="-" onChange={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("vazio não é inválido", () => {
    render(<DeclinationInput value="" onChange={() => {}} />);
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid");
  });
});
