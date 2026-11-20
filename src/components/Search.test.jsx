import { render, screen, fireEvent, within } from "@testing-library/react";
import Search from "./Search";

const folders = [
  { name: "footage", fileCount: 1, totalSize: 10, files: [{ relPath: "cena01.png", name: "cena01.png", type: "image", ext: "png", size: 10, file: new File(["x"], "cena01.png") }] },
  { name: "fx", fileCount: 1, totalSize: 10, files: [{ relPath: "dia2/cena_whoosh.pdf", name: "cena_whoosh.pdf", type: "other", ext: "pdf", size: 10, file: new File(["x"], "cena_whoosh.pdf") }] },
];

function setup() {
  const onPreview = vi.fn();
  render(<Search folders={folders} onPreview={onPreview} />);
  return { onPreview, input: screen.getByRole("searchbox", { name: "Search maps in all folders" }) };
}

test("digitar mostra resultados de todas as pastas em tempo real", () => {
  const { input } = setup();
  expect(screen.queryByRole("region", { name: "Search results" })).toBeNull();
  fireEvent.change(input, { target: { value: "cena" } });
  const panel = screen.getByRole("region", { name: "Search results" });
  expect(panel.querySelectorAll(".search-live__tile")).toHaveLength(2);
  expect(within(panel).getByText("2 results in all folders")).toBeInTheDocument();
  fireEvent.change(input, { target: { value: "cena01" } });
  expect(panel.querySelectorAll(".search-live__tile")).toHaveLength(1);
});

test("nada encontrado mostra mensagem", () => {
  const { input } = setup();
  fireEvent.change(input, { target: { value: "zzz" } });
  expect(screen.getByText("No results")).toBeInTheDocument();
});

test("Enter pré-visualiza o primeiro resultado", () => {
  const { onPreview, input } = setup();
  fireEvent.change(input, { target: { value: "cena" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ name: "cena01.png" }));
});

test("clicar num resultado pré-visualiza o arquivo direto e limpa a busca", () => {
  const { onPreview, input } = setup();
  fireEvent.change(input, { target: { value: "cena" } });
  fireEvent.click(screen.getByRole("button", { name: /cena_whoosh/ }));
  expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ name: "cena_whoosh.pdf", relPath: "dia2/cena_whoosh.pdf" }));
  expect(input).toHaveValue("");
});

test("Esc limpa a busca e fecha o painel", () => {
  const { input } = setup();
  fireEvent.change(input, { target: { value: "cena" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input).toHaveValue("");
  expect(screen.queryByRole("region", { name: "Search results" })).toBeNull();
});
