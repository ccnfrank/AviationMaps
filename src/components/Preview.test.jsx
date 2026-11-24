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
