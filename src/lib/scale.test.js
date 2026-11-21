import { describe, expect, it } from "vitest";
import { NM_METERS, formatDistance, groundMeters, parseScale } from "./scale";

describe("escala digitada", () => {
  it("aceita 1:N, só N, e N com separador de milhar", () => {
    expect(parseScale("1:1000000")).toBe(1000000);
    expect(parseScale("1000000")).toBe(1000000);
    expect(parseScale("1:500.000")).toBe(500000);
    expect(parseScale("1:1.000.000")).toBe(1000000);
    expect(parseScale(" 1 : 250000 ")).toBe(250000);
  });

  it("aceita outra proporção: 2:100000 é 1:50000", () => {
    expect(parseScale("2:100000")).toBe(50000);
  });

  it("rejeita vazio, zero, letras e campo incompleto", () => {
    expect(parseScale("")).toBeNull();
    expect(parseScale("1:0")).toBeNull();
    expect(parseScale("0:100")).toBeNull();
    expect(parseScale("abc")).toBeNull();
    expect(parseScale("1:")).toBeNull();
    expect(parseScale(":500000")).toBeNull();
    expect(parseScale(undefined)).toBeNull();
  });
});

describe("medida do mapa em distância real", () => {
  it("3 cm no papel, na escala 1:1.000.000, são 30 km", () => {
    const meters = groundMeters(3, 1000000);
    expect(meters).toBe(30000);
    expect(formatDistance(meters, "land", "en")).toBe("30 km");
  });

  it("trechos curtos em terrestre aparecem em metros", () => {
    expect(formatDistance(groundMeters(1, 50000), "land", "en")).toBe("500 m");
  });

  it("aviação e náutico mostram milhas náuticas", () => {
    expect(formatDistance(10000, "aviation", "en")).toBe("5.4 NM");
    expect(formatDistance(10000, "sea", "en")).toBe("5.4 NM");
    expect(formatDistance(NM_METERS, "aviation", "en")).toBe("1 NM");
  });

  it("sem tipo escolhido, usa metros e quilômetros", () => {
    expect(formatDistance(23456, null, "en")).toBe("23.46 km");
  });

  it("o separador decimal segue o idioma", () => {
    expect(formatDistance(10000, "aviation", "pt")).toBe("5,4 NM");
  });
});
