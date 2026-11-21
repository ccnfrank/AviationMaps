import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setFullscreen } from "./fullscreen";

// jsdom não tem a API de tela cheia: o teste a monta do jeito que o navegador a expõe.
beforeEach(() => {
  document.documentElement.requestFullscreen = vi.fn(() => Promise.resolve());
  document.exitFullscreen = vi.fn(() => Promise.resolve());
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
});

afterEach(() => {
  delete document.requestFullscreen;
  delete document.fullscreenElement;
  delete document.fullscreenEnabled;
});

describe("tela cheia no navegador", () => {
  it("liga a tela cheia da página", async () => {
    await setFullscreen(true);
    expect(document.documentElement.requestFullscreen).toHaveBeenCalled();
  });

  it("desliga quando a página está em tela cheia", async () => {
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: document.documentElement });
    await setFullscreen(false);
    expect(document.exitFullscreen).toHaveBeenCalled();
  });

  it("não faz nada para desligar quando a página não está em tela cheia", async () => {
    await setFullscreen(false);
    expect(document.exitFullscreen).not.toHaveBeenCalled();
  });

  it("uma recusa do navegador não derruba a visualização", async () => {
    document.documentElement.requestFullscreen = vi.fn(() => Promise.reject(new Error("no gesture")));
    await expect(setFullscreen(true)).resolves.toBeUndefined();
  });
});
