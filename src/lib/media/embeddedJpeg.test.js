import { findLargestJpeg } from "./embeddedJpeg";

// Monta um "JPEG" mínimo: SOI, um APP1 de tamanho `appLen`, SOS com dados e EOI.
function fakeJpeg({ thumb = false, data = [0x12, 0x34] } = {}) {
  const inner = thumb ? [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xd9] : [];
  const app1 = [0xff, 0xe1, 0x00, 2 + inner.length, ...inner];
  const sos = [0xff, 0xda, 0x00, 0x02, 0xff, 0x00, ...data];
  return [0xff, 0xd8, ...app1, ...sos, 0xff, 0xd9];
}

test("acha um JPEG no meio de lixo", () => {
  const jpeg = fakeJpeg();
  const bytes = new Uint8Array([1, 2, 3, ...jpeg, 9, 9]);
  expect(Array.from(findLargestJpeg(bytes))).toEqual(jpeg);
});

test("não para na miniatura aninhada: pega o JPEG inteiro", () => {
  const jpeg = fakeJpeg({ thumb: true });
  const bytes = new Uint8Array(jpeg);
  expect(findLargestJpeg(bytes).length).toBe(jpeg.length);
});

test("escolhe o maior entre vários JPEGs", () => {
  const small = fakeJpeg({ data: [1] });
  const big = fakeJpeg({ data: [1, 2, 3, 4, 5, 6, 7, 8] });
  const bytes = new Uint8Array([...small, 0, 0, ...big]);
  expect(findLargestJpeg(bytes).length).toBe(big.length);
});

test("sem JPEG devolve null", () => {
  expect(findLargestJpeg(new Uint8Array([0, 1, 2, 3, 4]))).toBeNull();
});

test("JPEG truncado não é devolvido", () => {
  const jpeg = fakeJpeg().slice(0, -2);
  expect(findLargestJpeg(new Uint8Array(jpeg))).toBeNull();
});
