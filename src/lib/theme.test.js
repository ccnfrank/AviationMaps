import { afterEach, describe, expect, it } from "vitest";
import { applyTheme, readTheme, setTheme } from "./theme";

describe("tema", () => {
  afterEach(() => {
    localStorage.clear();
    applyTheme("night");
  });

  it("começa à noite, o tema escuro", () => {
    expect(readTheme()).toBe("night");
  });

  it("guarda a escolha e liga o tema no html", () => {
    setTheme("day");
    expect(readTheme()).toBe("day");
    expect(document.documentElement.dataset.theme).toBe("day");
  });

  it("ignora um valor guardado inválido", () => {
    localStorage.setItem("mapareader.theme", "blue");
    expect(readTheme()).toBe("night");
  });
});
