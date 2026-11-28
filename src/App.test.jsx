import { render, screen, fireEvent, within } from "@testing-library/react";
import App from "./App";

// Arquivo como vem do <input webkitdirectory>: o caminho relativo começa na pasta escolhida.
const mk = (rel, type = "image/png") => {
  const f = new File(["x"], rel.split("/").pop(), { type });
  Object.defineProperty(f, "webkitRelativePath", { value: rel });
  return f;
};
const loadFiles = (container, files) => {
  fireEvent.change(container.querySelector('[data-testid="folder-input"]'), { target: { files } });
};
const SAMPLE = () => [
  mk("carta/norte/mapa-01.png"),
  mk("carta/sul/mapa-02.pdf", "application/pdf"),
  mk("carta/sul/filme.mp4", "video/mp4"),
  mk("carta/pacote.zip", "application/zip"),
  mk("carta/nota.txt", "text/plain"),
];
const search = () => screen.getByRole("searchbox", { name: "Search maps in all folders" });
const panel = () => screen.getByRole("region", { name: "Search results" });
const tiles = () => panel().querySelectorAll(".search-live__tile");
const groups = () => panel().querySelectorAll(".search-group");
const files = () => panel().querySelectorAll(".search-file");

test("página inicial: campo de busca e botão de carregar pasta lado a lado", () => {
  render(<App />);
  expect(screen.queryByRole("heading")).toBeNull();
  expect(screen.queryByRole("switch")).toBeNull();
  const dock = document.querySelector(".dock");
  expect(within(dock).getByRole("searchbox", { name: "Search maps in all folders" })).toBeInTheDocument();
  expect(within(dock).getByRole("button", { name: /Load maps directory/ })).toBeInTheDocument();
});

test("na tela inicial, buscar antes de carregar não mostra mapas", () => {
  render(<App />);
  fireEvent.change(search(), { target: { value: "mapa" } });
  expect(screen.getByText("No results")).toBeInTheDocument();
});

test("com subpastas, a busca abre em lista: um mapa por linha, agrupado por subpasta", () => {
  const { container } = render(<App />);
  loadFiles(container, SAMPLE());
  fireEvent.change(search(), { target: { value: "mapa" } });
  expect(groups()).toHaveLength(2);
  expect(within(panel()).getByText("norte")).toBeInTheDocument();
  expect(within(panel()).getByText("sul")).toBeInTheDocument();
  expect(files()).toHaveLength(2);
  expect(groups()[0].querySelector(".search-group__icon")).not.toBeNull();
  expect(screen.getByText("2 results in all folders")).toBeInTheDocument();
});

test("ao clicar no campo, sem digitar, a lista mostra só as pastas e subpastas, com ícone de pasta", () => {
  const { container } = render(<App />);
  loadFiles(container, SAMPLE());
  fireEvent.focus(search());
  const folderRows = panel().querySelectorAll(".search-folder");
  expect(folderRows).toHaveLength(2);
  expect(within(panel()).getByText("norte")).toBeInTheDocument();
  expect(within(panel()).getByText("sul")).toBeInTheDocument();
  folderRows.forEach((row) => expect(row.querySelector(".search-folder__icon")).not.toBeNull());
  expect(files()).toHaveLength(0);
  expect(screen.getByText("2 folders")).toBeInTheDocument();
});

test("clicar numa pasta da lista mostra os mapas dela; Voltar retorna às pastas; clicar num mapa abre a visualização", () => {
  const { container } = render(<App />);
  loadFiles(container, SAMPLE());
  fireEvent.focus(search());
  fireEvent.click(within(panel()).getByText("norte").closest("button"));
  expect(files()).toHaveLength(1);
  expect(files()[0].textContent).toContain("mapa-01.png");
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(panel().querySelectorAll(".search-folder")).toHaveLength(2);
  fireEvent.click(within(panel()).getByText("norte").closest("button"));
  fireEvent.click(files()[0]);
  expect(screen.getByRole("dialog", { name: "Preview of mapa-01.png" })).toBeInTheDocument();
});

test("na grade sem texto, mostra as pastas como cartões; clicar abre os mapas da pasta, e Voltar retorna", () => {
  const { container } = render(<App />);
  loadFiles(container, SAMPLE());
  fireEvent.focus(search());
  fireEvent.click(screen.getByRole("button", { name: "Grid view" }));
  expect(panel().querySelectorAll(".search-live__tile--folder")).toHaveLength(2);
  fireEvent.click(within(panel()).getByText("norte").closest("button"));
  expect(tiles()).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(panel().querySelectorAll(".search-live__tile--folder")).toHaveLength(2);
});

test("com texto, a lista volta a mostrar os mapas; subpasta tem ícone e a raiz da pasta não", () => {
  const { container } = render(<App />);
  loadFiles(container, [mk("carta/norte/mapa-01.png"), mk("carta/capa.png")]);
  fireEvent.focus(search());
  expect(files()).toHaveLength(0);
  fireEvent.change(search(), { target: { value: "a" } });
  const byName = (name) => Array.from(groups()).find((g) => g.getAttribute("aria-label") === name);
  expect(byName("norte").querySelector(".search-group__icon")).not.toBeNull();
  expect(byName("(raiz)").querySelector(".search-group__icon")).toBeNull();
});

test("alternar para grade mostra os mapas em miniaturas", () => {
  const { container } = render(<App />);
  loadFiles(container, SAMPLE());
  fireEvent.change(search(), { target: { value: "mapa" } });
  fireEvent.click(screen.getByRole("button", { name: "Grid view" }));
  expect(tiles()).toHaveLength(2);
  expect(screen.getByText("2 results in all folders")).toBeInTheDocument();
});

test("na lista, clicar num mapa abre a visualização", () => {
  const { container } = render(<App />);
  loadFiles(container, SAMPLE());
  fireEvent.change(search(), { target: { value: "mapa" } });
  const target = Array.from(files()).find((b) => b.textContent.includes("mapa-02"));
  fireEvent.click(target);
  expect(screen.getByRole("dialog", { name: "Preview of mapa-02.pdf" })).toBeInTheDocument();
});

test("sem subpastas, a busca abre em grade", () => {
  const { container } = render(<App />);
  loadFiles(container, [mk("carta/mapa-01.png"), mk("carta/mapa-02.png")]);
  fireEvent.change(search(), { target: { value: "mapa" } });
  expect(tiles()).toHaveLength(2);
  expect(groups()).toHaveLength(0);
});

test("zip, vídeo e texto não aparecem na busca", () => {
  const { container } = render(<App />);
  loadFiles(container, SAMPLE());
  fireEvent.change(search(), { target: { value: "pacote" } });
  expect(screen.getByText("No results")).toBeInTheDocument();
  fireEvent.change(search(), { target: { value: "filme" } });
  expect(screen.getByText("No results")).toBeInTheDocument();
});

test("pasta sem mapas explica", () => {
  const { container } = render(<App />);
  loadFiles(container, [mk("carta/pacote.zip", "application/zip")]);
  expect(screen.getByText("No images or PDFs found in this folder.")).toBeInTheDocument();
});

test("escolher um mapa na grade abre a janela de visualização", () => {
  const { container } = render(<App />);
  loadFiles(container, SAMPLE());
  fireEvent.change(search(), { target: { value: "mapa-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Grid view" }));
  fireEvent.click(tiles()[0]);
  expect(screen.getByRole("dialog", { name: "Preview of mapa-01.png" })).toBeInTheDocument();
});

test("limpar pastas volta à página inicial", () => {
  const { container } = render(<App />);
  loadFiles(container, SAMPLE());
  fireEvent.click(screen.getByRole("button", { name: "Clear folders" }));
  expect(screen.queryByRole("button", { name: "Clear folders" })).toBeNull();
  expect(within(document.querySelector(".dock")).getByRole("button", { name: /Load maps directory/ })).toBeInTheDocument();
});

test("ao abrir uma pasta com subpastas, mostra as subpastas e não os mapas delas; a subpasta mostra os seus", () => {
  const { container } = render(<App />);
  loadFiles(container, [
    mk("carta/norte/mapa-01.png"),
    mk("carta/norte/dia2/mapa-02.png"),
    mk("carta/norte/dia2/sul/mapa-03.png"),
    mk("carta/sul/mapa-04.png"),
  ]);
  fireEvent.focus(search());
  fireEvent.click(within(panel()).getByText("norte").closest("button"));
  expect(panel().querySelectorAll(".search-folder")).toHaveLength(1);
  expect(within(panel()).getByText("dia2")).toBeInTheDocument();
  expect(files()).toHaveLength(1);
  expect(files()[0].textContent).toContain("mapa-01.png");
  expect(screen.getByText("3 maps")).toBeInTheDocument();

  fireEvent.click(within(panel()).getByText("dia2").closest("button"));
  expect(panel().querySelectorAll(".search-folder")).toHaveLength(1);
  expect(within(panel()).getByText("sul")).toBeInTheDocument();
  expect(files()).toHaveLength(1);
  expect(files()[0].textContent).toContain("mapa-02.png");

  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(within(panel()).getByText("dia2")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(panel().querySelectorAll(".search-folder")).toHaveLength(2);
});

test("na grade, a pasta com subpastas mostra cartões de subpasta junto com os mapas soltos", () => {
  const { container } = render(<App />);
  loadFiles(container, [
    mk("carta/norte/mapa-01.png"),
    mk("carta/norte/dia2/mapa-02.png"),
    mk("carta/sul/mapa-04.png"),
  ]);
  fireEvent.focus(search());
  fireEvent.click(screen.getByRole("button", { name: "Grid view" }));
  fireEvent.click(within(panel()).getByText("norte").closest("button"));
  expect(panel().querySelectorAll(".search-live__tile--folder")).toHaveLength(1);
  expect(tiles()).toHaveLength(2);
  fireEvent.click(within(panel()).getByText("dia2").closest("button"));
  expect(tiles()).toHaveLength(1);
  expect(tiles()[0].textContent).toContain("mapa-02.png");
});

// ---------- Janela de visualização com a coluna de mapas ao lado ----------

// Abre um mapa pela busca da página; a coluna da visualização fica à direita da janela.
const openFirstMap = (container, name) => {
  loadFiles(container, SAMPLE());
  fireEvent.change(search(), { target: { value: name } });
  fireEvent.click(files()[0]);
};
const viewerColumn = () => document.querySelector(".viewer-library");

test("com a visualização aberta, a coluna ao lado mostra as miniaturas dos mapas da pasta", () => {
  const { container } = render(<App />);
  openFirstMap(container, "mapa-01");
  expect(screen.getByRole("dialog", { name: "Preview of mapa-01.png" })).toBeInTheDocument();
  expect(viewerColumn()).not.toBeNull();
  expect(viewerColumn().querySelectorAll(".search-live__tile")).toHaveLength(2);
});

test("clicar numa miniatura da coluna troca o mapa aberto", () => {
  const { container } = render(<App />);
  openFirstMap(container, "mapa-01");
  const other = Array.from(viewerColumn().querySelectorAll(".search-live__tile")).find((b) => b.textContent.includes("mapa-02"));
  fireEvent.click(other);
  expect(screen.getByRole("dialog", { name: "Preview of mapa-02.pdf" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "Preview of mapa-01.png" })).toBeNull();
});

const cellOf = (name) => Array.from(viewerColumn().querySelectorAll(".search-live__cell")).find((c) => c.textContent.includes(name));

test("passar o mouse sobre um mapa da coluna mostra a pré-visualização; sair devolve o mapa aberto", () => {
  const { container } = render(<App />);
  openFirstMap(container, "mapa-01");
  fireEvent.mouseEnter(cellOf("mapa-02"));
  expect(document.querySelector(".hover-preview .preview__name")).toHaveTextContent("mapa-02.pdf");
  // O mapa aberto continua o mesmo, só escondido atrás da pré-visualização.
  expect(screen.getByRole("dialog", { name: "Preview of mapa-01.png" })).toBeInTheDocument();
  expect(document.querySelector(".viewer-main")).toHaveClass("is-under");
  fireEvent.mouseLeave(viewerColumn().querySelector(".search-live"));
  expect(document.querySelector(".hover-preview")).toBeNull();
  expect(document.querySelector(".viewer-main")).not.toHaveClass("is-under");
  expect(screen.getByRole("dialog", { name: "Preview of mapa-01.png" })).toBeInTheDocument();
});

test("clicar no mapa da coluna abre de vez e encerra a pré-visualização", () => {
  const { container } = render(<App />);
  openFirstMap(container, "mapa-01");
  const cell = cellOf("mapa-02");
  fireEvent.mouseEnter(cell);
  fireEvent.click(cell.querySelector(".search-live__tile"));
  expect(screen.getByRole("dialog", { name: "Preview of mapa-02.pdf" })).toBeInTheDocument();
  expect(document.querySelector(".hover-preview")).toBeNull();
});

const splitButton = () => screen.getByRole("button", { name: "Split maps" });
const rightPane = () => document.querySelector(".viewer-main--right");

test("Split maps divide a visualização: o mapa da esquerda fica, e o da direita é o escolhido na lista", () => {
  const { container } = render(<App />);
  openFirstMap(container, "mapa-01");
  fireEvent.click(splitButton());
  expect(splitButton()).toHaveAttribute("aria-pressed", "true");
  expect(rightPane()).toHaveTextContent("Choose a map from the list beside it to see it here");
  fireEvent.click(cellOf("mapa-02").querySelector(".search-live__tile"));
  expect(rightPane().querySelector(".preview__name")).toHaveTextContent("mapa-02.pdf");
  // Escolher um mapa na lista torna o painel da direita o ativo: é nele que a barra de ferramentas aparece.
  expect(rightPane()).toHaveClass("is-active");
  expect(document.querySelector(".viewer-main--split:not(.viewer-main--right)")).not.toHaveClass("is-active");
  expect(screen.getByRole("dialog", { name: "Preview of mapa-01.png" })).toBeInTheDocument();
});

test("desligar o split tira o painel da direita e mantém o mapa da esquerda", () => {
  const { container } = render(<App />);
  openFirstMap(container, "mapa-01");
  fireEvent.click(splitButton());
  fireEvent.click(cellOf("mapa-02").querySelector(".search-live__tile"));
  fireEvent.click(splitButton());
  expect(splitButton()).toHaveAttribute("aria-pressed", "false");
  expect(rightPane()).toBeNull();
  expect(screen.getByRole("dialog", { name: "Preview of mapa-01.png" })).toBeInTheDocument();
});

test("com o split ligado, passar o mouse na lista não faz pré-visualização", () => {
  const { container } = render(<App />);
  openFirstMap(container, "mapa-01");
  fireEvent.click(splitButton());
  fireEvent.mouseEnter(cellOf("mapa-02"));
  expect(document.querySelector(".hover-preview")).toBeNull();
});

test("Esc na busca da coluna limpa o texto e mantém a visualização aberta", () => {
  const { container } = render(<App />);
  openFirstMap(container, "mapa-01");
  const input = viewerColumn().querySelector("input");
  fireEvent.change(input, { target: { value: "mapa" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input).toHaveValue("");
  expect(screen.getByRole("dialog", { name: "Preview of mapa-01.png" })).toBeInTheDocument();
});

test("tela cheia ocupa a janela e esconde a coluna", () => {
  const { container } = render(<App />);
  openFirstMap(container, "mapa-01");
  fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
  expect(viewerColumn()).toBeNull();
  expect(document.querySelector(".modal--full")).not.toBeNull();
});

const viewerModal = () => document.querySelector(".modal--library");
const panelButton = () => screen.getByRole("button", { name: "Maps panel" });

test("a coluna começa aberta; a tecla L fecha e abre a gaveta", () => {
  const { container } = render(<App />);
  openFirstMap(container, "mapa-01");
  expect(viewerModal().classList.contains("is-collapsed")).toBe(false);
  fireEvent.keyDown(document.body, { key: "l" });
  expect(viewerModal().classList.contains("is-collapsed")).toBe(true);
  fireEvent.keyDown(document.body, { key: "L" });
  expect(viewerModal().classList.contains("is-collapsed")).toBe(false);
});

test("o botão da barra da visualização abre e fecha a gaveta", () => {
  const { container } = render(<App />);
  openFirstMap(container, "mapa-01");
  expect(panelButton()).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(panelButton());
  expect(viewerModal().classList.contains("is-collapsed")).toBe(true);
  expect(panelButton()).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(panelButton());
  expect(viewerModal().classList.contains("is-collapsed")).toBe(false);
});

test("digitar L no campo da coluna não fecha a gaveta", () => {
  const { container } = render(<App />);
  openFirstMap(container, "mapa-01");
  const input = viewerColumn().querySelector("input");
  fireEvent.keyDown(input, { key: "l" });
  expect(viewerModal().classList.contains("is-collapsed")).toBe(false);
});

test("L com Ctrl ou Cmd não fecha a gaveta (são atalhos do sistema)", () => {
  const { container } = render(<App />);
  openFirstMap(container, "mapa-01");
  fireEvent.keyDown(document.body, { key: "l", metaKey: true });
  fireEvent.keyDown(document.body, { key: "l", ctrlKey: true });
  expect(viewerModal().classList.contains("is-collapsed")).toBe(false);
});

// Mapa avulso: sem pasta, a janela de visualização abre vazia (tecla V) e recebe o arquivo.
const emptyViewer = () => screen.getByRole("dialog", { name: "Map viewer" });
const fileDrop = (file) => ({
  files: [file],
  items: [{ kind: "file", getAsFile: () => file, webkitGetAsEntry: () => ({ isFile: true, isDirectory: false }) }],
  types: ["Files"],
});
const solo = (name, type = "image/png") => new File(["x"], name, { type });

test("a tecla V abre a janela de visualização vazia, com a área para soltar um mapa", () => {
  render(<App />);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.keyDown(document.body, { key: "v" });
  expect(emptyViewer()).toBeInTheDocument();
  expect(screen.getByText("Drop a map here")).toBeInTheDocument();
});

test("V não abre a janela enquanto se digita no campo de busca, nem com Ctrl ou Cmd", () => {
  render(<App />);
  fireEvent.keyDown(search(), { key: "v" });
  fireEvent.keyDown(document.body, { key: "v", metaKey: true });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("soltar um mapa na janela vazia abre o mapa, sem carregar a pasta dele", () => {
  render(<App />);
  fireEvent.keyDown(document.body, { key: "v" });
  fireEvent.drop(window, { dataTransfer: fileDrop(solo("mapa-solto.png")) });
  expect(screen.getByRole("dialog", { name: "Preview of mapa-solto.png" })).toBeInTheDocument();
  expect(viewerColumn()).toBeNull();
});

test("soltar um mapa na tela inicial também abre a visualização", () => {
  render(<App />);
  fireEvent.drop(window, { dataTransfer: fileDrop(solo("carta.png")) });
  expect(screen.getByRole("dialog", { name: "Preview of carta.png" })).toBeInTheDocument();
});

test("escolher um mapa pelo botão da janela vazia abre o arquivo", () => {
  render(<App />);
  fireEvent.keyDown(document.body, { key: "v" });
  fireEvent.change(document.querySelector('[data-testid="file-input"]'), { target: { files: [solo("escolhido.png")] } });
  expect(screen.getByRole("dialog", { name: "Preview of escolhido.png" })).toBeInTheDocument();
});

test("arquivo que não é mapa não abre a visualização", () => {
  render(<App />);
  fireEvent.drop(window, { dataTransfer: fileDrop(solo("nota.txt", "text/plain")) });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("o botão fechar e o Esc fecham a janela vazia", () => {
  render(<App />);
  fireEvent.keyDown(document.body, { key: "v" });
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.keyDown(document.body, { key: "v" });
  fireEvent.keyDown(document.body, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("com pasta carregada, a janela vazia mostra a coluna de mapas, e L a recolhe", () => {
  const { container } = render(<App />);
  loadFiles(container, SAMPLE());
  fireEvent.keyDown(document.body, { key: "v" });
  expect(viewerColumn()).not.toBeNull();
  fireEvent.keyDown(document.body, { key: "l" });
  expect(viewerModal().classList.contains("is-collapsed")).toBe(true);
});
