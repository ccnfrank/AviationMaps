import { describe, expect, it } from "vitest";
import { nearestWind, parseTas, parseWind, windArrow, windCorrection } from "./wind";

const close = (a, b, digits = 6) => expect(a).toBeCloseTo(b, digits);

describe("parseWind", () => {
  it("aceita direção e velocidade válidas", () => {
    expect(parseWind("270", "15")).toEqual({ dir: 270, speed: 15 });
  });

  it("aceita vírgula decimal e velocidade zero", () => {
    expect(parseWind("90", "12,5")).toEqual({ dir: 90, speed: 12.5 });
    expect(parseWind("90", "0")).toEqual({ dir: 90, speed: 0 });
  });

  it("360 vira 0", () => {
    expect(parseWind("360", "5")).toEqual({ dir: 0, speed: 5 });
  });

  it("recusa direção fora de 0 a 360 e campos vazios ou inválidos", () => {
    expect(parseWind("361", "5")).toBeNull();
    expect(parseWind("-1", "5")).toBeNull();
    expect(parseWind("", "5")).toBeNull();
    expect(parseWind("90", "")).toBeNull();
    expect(parseWind("90", "-3")).toBeNull();
    expect(parseWind("abc", "5")).toBeNull();
  });
});

describe("windArrow", () => {
  const center = { x: 100, y: 100 };

  it("vento de oeste (270°) sopra para leste: a seta aponta para a direita", () => {
    const a = windArrow(center, 270, 40);
    expect(a.end.x).toBeGreaterThan(center.x);
    close(a.end.y, 100);
    close(a.start.x, 80);
    close(a.end.x, 120);
  });

  it("vento de norte (0°) sopra para o sul: a seta aponta para baixo na tela", () => {
    const a = windArrow(center, 0, 40);
    close(a.end.x, 100);
    close(a.end.y, 120);
    close(a.start.y, 80);
  });

  it("vento de 280° aponta para 100°: leste, um pouco para o sul", () => {
    const a = windArrow(center, 280, 40);
    expect(a.end.x).toBeGreaterThan(center.x);
    expect(a.end.y).toBeGreaterThan(center.y);
  });

  it("a seta é centrada no ponto e tem o comprimento pedido", () => {
    const a = windArrow(center, 45, 50);
    close((a.start.x + a.end.x) / 2, 100);
    close((a.start.y + a.end.y) / 2, 100);
    close(Math.hypot(a.end.x - a.start.x, a.end.y - a.start.y), 50);
  });

  it("as pontas da cabeça ficam para trás da ponta, uma de cada lado", () => {
    const a = windArrow(center, 270, 40);
    // A seta aponta para leste: as pontas ficam à esquerda da ponta, uma acima e outra abaixo.
    expect(a.heads[0].x).toBeLessThan(a.end.x);
    expect(a.heads[1].x).toBeLessThan(a.end.x);
    const ys = a.heads.map((h) => h.y - a.end.y);
    expect(ys.some((dy) => dy < 0)).toBe(true);
    expect(ys.some((dy) => dy > 0)).toBe(true);
  });
});

describe("windCorrection", () => {
  it("sem vento, a proa é o próprio rumo e a velocidade sobre o solo é a TAS", () => {
    const c = windCorrection(90, { dir: 0, speed: 0 }, 120);
    close(c.heading, 90);
    close(c.wca, 0);
    close(c.groundSpeed, 120);
  });

  it("vento cruzado de norte (20 kt) num rumo leste: a proa vira para o norte (080°)", () => {
    const c = windCorrection(90, { dir: 0, speed: 20 }, 120);
    close(c.heading, 80.41, 1);
    close(c.wca, -9.59, 1);
    close(c.groundSpeed, 118.32, 1);
  });

  it("vento cruzado do outro lado: a proa vira para o sul", () => {
    const c = windCorrection(90, { dir: 180, speed: 20 }, 120);
    close(c.heading, 99.59, 1);
    close(c.wca, 9.59, 1);
  });

  it("vento de cauda soma à velocidade sobre o solo, sem correção", () => {
    const c = windCorrection(90, { dir: 270, speed: 20 }, 120);
    close(c.heading, 90);
    close(c.groundSpeed, 140);
  });

  it("vento de proa subtrai da velocidade sobre o solo", () => {
    const c = windCorrection(90, { dir: 90, speed: 20 }, 120);
    close(c.groundSpeed, 100);
  });

  it("recusa quando o vento cruzado passa da TAS, ou sem TAS", () => {
    expect(windCorrection(90, { dir: 0, speed: 130 }, 120)).toBeNull();
    expect(windCorrection(90, { dir: 0, speed: 20 }, null)).toBeNull();
    expect(windCorrection(90, null, 120)).toBeNull();
  });
});

describe("parseTas e nearestWind", () => {
  it("TAS em km/h vira nós", () => {
    close(parseTas("222", "kmh"), 222 / 1.852, 6);
  });

  it("TAS precisa ser um número positivo", () => {
    expect(parseTas("120")).toBe(120);
    expect(parseTas("0")).toBeNull();
    expect(parseTas("")).toBeNull();
    expect(parseTas("abc")).toBeNull();
  });

  it("escolhe a seta mais próxima do ponto", () => {
    const a = { id: "a", x: 0, y: 0, dir: 0, speed: 5 };
    const b = { id: "b", x: 100, y: 0, dir: 90, speed: 10 };
    expect(nearestWind([a, b], { x: 80, y: 10 })).toBe(b);
    expect(nearestWind([], { x: 0, y: 0 })).toBeNull();
  });
});

describe("tabela de correção de deriva", () => {
  it("RV 090°, vento 030° a 20 kt, VA 100 kt: CD de 10° e proa 080°", () => {
    const c = windCorrection(90, { dir: 30, speed: 20 }, 100);
    close(c.wca, -10, 0);
    close(c.heading, 80, 0);
  });
});

describe("caso do rumo 120 com vento de 240°", () => {
  it("vento de 240° a 20 kt, TAS 120 kt: proa corrigida de 128°, GS de 129 kt", () => {
    const c = windCorrection(120, { dir: 240, speed: 20 }, 120);
    close(c.heading, 128.3, 1);
    close(c.wca, 8.3, 1);
    close(c.groundSpeed, 128.74, 1);
  });
});
