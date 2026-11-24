import { describe, expect, it } from "vitest";
import { routeCsv } from "./routeExport";

describe("routeCsv", () => {
  it("inglês: vírgula como separador, com BOM e fim de linha Windows", () => {
    const csv = routeCsv([["Leg", "From"], [1, "A"]], "en");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe("\uFEFFLeg,From\r\n1,A\r\n");
  });

  it("português: ponto e vírgula como separador", () => {
    expect(routeCsv([["Trecho", "De"], ["1", "A"]], "pt-BR")).toBe("\uFEFFTrecho;De\r\n1;A\r\n");
  });

  it("escapa células com separador, aspas ou quebra de linha", () => {
    const csv = routeCsv([['nota, com "aspas"', "x"]], "en");
    expect(csv).toContain('"nota, com ""aspas"""');
  });
});
