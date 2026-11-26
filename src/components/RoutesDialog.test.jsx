import { fireEvent, render, screen } from "@testing-library/react";
import RoutesDialog from "./RoutesDialog";

const route = (over = {}) => ({
  id: "r1",
  mapKey: "carta|1",
  name: "Ida",
  savedAt: new Date(2026, 10, 26, 9, 30).getTime(),
  plots: [{ id: "p1" }, { id: "p2" }],
  winds: [],
  declination: "",
  declinationSide: "W",
  scaleText: "",
  mapType: null,
  ...over,
});

// Abre a janela com as ações como funções falsas; `props` troca o que precisar.
function renderDialog(props = {}) {
  const handlers = { onSave: vi.fn(() => true), onLoad: vi.fn(), onDelete: vi.fn(), onClose: vi.fn() };
  render(<RoutesDialog routes={[]} canSave {...handlers} {...props} />);
  return handlers;
}

describe("janela das rotas salvas", () => {
  test("sem rotas salvas, a janela mostra só o formulário de salvar, sem lista nem busca", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "Saved routes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save current route" })).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  test("lista cada rota com a data, a quantidade de pontos e, se houver, de ventos", () => {
    renderDialog({
      routes: [route({ winds: [{ id: "w1" }] }), route({ id: "r2", name: "Volta", plots: [{ id: "a" }] })],
    });
    expect(screen.getByText("Ida")).toBeInTheDocument();
    expect(screen.getByText(/2 points · 1 wind$/)).toBeInTheDocument();
    expect(screen.getByText("Volta")).toBeInTheDocument();
    expect(screen.getByText(/1 point$/)).toBeInTheDocument();
  });

  test("salvar sem nome põe a data e a hora no lugar", () => {
    const { onSave } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Save current route" }));
    expect(onSave).toHaveBeenCalledWith(expect.stringMatching(/\d/));
  });

  test("salvar com nome passa o nome sem espaços nas pontas, e limpa o campo", () => {
    const { onSave } = renderDialog();
    const input = screen.getByRole("textbox", { name: "Route name" });
    fireEvent.change(input, { target: { value: "  Volta  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save current route" }));
    expect(onSave).toHaveBeenCalledWith("Volta");
    expect(input).toHaveValue("");
  });

  test("sem pontos, não dá para salvar: o campo e o botão ficam desabilitados", () => {
    renderDialog({ canSave: false });
    expect(screen.getByRole("textbox", { name: "Route name" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save current route" })).toBeDisabled();
  });

  test("se o armazenamento recusar, a janela avisa e mantém o nome digitado", () => {
    const onSave = vi.fn(() => false);
    renderDialog({ onSave });
    const input = screen.getByRole("textbox", { name: "Route name" });
    fireEvent.change(input, { target: { value: "Ida" } });
    fireEvent.click(screen.getByRole("button", { name: "Save current route" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
    expect(input).toHaveValue("Ida");
  });

  test("Abrir entrega a rota escolhida; a lixeira apaga pelo id dela", () => {
    const routes = [route(), route({ id: "r2", name: "Volta" })];
    const { onLoad, onDelete } = renderDialog({ routes });
    fireEvent.click(screen.getAllByRole("button", { name: "Open" })[1]);
    expect(onLoad).toHaveBeenCalledWith(routes[1]);
    fireEvent.click(screen.getByRole("button", { name: "Delete route Ida" }));
    expect(onDelete).toHaveBeenCalledWith("r1");
  });

  test("Esc fecha a janela", () => {
    const { onClose } = renderDialog();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  test("sem rotas salvas, não há busca", () => {
    renderDialog();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  test("a busca filtra pelo nome enquanto se digita, sem diferenciar maiúsculas", () => {
    renderDialog({ routes: [route(), route({ id: "r2", name: "Volta" }), route({ id: "r3", name: "Costa Sul" })] });
    const search = screen.getByRole("searchbox", { name: "Search routes by name" });
    fireEvent.change(search, { target: { value: "COSTA" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Costa Sul")).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  test("sem nenhuma rota com o texto buscado, a janela avisa", () => {
    renderDialog({ routes: [route()] });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "xyz" } });
    expect(screen.queryByRole("listitem")).toBeNull();
    expect(screen.getByText("No routes found.")).toBeInTheDocument();
  });

  test("salvar limpa a busca, para a rota nova aparecer na lista", () => {
    renderDialog({ routes: [route()] });
    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "xyz" } });
    fireEvent.click(screen.getByRole("button", { name: "Save current route" }));
    expect(search).toHaveValue("");
  });
});
