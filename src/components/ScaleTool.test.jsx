import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import ScaleTool from "./ScaleTool";

// Guarda o estado como o Preview faz, para os cliques e a digitação aparecerem no resultado.
function Harness() {
  const [type, setType] = useState(null);
  const [text, setText] = useState("");
  return <ScaleTool type={type} onType={setType} text={text} onText={setText} />;
}

describe("ferramenta da escala", () => {
  it("tem os três tipos de mapa, sem nenhum escolhido no início", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Aviation" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Nautical" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Land" })).toHaveAttribute("aria-pressed", "false");
  });

  it("escolher um tipo marca o botão, e clicar de novo desmarca", () => {
    render(<Harness />);
    const aviation = screen.getByRole("button", { name: "Aviation" });
    fireEvent.click(aviation);
    expect(aviation).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(aviation);
    expect(aviation).toHaveAttribute("aria-pressed", "false");
  });

  it("1:1000000 mostra 1 cm = 10 km (o exemplo do pedido)", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("textbox", { name: "Map scale" }), { target: { value: "1:1000000" } });
    expect(screen.getByText("1 cm = 10 km")).toBeInTheDocument();
  });

  it("com aviação, o resultado vem em milhas náuticas, com quilômetros ao lado", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Aviation" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Map scale" }), { target: { value: "1:1000000" } });
    expect(screen.getByText("1 cm = 5.4 NM")).toBeInTheDocument();
    expect(screen.getByText("≈ 10 km")).toBeInTheDocument();
  });

  it("escala inválida marca o campo e não mostra resultado", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Map scale" });
    fireEvent.change(input, { target: { value: "1:0" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter the scale")).toBeInTheDocument();
  });
});
