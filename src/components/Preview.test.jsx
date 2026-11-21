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

test("zoom aparece para foto e PDF", () => {
  const { unmount } = render(<Preview entry={entry("capa.png")} {...nav} />);
  expect(screen.getByRole("slider", { name: "Zoom" })).toBeInTheDocument();
  unmount();

  render(<Preview entry={entry("mapa.pdf")} {...nav} />);
  expect(screen.getByRole("slider", { name: "Zoom" })).toBeInTheDocument();
});

const zoomGroup = () => screen.getByRole("group", { name: "Zoom" });

test("o slider de zoom muda a porcentagem mostrada", () => {
  render(<Preview entry={entry("capa.png")} {...nav} />);
  const slider = screen.getByRole("slider", { name: "Zoom" });
  expect(within(zoomGroup()).getByText("100%")).toBeInTheDocument();
  fireEvent.change(slider, { target: { value: "2.5" } });
  expect(within(zoomGroup()).getByText("250%")).toBeInTheDocument();
});

test("botões + e − andam de meio em meio, e restaurar volta a 100%", () => {
  render(<Preview entry={entry("capa.png")} {...nav} />);
  const minus = screen.getByRole("button", { name: "Zoom out" });
  const plus = screen.getByRole("button", { name: "Zoom in" });
  const reset = screen.getByRole("button", { name: "Reset zoom" });
  expect(minus).toBeDisabled();
  expect(reset).toBeDisabled();
  fireEvent.click(plus);
  expect(within(zoomGroup()).getByText("150%")).toBeInTheDocument();
  fireEvent.click(plus);
  expect(within(zoomGroup()).getByText("200%")).toBeInTheDocument();
  expect(reset).toBeEnabled();
  fireEvent.click(reset);
  expect(within(zoomGroup()).getByText("100%")).toBeInTheDocument();
  expect(minus).toBeDisabled();
});

test("o +/- do zoom não passa de 600%", () => {
  render(<Preview entry={entry("capa.png")} {...nav} />);
  const plus = screen.getByRole("button", { name: "Zoom in" });
  for (let i = 0; i < 20; i++) fireEvent.click(plus);
  expect(within(zoomGroup()).getByText("600%")).toBeInTheDocument();
  expect(plus).toBeDisabled();
});

test("brilho: + e − andam de 5 em 5, chegam a 75%, respeitam o limite e restaurar volta a 100%", () => {
  render(<Preview entry={entry("capa.png")} {...nav} />);
  const group = within(screen.getByRole("group", { name: "Brightness" }));
  const minus = group.getByRole("button", { name: "Darken" });
  const plus = group.getByRole("button", { name: "Brighten" });
  const reset = group.getByRole("button", { name: "Reset brightness" });
  expect(reset).toBeDisabled();
  fireEvent.click(plus);
  expect(group.getByText("105%")).toBeInTheDocument();
  fireEvent.click(minus);
  fireEvent.click(minus);
  expect(group.getByText("95%")).toBeInTheDocument();
  expect(reset).toBeEnabled();
  for (let i = 0; i < 4; i++) fireEvent.click(minus);
  expect(group.getByText("75%")).toBeInTheDocument();
  for (let i = 0; i < 5; i++) fireEvent.click(minus);
  expect(group.getByText("50%")).toBeInTheDocument();
  expect(minus).toBeDisabled();
  fireEvent.click(reset);
  expect(group.getByText("100%")).toBeInTheDocument();
  expect(reset).toBeDisabled();
  for (let i = 0; i < 20; i++) fireEvent.click(plus);
  expect(group.getByText("150%")).toBeInTheDocument();
  expect(plus).toBeDisabled();
});

test("transferidor, medir, brilho e zoom ficam na mesma barra", () => {
  render(<Preview entry={entry("capa.png")} {...nav} />);
  const bar = screen.getByRole("toolbar", { name: "Viewer tools" });
  expect(within(bar).getByRole("button", { name: "Protractor" })).toBeInTheDocument();
  expect(within(bar).getByRole("button", { name: "Measure" })).toBeInTheDocument();
  expect(within(bar).getByRole("group", { name: "Brightness" })).toBeInTheDocument();
  expect(within(bar).getByRole("group", { name: "Zoom" })).toBeInTheDocument();
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
