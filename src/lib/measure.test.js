import { describe, expect, it } from "vitest";
import {
  PDF_CM_PER_UNIT, lineMetrics, cmPerUnitFromDpi, cmPerUnitFromCalibration,
  formatNumber, parsePngDpi, parseJpegDpi, readImageDpi, segmentsOf, chainLength, angleOf,
  parseDeclination, addDeclination, declinationFrom,
} from "./measure";

describe("transferidor", () => {
  const O = { x: 10, y: 10 };
  it("0° para cima (norte), 90° à direita, 180° para baixo, 270° à esquerda (sentido horário)", () => {
    expect(angleOf(O, { x: 10, y: 0 })).toBeCloseTo(0);
    expect(angleOf(O, { x: 20, y: 10 })).toBeCloseTo(90);
    expect(angleOf(O, { x: 10, y: 20 })).toBeCloseTo(180);
    expect(angleOf(O, { x: 0, y: 10 })).toBeCloseTo(270);
  });

  it("fica sempre entre 0 e 360, sem 360 exato", () => {
    const deg = angleOf(O, { x: 20, y: 10 - 1e-12 });
    expect(deg).toBeGreaterThanOrEqual(0);
    expect(deg).toBeLessThan(360);
  });

  it("variação com lado: leste (E) entra negativa, oeste (W) positiva, e negativo ou vazio é inválido", () => {
    expect(declinationFrom("23", "E")).toBe(-23);
    expect(declinationFrom("23", "W")).toBe(23);
    expect(declinationFrom("3,5", "E")).toBe(-3.5);
    // Exemplo do deriva.md: MH = TH − 23 (23° E). Com TH 080,59, o magnético é 057,59.
    expect(addDeclination(80.59, declinationFrom("23", "E"))).toBeCloseTo(57.59, 2);
    expect(declinationFrom("-12", "W")).toBeNull();
    expect(declinationFrom("", "E")).toBeNull();
  });

  it("desvio magnético: aceita sinal, vírgula decimal e rejeita vazio ou inválido", () => {
    expect(parseDeclination("-12")).toBe(-12);
    expect(parseDeclination("+3,5")).toBe(3.5);
    expect(parseDeclination(" 0 ")).toBe(0);
    expect(parseDeclination("")).toBeNull();
    expect(parseDeclination("   ")).toBeNull();
    expect(parseDeclination("-")).toBeNull();
    expect(parseDeclination("abc")).toBeNull();
    expect(parseDeclination(undefined)).toBeNull();
  });

  it("agulha do desvio = ângulo + desvio, sempre entre 0 e 360", () => {
    expect(addDeclination(90, 15)).toBeCloseTo(105);
    expect(addDeclination(90, -15)).toBeCloseTo(75);
    expect(addDeclination(10, -30)).toBeCloseTo(340);
    expect(addDeclination(350, 20)).toBeCloseTo(10);
    expect(addDeclination(120, 0)).toBeCloseTo(120);
    expect(addDeclination(0, -360)).toBeCloseTo(0);
  });
});

 describe("cadeia de pontos", () => {
  it("cada par de pontos vira um segmento", () => {
    const segs = segmentsOf([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }]);
    expect(segs.map((s) => s.px)).toEqual([5, 6]);
  });

  it("comprimento total é a soma dos segmentos", () => {
    expect(chainLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }])).toBeCloseTo(11);
    expect(chainLength([{ x: 1, y: 1 }])).toBe(0);
  });
});

describe("medição", () => {
  it("distância e componentes em px", () => {
    const m = lineMetrics({ x1: 0, y1: 0, x2: 300, y2: 400 });
    expect(m.px).toBe(500);
    expect(m.dx).toBe(300);
    expect(m.dy).toBe(400);
    expect(m.cm).toBeNull();
  });

  it("converte para cm com a escala", () => {
    const m = lineMetrics({ x1: 0, y1: 0, x2: 300, y2: 400 }, 0.1);
    expect(m.cm).toBeCloseTo(50);
    expect(m.dxCm).toBeCloseTo(30);
    expect(m.dyCm).toBeCloseTo(40);
  });

  it("PDF: 1 pt = 2,54/72 cm (escala exata)", () => {
    expect(PDF_CM_PER_UNIT * 72).toBeCloseTo(2.54);
  });

  it("escala pelo DPI e pela calibração", () => {
    expect(cmPerUnitFromDpi(300)).toBeCloseTo(2.54 / 300);
    expect(cmPerUnitFromDpi(0)).toBeNull();
    expect(cmPerUnitFromCalibration(10, 200)).toBeCloseTo(0.05);
    expect(cmPerUnitFromCalibration(0, 200)).toBeNull();
  });

  it("formata com vírgula em português", () => {
    expect(formatNumber(3.456, 2, "pt")).toBe("3,46");
    expect(formatNumber(3.456, 2, "en")).toBe("3.46");
    expect(formatNumber(1234.4, 0, "en")).toBe("1,234");
  });
});

// Bytes montados à mão, para não depender de arquivos binários no repositório.
const bytes = (...parts) => new Uint8Array(parts.flat());
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const SIG = [137, 80, 78, 71, 13, 10, 26, 10];

function png(phys) {
  const ihdr = [...be32(13), ...ascii("IHDR"), ...new Array(13).fill(0), 0, 0, 0, 0];
  const physChunk = phys
    ? [...be32(9), ...ascii("pHYs"), ...be32(phys.perMeter), ...be32(phys.perMeter), phys.unit, 0, 0, 0, 0]
    : [];
  const idat = [...be32(0), ...ascii("IDAT"), 0, 0, 0, 0];
  const iend = [...be32(0), ...ascii("IEND"), 0, 0, 0, 0];
  return bytes(SIG, ihdr, physChunk, idat, iend);
}

// TIFF (EXIF, little-endian) com XResolution = num e ResolutionUnit = unit.
function tiff(num, unit) {
  return [
    0x49, 0x49, 0x2a, 0, 8, 0, 0, 0,          // cabeçalho; IFD0 no offset 8
    2, 0,                                      // 2 entradas
    0x1a, 0x01, 5, 0, 1, 0, 0, 0, 34, 0, 0, 0, // XResolution -> offset 34
    0x28, 0x01, 3, 0, 1, 0, 0, 0, unit, 0, 0, 0, // ResolutionUnit inline
    num & 255, (num >> 8) & 255, 0, 0, 1, 0, 0, 0, // racional num/1
    0, 0, 0, 0,                                // sem próximo IFD
  ];
}

describe("DPI do arquivo", () => {
  it("PNG com pHYs em metros: 300 dpi", () => {
    // 300 dpi = 11811 pixels por metro
    expect(parsePngDpi(png({ perMeter: 11811, unit: 1 }))).toBeCloseTo(300, 0);
  });

  it("PNG sem pHYs ou sem unidade de metro: sem dpi", () => {
    expect(parsePngDpi(png(null))).toBeNull();
    expect(parsePngDpi(png({ perMeter: 11811, unit: 0 }))).toBeNull();
  });

  it("JPEG JFIF em polegadas: 300 dpi", () => {
    const jfif = bytes(
      [0xff, 0xd8], [0xff, 0xe0], [0, 16], ascii("JFIF"), [0], [1, 1], [1], [1, 44], [1, 44], [0, 0],
      [0xff, 0xd9],
    );
    expect(parseJpegDpi(jfif)).toBe(300);
  });

  it("JPEG JFIF com unidade 'pontos por cm' é convertido para dpi", () => {
    const jfif = bytes(
      [0xff, 0xd8], [0xff, 0xe0], [0, 16], ascii("JFIF"), [0], [1, 1], [2], [0, 118], [0, 118], [0, 0],
      [0xff, 0xd9],
    );
    expect(parseJpegDpi(jfif)).toBeCloseTo(118 * 2.54, 0);
  });

  it("JPEG com EXIF em polegadas: 300 dpi", () => {
    const exifData = [...ascii("Exif"), 0, 0, ...tiff(300, 2)];
    const jpeg = bytes([0xff, 0xd8], [0xff, 0xe1], be16(exifData.length + 2), exifData, [0xff, 0xd9]);
    expect(parseJpegDpi(jpeg)).toBe(300);
  });

  it("JPEG com EXIF em centímetros: 100 pontos/cm = 254 dpi", () => {
    const exifData = [...ascii("Exif"), 0, 0, ...tiff(100, 3)];
    const jpeg = bytes([0xff, 0xd8], [0xff, 0xe1], be16(exifData.length + 2), exifData, [0xff, 0xd9]);
    expect(parseJpegDpi(jpeg)).toBeCloseTo(254, 0);
  });

  it("arquivo que não é PNG nem JPEG: sem dpi", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], "x.bin");
    expect(await readImageDpi(file)).toBeNull();
  });

  it("lê o dpi direto de um File", async () => {
    const file = new File([png({ perMeter: 11811, unit: 1 })], "capa.png", { type: "image/png" });
    expect(await readImageDpi(file)).toBeCloseTo(300, 0);
  });
});

function be16(n) {
  return [(n >> 8) & 255, n & 255];
}
