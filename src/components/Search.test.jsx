import { render, screen, fireEvent, within } from "@testing-library/react";
import Search from "./Search";

const folders = [
  { name: "footage", fileCount: 1, totalSize: 10, files: [{ relPath: "cena01.png", name: "cena01.png", type: "image", ext: "png", size: 10, file: new File(["x"], "cena01.png") }] },
  { name: "fx", fileCount: 1, totalSize: 10, files: [{ relPath: "dia2/cena_whoosh.pdf", name: "cena_whoosh.pdf", type: "other", ext: "pdf", size: 10, file: new File(["x"], "cena_whoosh.pdf") }] },
];

// Os favoritos ficam no armazenamento local: cada teste começa sem nenhum.
beforeEach(() => localStorage.clear());

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
  // Começa pelo nome: o botão de favorito do mesmo mapa também cita o arquivo no rótulo.
  fireEvent.click(screen.getByRole("button", { name: /^cena_whoosh/ }));
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

test("marcar favorito no mapa não o abre e fica guardado", () => {
  const { onPreview, input } = setup();
  fireEvent.change(input, { target: { value: "cena01" } });
  fireEvent.click(screen.getByRole("button", { name: "Favorite cena01.png" }));
  expect(onPreview).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Favorite cena01.png" })).toHaveAttribute("aria-pressed", "true");
  expect(JSON.parse(localStorage.getItem("mapareader.favorites"))).toEqual(["cena01.png|10"]);
  fireEvent.click(screen.getByRole("button", { name: "Favorite cena01.png" }));
  expect(screen.getByRole("button", { name: "Favorite cena01.png" })).toHaveAttribute("aria-pressed", "false");
});

test("o filtro Favoritos mostra só os favoritos, de todas as pastas", () => {
  const { input } = setup();
  fireEvent.change(input, { target: { value: "cena" } });
  fireEvent.click(screen.getByRole("button", { name: "Favorite cena01.png" }));
  const panel = screen.getByRole("region", { name: "Search results" });
  expect(panel.querySelectorAll(".search-live__tile")).toHaveLength(2);
  fireEvent.click(within(panel).getByRole("button", { name: "Favorites" }));
  expect(within(panel).getByRole("button", { name: "Favorites" })).toHaveAttribute("aria-pressed", "true");
  expect(panel.querySelectorAll(".search-live__tile")).toHaveLength(1);
  expect(within(panel).getByText("1 favorite")).toBeInTheDocument();
  fireEvent.click(within(panel).getByRole("button", { name: "Favorites" }));
  expect(panel.querySelectorAll(".search-live__tile")).toHaveLength(2);
});

test("filtro Favoritos sem nenhum favorito mostra mensagem", () => {
  const { input } = setup();
  fireEvent.focus(input);
  fireEvent.click(screen.getByRole("button", { name: "Favorites" }));
  expect(screen.getByText("No favorites yet")).toBeInTheDocument();
});

test("na lista, o marcador de favorito fica no fim de cada linha", () => {
  const onPreview = vi.fn();
  render(<Search folders={folders} onPreview={onPreview} view="list" onViewChange={vi.fn()} />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "cena" } });
  fireEvent.click(screen.getByRole("button", { name: "Favorite cena_whoosh.pdf" }));
  expect(onPreview).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Favorite cena_whoosh.pdf" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Favorite cena01.png" })).toHaveAttribute("aria-pressed", "false");
});

test("a coluna da visualização também marca favoritos", () => {
  render(<Search docked folders={folders} onPreview={vi.fn()} view="grid" onViewChange={vi.fn()} />);
  expect(screen.getAllByRole("button", { name: /^Favorite / })).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Favorite cena01.png" }));
  expect(screen.getByRole("button", { name: "Favorite cena01.png" })).toHaveAttribute("aria-pressed", "true");
});
