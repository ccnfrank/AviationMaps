import { render, screen, fireEvent } from "@testing-library/react";
import SplitDivider from "./SplitDivider";

// O jsdom não calcula layout: os dois painéis vizinhos da linha ganham uma posição fixa.
// Área total: de x=0 a x=800, com cada painel de 400 px.
const rect = (x, width) => ({ left: x, right: x + width, width, top: 0, bottom: 100, height: 100, x, y: 0 });

function setup(ratio = 0.5) {
  const onRatio = vi.fn();
  const { container } = render(
    <div>
      <div className="left" />
      <SplitDivider ratio={ratio} onRatio={onRatio} />
      <div className="right" />
    </div>,
  );
  container.querySelector(".left").getBoundingClientRect = () => rect(0, 400);
  container.querySelector(".right").getBoundingClientRect = () => rect(400, 400);
  return { onRatio, divider: screen.getByRole("separator", { name: "Resize the panes" }) };
}

test("arrastar a linha muda a divisão pela posição do mouse", () => {
  const { onRatio, divider } = setup();
  fireEvent.mouseDown(divider, { clientX: 400, button: 0 });
  fireEvent.mouseMove(window, { clientX: 200 });
  expect(onRatio).toHaveBeenLastCalledWith(0.25);
  fireEvent.mouseMove(window, { clientX: 600 });
  expect(onRatio).toHaveBeenLastCalledWith(0.75);
  fireEvent.mouseUp(window);
  onRatio.mockClear();
  fireEvent.mouseMove(window, { clientX: 100 });
  expect(onRatio).not.toHaveBeenCalled();
});

test("nenhum painel fica menor que 200 px, mesmo arrastando além", () => {
  const { onRatio, divider } = setup();
  fireEvent.mouseDown(divider, { clientX: 400, button: 0 });
  fireEvent.mouseMove(window, { clientX: 0 });
  expect(onRatio).toHaveBeenLastCalledWith(0.25); // 200 px de 800
  fireEvent.mouseMove(window, { clientX: 800 });
  expect(onRatio).toHaveBeenLastCalledWith(0.75);
  fireEvent.mouseUp(window);
});

test("as setas do teclado movem a divisão de 5 em 5 pontos", () => {
  const { onRatio, divider } = setup(0.5);
  fireEvent.keyDown(divider, { key: "ArrowRight" });
  expect(onRatio.mock.calls.at(-1)[0]).toBeCloseTo(0.55);
  fireEvent.keyDown(divider, { key: "ArrowLeft" });
  expect(onRatio.mock.calls.at(-1)[0]).toBeCloseTo(0.45);
});

test("duplo clique volta ao meio", () => {
  const { onRatio, divider } = setup(0.3);
  fireEvent.doubleClick(divider);
  expect(onRatio).toHaveBeenLastCalledWith(0.5);
});

test("a linha informa a divisão atual para o leitor de tela", () => {
  const { divider } = setup(0.3);
  expect(divider).toHaveAttribute("aria-valuenow", "30");
  expect(divider).toHaveAttribute("aria-orientation", "vertical");
});
