import { describe, expect, it } from "vitest";
import { angleOf } from "./measure";
import { distanceNm, formatBearing, routeLinks } from "./route";

const p = (id, surface, x, y) => ({ id, surface, x, y });

describe("routeLinks (rota pela ordem de plotagem)", () => {
  it("liga pontos seguidos da mesma superfície, na ordem em que foram plotados", () => {
    const plots = [p("a", "img", 0, 0), p("b", "img", 100, 0), p("c", "img", 100, 100)];
    expect(routeLinks(plots, "img").map((l) => l.key)).toEqual(["a>b", "b>c"]);
  });

  it("trocar de página quebra a rota: não liga pontos de superfícies diferentes", () => {
    const plots = [p("a", "pdf:0", 0, 0), p("b", "img", 100, 0), p("c", "img", 100, 100), p("d", "pdf:0", 50, 50)];
    expect(routeLinks(plots, "img").map((l) => l.key)).toEqual(["b>c"]);
    expect(routeLinks(plots, "pdf:0")).toEqual([]);
  });

  it("dois cliques no mesmo lugar não formam trecho", () => {
    expect(routeLinks([p("a", "img", 5, 5), p("b", "img", 5, 5)], "img")).toEqual([]);
  });

  it("o comprimento do trecho vem em unidades da superfície", () => {
    const [link] = routeLinks([p("a", "img", 0, 0), p("b", "img", 30, 40)], "img");
    expect(link.px).toBeCloseTo(50);
  });
});

describe("distanceNm (milhas náuticas a partir da escala)", () => {
  it("1 cm no papel, na escala 1:1.000.000, são 10 km: uns 5,4 nm", () => {
    expect(distanceNm(1, 1, 1000000)).toBeCloseTo(10000 / 1852, 6);
  });

  it("sem escala do mapa ou sem resolução da superfície, não há distância", () => {
    expect(distanceNm(10, null, 1000000)).toBeNull();
    expect(distanceNm(10, 0.01, null)).toBeNull();
  });
});

describe("rumo", () => {
  it("norte é 000°, leste 090°, sul 180° e oeste 270° (norte para cima na tela)", () => {
    const origin = { x: 0, y: 0 };
    expect(formatBearing(angleOf(origin, { x: 0, y: -10 }))).toBe("000°");
    expect(formatBearing(angleOf(origin, { x: 10, y: 0 }))).toBe("090°");
    expect(formatBearing(angleOf(origin, { x: 0, y: 10 }))).toBe("180°");
    expect(formatBearing(angleOf(origin, { x: -10, y: 0 }))).toBe("270°");
  });

  it("três dígitos, e 359,6° arredonda para 000°", () => {
    expect(formatBearing(45.4)).toBe("045°");
    expect(formatBearing(359.6)).toBe("000°");
  });
});
