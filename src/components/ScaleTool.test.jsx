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

  it("escala válida não marca o campo como inválido", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Map scale" });
    fireEvent.change(input, { target: { value: "1:1000000" } });
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("escala inválida marca o campo", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Map scale" });
    fireEvent.change(input, { target: { value: "1:0" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});
