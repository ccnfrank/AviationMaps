import { render, screen, fireEvent } from "@testing-library/react";
import Preview from "./Preview";

const entry = (name, content = "x") => ({
  name, size: content.length || 10, file: new File([content], name),
});
const nav = { hasPrev: true, hasNext: true, onPrev: () => {}, onNext: () => {}, onClose: () => {} };

// Imagem de 800 × 600 com a área do mapa no tamanho da imagem, como nos outros testes de medição.
async function renderMap(name = "capa.png") {
  const view = render(<Preview entry={entry(name)} {...nav} />);
  const img = await screen.findByRole("img", { name });
  Object.defineProperty(img, "naturalWidth", { value: 800 });
  Object.defineProperty(img, "naturalHeight", { value: 600 });
  fireEvent.load(img);
  const svg = view.container.querySelector("svg.measure-layer");
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
  return { ...view, svg };
}

// Dois pontos plotados e um vento no meio: uma rota completa para salvar.
function plotRouteWithWind(svg) {
  fireEvent.click(screen.getByRole("button", { name: "Plot points" }));
  fireEvent.pointerDown(svg, { clientX: 100, clientY: 300, button: 0 });
  fireEvent.pointerDown(svg, { clientX: 700, clientY: 300, button: 0 });
  fireEvent.click(screen.getByRole("button", { name: "Wind" }));
  fireEvent.pointerDown(svg, { clientX: 400, clientY: 300, button: 0 });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Wind direction, in degrees, where it comes from" }), { target: { value: "270" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Wind speed" }), { target: { value: "15" } });
  fireEvent.click(screen.getByRole("button", { name: "Add wind" }));
}

const openWithKey = () => fireEvent.keyDown(document, { key: "r" });

beforeEach(() => localStorage.clear());

describe("rotas salvas na visualização", () => {
  test("o botão de rotas salvas fica logo antes do exportar, e a tecla R abre a janela", async () => {
    await renderMap();
    const routes = screen.getByRole("button", { name: "Saved routes" });
    expect(routes.nextElementSibling).toBe(screen.getByRole("button", { name: "Export route (CSV)" }));

    openWithKey();
    expect(screen.getByRole("dialog", { name: "Saved routes" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Saved routes" })).toBeNull();
  });

  test("R digitada num campo não abre a janela", async () => {
    await renderMap();
    fireEvent.keyDown(screen.getByLabelText("Magnetic declination in degrees"), { key: "r" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("salvar a rota, limpar o mapa e abri-la de novo devolve pontos, vento e desvio", async () => {
    const { container, svg } = await renderMap();
    const declination = screen.getByLabelText("Magnetic declination in degrees");
    fireEvent.change(declination, { target: { value: "23" } });
    plotRouteWithWind(svg);
    expect(container.querySelectorAll(".plot-marker")).toHaveLength(2);
    expect(container.querySelectorAll(".wind-arrow")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Saved routes" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Route name" }), { target: { value: "Ida" } });
    fireEvent.click(screen.getByRole("button", { name: "Save current route" }));
    expect(screen.getByText(/2 points · 1 wind$/)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Clear everything on the map" }));
    fireEvent.change(declination, { target: { value: "5" } });
    expect(container.querySelectorAll(".plot-marker")).toHaveLength(0);
    expect(container.querySelectorAll(".wind-arrow")).toHaveLength(0);

    openWithKey();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.queryByRole("dialog", { name: "Saved routes" })).toBeNull();
    expect(container.querySelectorAll(".plot-marker")).toHaveLength(2);
    expect(container.querySelectorAll(".wind-arrow")).toHaveLength(1);
    expect(declination).toHaveValue("23");
  });

  test("a rota salva vale só para o mapa em que foi feita", async () => {
    const first = await renderMap("capa.png");
    plotRouteWithWind(first.svg);
    fireEvent.click(screen.getByRole("button", { name: "Saved routes" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Route name" }), { target: { value: "Só desta carta" } });
    fireEvent.click(screen.getByRole("button", { name: "Save current route" }));
    first.unmount();

    await renderMap("outra.png");
    openWithKey();
    expect(screen.queryByRole("listitem")).toBeNull();
    expect(screen.queryByText("Só desta carta")).toBeNull();
  });

  test("sem pontos plotados, a janela não salva", async () => {
    await renderMap();
    openWithKey();
    expect(screen.getByRole("button", { name: "Save current route" })).toBeDisabled();
  });
});
