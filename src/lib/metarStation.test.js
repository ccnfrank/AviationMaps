import { describe, expect, it } from "vitest";
import { barbGeometry, calloutSide, flightCategoryClass, skyFraction, skyPath, stationFromMetar, windBarb, wrapRaw } from "./metarStation";

const METAR = {
  icaoId: "SBSP",
  rawOb: "METAR SBSP 270800Z AUTO 14006KT 9999 FEW022 BKN032 17/16 Q1021",
  fltCat: "VFR",
  wdir: 140,
  wspd: 6,
  cover: "BKN",
  clouds: [{ cover: "FEW", base: 2200 }, { cover: "BKN", base: 3200 }],
  temp: 17,
  name: "Sao Paulo/Congonhas, SP, BR",
};

describe("estação do METAR", () => {
  it("copia só o que o desenho usa, do METAR naquele momento", () => {
    expect(stationFromMetar(METAR)).toEqual({
      icao: "SBSP",
      raw: METAR.rawOb,
      fltCat: "VFR",
      wdir: 140,
      wspd: 6,
      cover: "BKN",
      clouds: [{ cover: "FEW", base: 2200 }, { cover: "BKN", base: 3200 }],
    });
  });

  it("a cobertura é a da camada mais densa", () => {
    expect(skyFraction({ cover: "BKN", clouds: [{ cover: "FEW", base: 2200 }] })).toBe(0.75);
    expect(skyFraction({ cover: null, clouds: [{ cover: "SCT", base: 900 }] })).toBe(0.5);
    expect(skyFraction({ cover: null, clouds: [{ cover: "FEW", base: 900 }, { cover: "OVC", base: 3000 }] })).toBe(1);
    expect(skyFraction({ cover: "CLR", clouds: [] })).toBe(0);
    expect(skyFraction({ cover: null, clouds: [] })).toBe(0);
  });

  it("categoria de voo vira a classe de cor; desconhecida vira none", () => {
    expect(flightCategoryClass("VFR")).toBe("vfr");
    expect(flightCategoryClass("MVFR")).toBe("mvfr");
    expect(flightCategoryClass("IFR")).toBe("ifr");
    expect(flightCategoryClass("LIFR")).toBe("lifr");
    expect(flightCategoryClass(null)).toBe("none");
  });
});

describe("plumas do vento", () => {
  it("bandeira 50 kt, pluma 10 kt, meia pluma 5 kt, arredondando para o múltiplo de 5", () => {
    expect(windBarb(6)).toEqual({ flags: 0, full: 0, half: 1 });
    expect(windBarb(15)).toEqual({ flags: 0, full: 1, half: 1 });
    expect(windBarb(65)).toEqual({ flags: 1, full: 1, half: 1 });
    expect(windBarb(0)).toEqual({ flags: 0, full: 0, half: 0 });
    expect(windBarb(2)).toEqual({ flags: 0, full: 0, half: 0 });
  });

  it("sem direção numérica (VRB) ou sem vento, não há haste", () => {
    const size = { start: 7, staff: 26, feather: 9, space: 3.5 };
    expect(barbGeometry("VRB", 10, size)).toBeNull();
    expect(barbGeometry(140, 0, size)).toBeNull();
    expect(barbGeometry(null, 10, size)).toBeNull();
  });

  it("a haste sai da borda do círculo e aponta para de onde o vento sopra (norte = para cima)", () => {
    const geo = barbGeometry(0, 15, { start: 7, staff: 26, feather: 9, space: 3.5 });
    expect(geo.staff.x1).toBeCloseTo(0);
    expect(geo.staff.y1).toBeCloseTo(-7);
    expect(geo.staff.x2).toBeCloseTo(0);
    expect(geo.staff.y2).toBeCloseTo(-26);
  });

  it("as plumas ficam do lado esquerdo da haste, inclinadas para a ponta; a meia é mais curta", () => {
    const geo = barbGeometry(0, 15, { start: 7, staff: 26, feather: 9, space: 3.5 });
    expect(geo.feathers).toHaveLength(2);
    // Pluma inteira na ponta: sai de (0, -26) para a esquerda e um pouco para cima.
    expect(geo.feathers[0].x1).toBeCloseTo(0);
    expect(geo.feathers[0].y1).toBeCloseTo(-26);
    expect(geo.feathers[0].x2).toBeCloseTo(-9 * 0.866);
    expect(geo.feathers[0].y2).toBeCloseTo(-26 - 9 * 0.5);
    // Meia pluma logo abaixo, a 3,5 unidades para dentro, com metade do comprimento.
    expect(geo.feathers[1].y1).toBeCloseTo(-22.5);
    expect(geo.feathers[1].x2).toBeCloseTo(-4.5 * 0.866);
  });

  it("uma bandeira vira um triângulo na ponta da haste", () => {
    const geo = barbGeometry(0, 65, { start: 7, staff: 26, feather: 9, space: 3.5 });
    expect(geo.flags).toHaveLength(1);
    expect(geo.flags[0]).toHaveLength(3);
  });
});

describe("setor da cobertura", () => {
  it("sem cobertura ou com céu encoberto não há setor", () => {
    expect(skyPath(0, 6)).toBeNull();
    expect(skyPath(1, 6)).toBeNull();
  });

  it("o setor começa no norte e vai no sentido horário; acima de metade vira arco grande", () => {
    const half = skyPath(0.5, 6);
    expect(half.startsWith("M 0 0 L 0 -6 A 6 6 0 0 1 ")).toBe(true);
    expect(half.endsWith(" Z")).toBe(true);
    expect(skyPath(0.75, 6)).toContain("A 6 6 0 1 1");
  });
});

describe("lado do texto original", () => {
  it("fica do lado oposto à haste: haste para a direita e para baixo, caixa à esquerda e para cima", () => {
    expect(calloutSide(140, 6)).toEqual({ left: true, up: true });
    expect(calloutSide(0, 15)).toEqual({ left: true, up: false });
    expect(calloutSide(270, 10)).toEqual({ left: false, up: true });
  });

  it("sem haste (calmo, variável ou sem direção), fica à direita e para baixo", () => {
    expect(calloutSide("VRB", 4)).toEqual({ left: false, up: false });
    expect(calloutSide(140, 0)).toEqual({ left: false, up: false });
    expect(calloutSide(null, 10)).toEqual({ left: false, up: false });
  });
});

describe("texto original do METAR", () => {
  it("quebra em linhas de até 28 caracteres, sem cortar palavras", () => {
    expect(wrapRaw(METAR.rawOb)).toEqual([
      "METAR SBSP 270800Z AUTO",
      "14006KT 9999 FEW022 BKN032",
      "17/16 Q1021",
    ]);
  });

  it("palavra longa fica sozinha, e texto vazio não tem linhas", () => {
    expect(wrapRaw("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 X")).toEqual(["ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", "X"]);
    expect(wrapRaw("")).toEqual([]);
    expect(wrapRaw(null)).toEqual([]);
  });
});
