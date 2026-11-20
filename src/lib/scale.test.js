import { describe, expect, it } from "vitest";
import { NM_METERS, groundMeters, parseScale, scaleReadout } from "./scale";

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

describe("1 cm no mapa em distância real", () => {
  it("1:1.000.000 → 1 cm = 10 km (o exemplo do pedido)", () => {
    expect(groundMeters(1, 1000000)).toBe(10000);
    expect(scaleReadout(1000000, "land")).toEqual({
      primary: { value: 10, unit: "km" },
      secondary: null,
    });
  });

  it("terrestre usa metros em trechos curtos", () => {
    expect(scaleReadout(50000, "land").primary).toEqual({ value: 500, unit: "m" });
  });

  it("aviação e náutico mostram milhas náuticas, com quilômetros ao lado", () => {
    const aviation = scaleReadout(1000000, "aviation");
    expect(aviation.primary.unit).toBe("NM");
    expect(aviation.primary.value).toBeCloseTo(10000 / NM_METERS);
    expect(aviation.secondary).toEqual({ value: 10, unit: "km" });
    expect(scaleReadout(500000, "sea").primary.value).toBeCloseTo(5000 / NM_METERS);
  });
});
