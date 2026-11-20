import { searchAll, splitHighlight } from "./searchFiles";

const folders = [
  { name: "footage", files: [{ relPath: "dia1/cena01.mp4", name: "cena01.mp4" }, { relPath: "take3.mxf", name: "take3.mxf" }] },
  { name: "fx", files: [{ relPath: "cena_whoosh.wav", name: "cena_whoosh.wav" }] },
];

test("busca em todas as pastas e devolve o índice da pasta", () => {
  const r = searchAll(folders, "cena");
  expect(r.total).toBe(2);
  expect(r.items.map((i) => [i.folder, i.folderIndex, i.entry.name])).toEqual([
    ["footage", 0, "cena01.mp4"],
    ["fx", 1, "cena_whoosh.wav"],
  ]);
});

test("consulta vazia não retorna nada", () => {
  expect(searchAll(folders, "   ")).toEqual({ total: 0, items: [] });
});

test("limite corta a lista mas mantém o total", () => {
  const big = [{ name: "a", files: Array.from({ length: 10 }, (_, i) => ({ relPath: `x${i}.wav`, name: `x${i}.wav` })) }];
  const r = searchAll(big, "x", 3);
  expect(r.total).toBe(10);
  expect(r.items).toHaveLength(3);
});

test("destaca o trecho encontrado sem diferenciar maiúsculas", () => {
  expect(splitHighlight("Dia1/Cena01.mp4", "cena")).toEqual([
    { text: "Dia1/", hit: false },
    { text: "Cena", hit: true },
    { text: "01.mp4", hit: false },
  ]);
});
