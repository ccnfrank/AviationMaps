import { afterEach, describe, expect, it } from "vitest";
import i18n, { LANGUAGES, readLanguage, setLanguage } from "./index";

describe("idioma", () => {
  afterEach(() => setLanguage("en"));

  it("oferece inglês e português", () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(["en", "pt"]);
  });

  it("troca os textos e guarda a escolha", () => {
    setLanguage("pt");
    expect(i18n.t("app.loadFolder")).toBe("Carregar diretório de mapas");
    expect(localStorage.getItem("mapareader.language")).toBe("pt");
    expect(readLanguage()).toBe("pt");
  });
});
