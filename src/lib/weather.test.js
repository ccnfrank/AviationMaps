import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMetar, fetchTaf, isValidIcao, normalizeIcao } from "./weather";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("código ICAO", () => {
  it("normaliza espaços e maiúsculas", () => {
    expect(normalizeIcao("  sbsp ")).toBe("SBSP");
    expect(normalizeIcao(undefined)).toBe("");
  });

  it("aceita só quatro letras ou números, em maiúsculas", () => {
    expect(isValidIcao("SBSP")).toBe(true);
    expect(isValidIcao("K1G4")).toBe(true);
    expect(isValidIcao("SBS")).toBe(false);
    expect(isValidIcao("SBSPX")).toBe(false);
    expect(isValidIcao("SB SP")).toBe(false);
    expect(isValidIcao("sbsp")).toBe(false);
  });
});

describe("consulta de METAR e TAF", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("pede o código ao Rust e devolve o primeiro item da lista", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(JSON.stringify([{ icaoId: "SBSP", rawOb: "METAR SBSP" }]));
    expect(await fetchMetar("SBSP")).toEqual({ icaoId: "SBSP", rawOb: "METAR SBSP" });
    expect(invoke).toHaveBeenCalledWith("fetch_metar", { icao: "SBSP" });
  });

  it("corpo vazio (a API não tem dado para o código) devolve null", async () => {
    vi.mocked(invoke).mockResolvedValueOnce("");
    expect(await fetchTaf("ZZZZ")).toBeNull();
    expect(invoke).toHaveBeenCalledWith("fetch_taf", { icao: "ZZZZ" });
  });

  it("lista vazia devolve null", async () => {
    vi.mocked(invoke).mockResolvedValueOnce("[]");
    expect(await fetchMetar("SBSP")).toBeNull();
  });

  it("erro do Rust chega como rejeição", async () => {
    vi.mocked(invoke).mockRejectedValueOnce("HTTP 429 Too Many Requests");
    await expect(fetchMetar("SBSP")).rejects.toBe("HTTP 429 Too Many Requests");
  });
});
