import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteRoute, listRoutes, mapKeyOf, saveRoute } from "./savedRoutes";

const KEY = "mapareader.savedRoutes";
const route = (n = 1) => ({
  plots: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, surface: "img", x: i, y: i })),
  winds: [],
});

describe("rotas salvas", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("a chave do mapa vem do nome e do tamanho do arquivo", () => {
    expect(mapKeyOf({ name: "carta.png", size: 2048 })).toBe("carta.png|2048");
    expect(mapKeyOf({ name: "carta.png", size: 2048 })).not.toBe(mapKeyOf({ name: "carta.png", size: 99 }));
  });

  it("começa sem rotas", () => {
    expect(listRoutes("carta.png|1")).toEqual([]);
  });

  it("guarda a rota com o nome e os ajustes das contas, e a devolve na lista do mapa", () => {
    const saved = saveRoute("carta|1", "Ida", {
      ...route(2), declination: "23", declinationSide: "E", scaleText: "1:1000000", mapType: "aviation",
    });
    expect(saved).toMatchObject({
      name: "Ida", mapKey: "carta|1", declination: "23", declinationSide: "E", scaleText: "1:1000000", mapType: "aviation",
    });
    const [first] = listRoutes("carta|1");
    expect(first.name).toBe("Ida");
    expect(first.plots).toHaveLength(2);
  });

  it("sem ajustes informados, usa os padrões: desvio vazio, lado W, sem escala", () => {
    const saved = saveRoute("carta|1", "Simples", route());
    expect(saved).toMatchObject({ declination: "", declinationSide: "W", scaleText: "", mapType: null });
  });

  it("cada mapa vê só as próprias rotas", () => {
    saveRoute("a|1", "Rota A", route());
    saveRoute("b|1", "Rota B", route());
    expect(listRoutes("a|1").map((r) => r.name)).toEqual(["Rota A"]);
    expect(listRoutes("b|1").map((r) => r.name)).toEqual(["Rota B"]);
  });

  it("a lista vem da mais nova para a mais antiga", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    saveRoute("a|1", "Antiga", route());
    vi.setSystemTime(2000);
    saveRoute("a|1", "Nova", route());
    expect(listRoutes("a|1").map((r) => r.name)).toEqual(["Nova", "Antiga"]);
  });

  it("apaga uma rota pelo id e mantém as outras", () => {
    const first = saveRoute("a|1", "A", route());
    saveRoute("a|1", "B", route());
    expect(deleteRoute(first.id)).toBe(true);
    expect(listRoutes("a|1").map((r) => r.name)).toEqual(["B"]);
  });

  it("registros que não têm formato de rota são ignorados", () => {
    localStorage.setItem(KEY, JSON.stringify([{ foo: 1 }, "x", null]));
    expect(listRoutes("a|1")).toEqual([]);
  });

  it("armazenamento com texto inválido não quebra: a lista fica vazia", () => {
    localStorage.setItem(KEY, "{não é json");
    expect(listRoutes("a|1")).toEqual([]);
  });

  it("se o armazenamento recusar a gravação, salvar devolve null e apagar devolve false", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(saveRoute("a|1", "A", route())).toBeNull();
    expect(deleteRoute("qualquer")).toBe(false);
  });
});
