import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Modal from "./Modal";

describe("Modal", () => {
  it("prende o Tab dentro da janela: do último botão volta ao primeiro", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">fora</button>
        <Modal label="teste" onClose={() => {}}>
          <button type="button">Close</button>
          <button type="button">meio</button>
          <button type="button">último</button>
        </Modal>
      </>,
    );
    const last = screen.getByRole("button", { name: "último" });
    last.focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "fora" })).not.toHaveFocus();
  });

  it("Shift+Tab no primeiro botão vai ao último, sem sair da janela", async () => {
    const user = userEvent.setup();
    render(
      <Modal label="teste" onClose={() => {}}>
        <button type="button">Close</button>
        <button type="button">último</button>
      </Modal>,
    );
    screen.getByRole("button", { name: "Close" }).focus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "último" })).toHaveFocus();
  });

  it("Esc fecha a janela", () => {
    const onClose = vi.fn();
    render(<Modal label="teste" onClose={onClose}><button type="button">x</button></Modal>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
