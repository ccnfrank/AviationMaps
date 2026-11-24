import { render, screen, fireEvent, within } from "@testing-library/react";
import HelpButton from "./HelpButton";
import en from "../i18n/locales/en.json";
import pt from "../i18n/locales/pt.json";

test("o ícone de ajuda abre a documentação com os atalhos", () => {
  render(<HelpButton />);
  fireEvent.click(screen.getByRole("button", { name: "Help" }));
  const dialog = screen.getByRole("dialog", { name: "How to use Map Reader" });
  expect(within(dialog).getByText("Open the empty map viewer")).toBeInTheDocument();
  expect(within(dialog).getByText("Zoom in")).toBeInTheDocument();
  expect(within(dialog).getByText("Darken")).toBeInTheDocument();
});

test("Esc fecha a ajuda e devolve o foco ao ícone", () => {
  render(<HelpButton />);
  const button = screen.getByRole("button", { name: "Help" });
  button.focus(); // o foco vem do clique ou do Tab, antes de abrir
  fireEvent.click(button);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(button).toHaveFocus();
});

test("português e inglês têm a mesma estrutura de ajuda", () => {
  expect(pt.help.sections).toHaveLength(en.help.sections.length);
  pt.help.sections.forEach((section, i) => {
    const original = en.help.sections[i];
    expect(Boolean(section.paragraphs)).toBe(Boolean(original.paragraphs));
    expect(Boolean(section.items)).toBe(Boolean(original.items));
    expect(section.shortcuts?.length ?? 0).toBe(original.shortcuts?.length ?? 0);
  });
});
