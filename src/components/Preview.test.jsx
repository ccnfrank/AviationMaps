import { render, screen, fireEvent, within } from "@testing-library/react";
import Preview from "./Preview";

const entry = (name, content = "x") => ({
  name, size: content.length || 10, file: new File([content], name),
});
const nav = { hasPrev: true, hasNext: true, onPrev: () => {}, onNext: () => {}, onClose: () => {} };

test("imagem aparece num <img>", async () => {
  render(<Preview entry={entry("capa.png")} {...nav} />);
  expect(await screen.findByRole("img", { name: "capa.png" })).toHaveAttribute("src", "blob:mock");
});

test("PDF é desenhado com pdf.js, não com iframe", () => {
  const { container } = render(<Preview entry={entry("manual.pdf")} {...nav} />);
  expect(container.querySelector("iframe")).toBeNull();
  expect(container.querySelector(".pdf-pages")).not.toBeNull();
});

test("formato sem pré-visualização explica", () => {
  render(<Preview entry={entry("roteiro.docx")} {...nav} />);
  expect(screen.getByText("No preview for this file type.")).toBeInTheDocument();
  expect(screen.queryByRole("toolbar")).toBeNull();
});

test("setas do teclado navegam", () => {
  const onNext = vi.fn();
  render(<Preview entry={entry("a.png")} {...nav} onNext={onNext} />);
  fireEvent.keyDown(document, { key: "ArrowRight" });
  expect(onNext).toHaveBeenCalled();
});

test("nome e tamanho aparecem na barra de navegação, sem botão de renomear", () => {
  render(<Preview entry={entry("capa.png", "x".repeat(2048))} {...nav} />);
  expect(screen.getByText("capa.png")).toBeInTheDocument();
  expect(screen.getByText("2.0 KB")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();
});

// Zoom e brilho não têm slider: mudam pelo teclado. + e − mudam o zoom; Alt + e − mudam o brilho.
afterEach(() => vi.restoreAllMocks());

// O jsdom não calcula layout: dá tamanho à área e à imagem, para o zoom virar largura em pixels.
async function renderImage() {
  vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(800);
  vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(600);
  render(<Preview entry={entry("capa.png")} {...nav} />);
  const img = await screen.findByRole("img", { name: "capa.png" });
  Object.defineProperty(img, "naturalWidth", { value: 800 });
  Object.defineProperty(img, "naturalHeight", { value: 600 });
  fireEvent.load(img);
  return img;
}
const stageWidth = () => document.querySelector(".measure-box").style.width;

test("zoom e brilho não aparecem como sliders, nem em foto nem em PDF", () => {
  const { unmount } = render(<Preview entry={entry("capa.png")} {...nav} />);
  expect(screen.queryByRole("slider")).toBeNull();
  unmount();

  render(<Preview entry={entry("mapa.pdf")} {...nav} />);
  expect(screen.queryByRole("slider")).toBeNull();
});

test("+ e − mudam o zoom de meio em meio, sem passar de 100% nem de 600%", async () => {
  await renderImage();
  expect(stageWidth()).toBe("800px");
  fireEvent.keyDown(document, { key: "+" });
  expect(stageWidth()).toBe("1200px"); // 150%
  fireEvent.keyDown(document, { key: "=" });
  expect(stageWidth()).toBe("1600px"); // 200%
  fireEvent.keyDown(document, { key: "-" });
  fireEvent.keyDown(document, { key: "-" });
  fireEvent.keyDown(document, { key: "-" });
  expect(stageWidth()).toBe("800px"); // 100%, não desce mais
  for (let i = 0; i < 20; i++) fireEvent.keyDown(document, { key: "+" });
  expect(stageWidth()).toBe("4800px"); // 600%
});

test("Cmd + e Alt + + não mexem no zoom (Cmd é do navegador, Alt é do brilho)", async () => {
  await renderImage();
  fireEvent.keyDown(document, { key: "+", metaKey: true });
  fireEvent.keyDown(document, { key: "=", code: "Equal", altKey: true });
  expect(stageWidth()).toBe("800px");
});

test("Alt + + e Alt + − mudam o brilho de 5 em 5, entre 50% e 150%, sem mexer no zoom", async () => {
  const img = await renderImage();
  expect(img.style.filter).toBe("brightness(1)");
  fireEvent.keyDown(document, { key: "=", code: "Equal", altKey: true });
  expect(img.style.filter).toBe("brightness(1.05)");
  fireEvent.keyDown(document, { key: "-", code: "Minus", altKey: true });
  fireEvent.keyDown(document, { key: "-", code: "Minus", altKey: true });
  expect(img.style.filter).toBe("brightness(0.95)");
  for (let i = 0; i < 20; i++) fireEvent.keyDown(document, { key: "-", code: "Minus", altKey: true });
  expect(img.style.filter).toBe("brightness(0.5)");
  for (let i = 0; i < 40; i++) fireEvent.keyDown(document, { key: "=", code: "Equal", altKey: true });
  expect(img.style.filter).toBe("brightness(1.5)");
  expect(stageWidth()).toBe("800px");
});

test("transferidor e medir ficam na barra da visualização", () => {
  render(<Preview entry={entry("capa.png")} {...nav} />);
  const bar = screen.getByRole("toolbar", { name: "Viewer tools" });
  expect(within(bar).getByRole("button", { name: "Protractor" })).toBeInTheDocument();
  expect(within(bar).getByRole("button", { name: "Measure" })).toBeInTheDocument();
});

test("medir é só um botão de ícone: ligar não abre painel, e calibrar aparece só em imagem", () => {
  render(<Preview entry={entry("capa.png")} {...nav} />);
  const measure = screen.getByRole("button", { name: "Measure" });
  expect(screen.queryByRole("group", { name: "Measurement tools" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Calibrate scale" })).toBeNull();
  fireEvent.click(measure);
  expect(screen.queryByRole("group", { name: "Measurement tools" })).toBeNull();
  expect(screen.getByRole("button", { name: "Calibrate scale" })).toBeInTheDocument();
});

test("PDF não pede calibração: a escala é exata", () => {
  render(<Preview entry={entry("manual.pdf")} {...nav} />);
  fireEvent.click(screen.getByRole("button", { name: "Measure" }));
  expect(screen.queryByRole("button", { name: "Calibrate scale" })).toBeNull();
});

test("campo do desvio fica logo à direita do transferidor, antes do medir", () => {
  render(<Preview entry={entry("capa.png")} {...nav} />);
  const protractor = screen.getByRole("button", { name: "Protractor" });
  const field = screen.getByRole("textbox", { name: "Magnetic declination in degrees" });
  const measure = screen.getByRole("button", { name: "Measure" });
  expect(protractor.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(field.compareDocumentPosition(measure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("transferidor fica à esquerda do medir, e os dois se desligam ao ligar um", () => {
  render(<Preview entry={entry("capa.png")} {...nav} />);
  const protractor = screen.getByRole("button", { name: "Protractor" });
  const measure = screen.getByRole("button", { name: "Measure" });
  expect(protractor.compareDocumentPosition(measure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(protractor);
  expect(protractor).toHaveAttribute("aria-pressed", "true");
  expect(measure).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(measure);
  expect(measure).toHaveAttribute("aria-pressed", "true");
  expect(protractor).toHaveAttribute("aria-pressed", "false");
});

test("botão de tela cheia só aparece quando a janela oferece a opção", () => {
  const { unmount } = render(<Preview entry={entry("capa.png")} {...nav} />);
  expect(screen.queryByRole("button", { name: "Full screen" })).toBeNull();
  unmount();
});

test("tela cheia alterna o botão entre entrar e sair", () => {
  const onToggleFullscreen = vi.fn();
  const { rerender } = render(<Preview entry={entry("capa.png")} {...nav} onToggleFullscreen={onToggleFullscreen} />);
  const enter = screen.getByRole("button", { name: "Full screen" });
  fireEvent.click(enter);
  expect(onToggleFullscreen).toHaveBeenCalledTimes(1);

  rerender(<Preview entry={entry("capa.png")} {...nav} onToggleFullscreen={onToggleFullscreen} fullscreen />);
  expect(screen.getByRole("button", { name: "Exit full screen" })).toHaveAttribute("aria-pressed", "true");
});

test("vento: liga pelo ícone e desliga ao ligar medir", () => {
  render(<Preview entry={entry("capa.png")} {...nav} />);
  const wind = screen.getByRole("button", { name: "Wind" });
  fireEvent.click(wind);
  expect(wind).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Measure" }));
  expect(wind).toHaveAttribute("aria-pressed", "false");
});

test("vento + TAS: o trecho da rota mostra a proa corrigida e a velocidade sobre o solo", async () => {
  const { container } = render(<Preview entry={entry("capa.png")} {...nav} />);
  const img = await screen.findByRole("img", { name: "capa.png" });
  Object.defineProperty(img, "naturalWidth", { value: 800 });
  Object.defineProperty(img, "naturalHeight", { value: 600 });
  fireEvent.load(img);
  const svg = container.querySelector("svg.measure-layer");
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

  // Dois pontos plotados, A → B, leste.
  fireEvent.click(screen.getByRole("button", { name: "Plot points" }));
  fireEvent.pointerDown(svg, { clientX: 100, clientY: 300, button: 0 });
  fireEvent.pointerDown(svg, { clientX: 700, clientY: 300, button: 0 });

  // Vento de norte, 20 kt, plotado no meio do trecho; TAS de 120 kt.
  fireEvent.click(screen.getByRole("button", { name: "Wind" }));
  fireEvent.pointerDown(svg, { clientX: 400, clientY: 300, button: 0 });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Wind direction, in degrees, where it comes from" }), { target: { value: "0" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Wind speed" }), { target: { value: "20" } });
  fireEvent.click(screen.getByRole("button", { name: "Add wind" }));
  fireEvent.change(screen.getByRole("textbox", { name: "True airspeed (TAS)" }), { target: { value: "120" } });

  // Rumo 090°, proa 080° (vento cruzado de norte). A velocidade sobre o solo não aparece no mapa.
  expect(screen.getByText(/090° · HDG 080°/)).toBeInTheDocument();
  expect(screen.queryByText(/GS/)).toBeNull();
});

test("vento sem TAS: a rota pede a TAS, em vez de mostrar uma proa", async () => {
  const { container } = render(<Preview entry={entry("capa.png")} {...nav} />);
  const img = await screen.findByRole("img", { name: "capa.png" });
  Object.defineProperty(img, "naturalWidth", { value: 800 });
  Object.defineProperty(img, "naturalHeight", { value: 600 });
  fireEvent.load(img);
  const svg = container.querySelector("svg.measure-layer");
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

  fireEvent.click(screen.getByRole("button", { name: "Plot points" }));
  fireEvent.pointerDown(svg, { clientX: 100, clientY: 300, button: 0 });
  fireEvent.pointerDown(svg, { clientX: 700, clientY: 300, button: 0 });
  fireEvent.click(screen.getByRole("button", { name: "Wind" }));
  fireEvent.pointerDown(svg, { clientX: 400, clientY: 300, button: 0 });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Wind direction, in degrees, where it comes from" }), { target: { value: "0" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Wind speed" }), { target: { value: "20" } });
  fireEvent.click(screen.getByRole("button", { name: "Add wind" }));

  expect(screen.getByText(/type TAS for heading/)).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "True airspeed (TAS)" }).closest(".tas")).toHaveClass("is-needed");
});

test("vento magnético: com a declinação, a rota converte para verdadeiro antes da proa", async () => {
  const { container } = render(<Preview entry={entry("capa.png")} {...nav} />);
  const img = await screen.findByRole("img", { name: "capa.png" });
  Object.defineProperty(img, "naturalWidth", { value: 800 });
  Object.defineProperty(img, "naturalHeight", { value: 600 });
  fireEvent.load(img);
  const svg = container.querySelector("svg.measure-layer");
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

  fireEvent.click(screen.getByRole("button", { name: "Plot points" }));
  fireEvent.pointerDown(svg, { clientX: 100, clientY: 300, button: 0 });
  fireEvent.pointerDown(svg, { clientX: 700, clientY: 300, button: 0 });
  fireEvent.click(screen.getByRole("button", { name: "Wind" }));
  fireEvent.pointerDown(svg, { clientX: 400, clientY: 300, button: 0 });
  // Vento magnético de 040°, declinação +10°: verdadeiro = 030°. Com 20 kt e TAS 100 kt, a proa é 080°.
  fireEvent.click(screen.getByRole("button", { name: "Magnetic wind (off = true)" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "Wind direction, in degrees, where it comes from" }), { target: { value: "40" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Wind speed" }), { target: { value: "20" } });
  fireEvent.click(screen.getByRole("button", { name: "Add wind" }));
  fireEvent.change(screen.getByRole("textbox", { name: "True airspeed (TAS)" }), { target: { value: "100" } });
  // Sem declinação, a rota pede a declinação.
  expect(screen.getByText(/type declination for magnetic wind/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Magnetic declination in degrees" }), { target: { value: "10" } });
  expect(screen.getByText(/HDG 080°/)).toBeInTheDocument();
});

test("rumo 120 com vento de 240° a 20 kt e TAS 120 kt: o bico do avião aponta para 128°, não para 120°", async () => {
  const { container } = render(<Preview entry={entry("capa.png")} {...nav} />);
  const img = await screen.findByRole("img", { name: "capa.png" });
  Object.defineProperty(img, "naturalWidth", { value: 800 });
  Object.defineProperty(img, "naturalHeight", { value: 600 });
  fireEvent.load(img);
  const svg = container.querySelector("svg.measure-layer");
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

  // A → B no rumo 120 (para baixo e à direita), com o vento plotado no meio do trecho.
  fireEvent.click(screen.getByRole("button", { name: "Plot points" }));
  fireEvent.pointerDown(svg, { clientX: 300, clientY: 200, button: 0 });
  fireEvent.pointerDown(svg, { clientX: 646, clientY: 400, button: 0 });
  fireEvent.click(screen.getByRole("button", { name: "Wind" }));
  fireEvent.pointerDown(svg, { clientX: 523, clientY: 300, button: 0 });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Wind direction, in degrees, where it comes from" }), { target: { value: "240" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Wind speed" }), { target: { value: "20" } });
  fireEvent.click(screen.getByRole("button", { name: "Add wind" }));
  fireEvent.change(screen.getByRole("textbox", { name: "True airspeed (TAS)" }), { target: { value: "120" } });

  const plane = container.querySelector(".route-plane");
  expect(plane).not.toBeNull();
  expect(plane.getAttribute("transform")).toMatch(/rotate\(128\.\d+\)/);
  expect(plane.getAttribute("transform")).not.toMatch(/rotate\(120/);
});

test("o nariz do avião mostra o grau: rumo, depois com declinação, depois com a proa corrigida", async () => {
  const { container } = render(<Preview entry={entry("capa.png")} {...nav} />);
  const img = await screen.findByRole("img", { name: "capa.png" });
  Object.defineProperty(img, "naturalWidth", { value: 800 });
  Object.defineProperty(img, "naturalHeight", { value: 600 });
  fireEvent.load(img);
  const svg = container.querySelector("svg.measure-layer");
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

  // Dois pontos no rumo 130°: o nariz aponta para 130°.
  fireEvent.click(screen.getByRole("button", { name: "Plot points" }));
  fireEvent.pointerDown(svg, { clientX: 300, clientY: 200, button: 0 });
  fireEvent.pointerDown(svg, { clientX: 606, clientY: 457, button: 0 });
  expect(container.querySelector(".nose-label").textContent).toBe("130°");

  // Declinação de +10°: o nariz passa a 140° magnético.
  fireEvent.change(screen.getByRole("textbox", { name: "Magnetic declination in degrees" }), { target: { value: "10" } });
  expect(container.querySelector(".nose-label").textContent).toBe("140°");
});

test("duplo clique no rumo abre o campo; Enter corrige o rumo e o segundo ponto anda sobre a nova direção", async () => {
  const { container } = render(<Preview entry={entry("capa.png")} {...nav} />);
  const img = await screen.findByRole("img", { name: "capa.png" });
  Object.defineProperty(img, "naturalWidth", { value: 800 });
  Object.defineProperty(img, "naturalHeight", { value: 600 });
  fireEvent.load(img);
  const svg = container.querySelector("svg.measure-layer");
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

  // Dois pontos no rumo 130°.
  fireEvent.click(screen.getByRole("button", { name: "Plot points" }));
  fireEvent.pointerDown(svg, { clientX: 300, clientY: 200, button: 0 });
  fireEvent.pointerDown(svg, { clientX: 606, clientY: 457, button: 0 });
  expect(container.querySelector(".route-label--track").textContent).toBe("130°");

  // Duplo clique no grau, corrige para 090°.
  fireEvent.doubleClick(container.querySelector(".route-label--track"));
  const field = container.querySelector(".route-edit");
  expect(field.value).toBe("130");
  fireEvent.change(field, { target: { value: "090" } });
  fireEvent.keyDown(field, { key: "Enter" });

  expect(container.querySelector(".route-label--track").textContent).toBe("090°");
  expect(container.querySelector(".route-edit")).toBeNull();
});

test("Esc no campo do rumo cancela a correção", async () => {
  const { container } = render(<Preview entry={entry("capa.png")} {...nav} />);
  const img = await screen.findByRole("img", { name: "capa.png" });
  Object.defineProperty(img, "naturalWidth", { value: 800 });
  Object.defineProperty(img, "naturalHeight", { value: 600 });
  fireEvent.load(img);
  const svg = container.querySelector("svg.measure-layer");
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
  fireEvent.click(screen.getByRole("button", { name: "Plot points" }));
  fireEvent.pointerDown(svg, { clientX: 300, clientY: 200, button: 0 });
  fireEvent.pointerDown(svg, { clientX: 606, clientY: 457, button: 0 });

  fireEvent.doubleClick(container.querySelector(".route-label--track"));
  const field = container.querySelector(".route-edit");
  fireEvent.change(field, { target: { value: "010" } });
  fireEvent.keyDown(field, { key: "Escape" });
  expect(container.querySelector(".route-label--track").textContent).toBe("130°");
});

test("duplo clique na seta de vento abre a correção: direção, velocidade e TAS", async () => {
  const { container } = render(<Preview entry={entry("capa.png")} {...nav} />);
  const img = await screen.findByRole("img", { name: "capa.png" });
  Object.defineProperty(img, "naturalWidth", { value: 800 });
  Object.defineProperty(img, "naturalHeight", { value: 600 });
  fireEvent.load(img);
  const svg = container.querySelector("svg.measure-layer");
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

  fireEvent.click(screen.getByRole("button", { name: "Wind" }));
  fireEvent.pointerDown(svg, { clientX: 400, clientY: 300, button: 0 });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Wind direction, in degrees, where it comes from" }), { target: { value: "270" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Wind speed" }), { target: { value: "15" } });
  fireEvent.click(screen.getByRole("button", { name: "Add wind" }));
  expect(container.querySelector(".wind-label").textContent).toBe("270° · 15 kt");

  // Duplo clique na seta abre a correção, já preenchida.
  fireEvent.doubleClick(container.querySelector(".wind-arrow"));
  const form = container.querySelector(".wind-form");
  expect(form).not.toBeNull();
  const [dir, speed, tas] = form.querySelectorAll("input");
  expect(dir.value).toBe("270");
  expect(speed.value).toBe("15");

  // Corrige direção, velocidade e TAS, e confirma.
  fireEvent.change(dir, { target: { value: "90" } });
  fireEvent.change(speed, { target: { value: "30" } });
  fireEvent.change(tas, { target: { value: "120" } });
  fireEvent.submit(form);

  expect(container.querySelector(".wind-label").textContent).toBe("090° · 30 kt");
  expect(container.querySelector(".wind-form")).toBeNull();
  expect(screen.getByRole("textbox", { name: "True airspeed (TAS)" })).toHaveValue("120");
});

test("duplo clique no rótulo do vento também corrige; Esc cancela sem mudar a seta", async () => {
  const { container } = render(<Preview entry={entry("capa.png")} {...nav} />);
  const img = await screen.findByRole("img", { name: "capa.png" });
  Object.defineProperty(img, "naturalWidth", { value: 800 });
  Object.defineProperty(img, "naturalHeight", { value: 600 });
  fireEvent.load(img);
  const svg = container.querySelector("svg.measure-layer");
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

  fireEvent.click(screen.getByRole("button", { name: "Wind" }));
  fireEvent.pointerDown(svg, { clientX: 400, clientY: 300, button: 0 });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Wind direction, in degrees, where it comes from" }), { target: { value: "270" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Wind speed" }), { target: { value: "15" } });
  fireEvent.click(screen.getByRole("button", { name: "Add wind" }));

  fireEvent.doubleClick(container.querySelector(".wind-label"));
  const form = container.querySelector(".wind-form");
  fireEvent.change(form.querySelectorAll("input")[0], { target: { value: "10" } });
  fireEvent.keyDown(form, { key: "Escape" });
  expect(container.querySelector(".wind-form")).toBeNull();
  expect(container.querySelector(".wind-label").textContent).toBe("270° · 15 kt");
});

test("duplo clique no ponto plotado abre o nome; Enter renomeia e nome vazio volta ao número", async () => {
  const { container } = render(<Preview entry={entry("capa.png")} {...nav} />);
  const img = await screen.findByRole("img", { name: "capa.png" });
  Object.defineProperty(img, "naturalWidth", { value: 800 });
  Object.defineProperty(img, "naturalHeight", { value: 600 });
  fireEvent.load(img);
  const svg = container.querySelector("svg.measure-layer");
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
  fireEvent.click(screen.getByRole("button", { name: "Plot points" }));
  fireEvent.pointerDown(svg, { clientX: 100, clientY: 300, button: 0 });
  fireEvent.pointerDown(svg, { clientX: 700, clientY: 300, button: 0 });

  const markers = () => [...container.querySelectorAll(".plot-marker")].map((m) => m.textContent);
  expect(markers()).toEqual(["1", "2"]);

  fireEvent.doubleClick(container.querySelectorAll(".plot-marker")[0]);
  const field = container.querySelector(".plot-edit");
  expect(field.value).toBe("1");
  fireEvent.change(field, { target: { value: "ALFA" } });
  fireEvent.keyDown(field, { key: "Enter" });
  expect(markers()).toEqual(["ALFA", "2"]);

  // Nome vazio volta ao número.
  fireEvent.doubleClick(container.querySelectorAll(".plot-marker")[0]);
  fireEvent.change(container.querySelector(".plot-edit"), { target: { value: "" } });
  fireEvent.keyDown(container.querySelector(".plot-edit"), { key: "Enter" });
  expect(markers()).toEqual(["1", "2"]);
});

test("exportar rota: o botão aparece com dois pontos e salva um CSV", async () => {
  const createURL = vi.fn(() => "blob:route");
  vi.stubGlobal("URL", { ...URL, createObjectURL: createURL, revokeObjectURL: vi.fn() });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const { container } = render(<Preview entry={entry("capa.png")} {...nav} />);
  const img = await screen.findByRole("img", { name: "capa.png" });
  Object.defineProperty(img, "naturalWidth", { value: 800 });
  Object.defineProperty(img, "naturalHeight", { value: 600 });
  fireEvent.load(img);
  const svg = container.querySelector("svg.measure-layer");
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });

  expect(screen.queryByRole("button", { name: "Export route (CSV)" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Plot points" }));
  fireEvent.pointerDown(svg, { clientX: 300, clientY: 200, button: 0 });
  fireEvent.pointerDown(svg, { clientX: 606, clientY: 457, button: 0 });
  const before = createURL.mock.calls.length; // a própria imagem também usa createObjectURL
  fireEvent.click(screen.getByRole("button", { name: "Export route (CSV)" }));

  await vi.waitFor(() => expect(click).toHaveBeenCalled());
  expect(createURL.mock.calls.length).toBe(before + 1);
  expect(createURL.mock.calls.at(-1)[0].size).toBeGreaterThan(0);
  vi.unstubAllGlobals();
  click.mockRestore();
});
