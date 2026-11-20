import { groupFiles } from "./groupFiles";

const f = (path, size = 10) => ({ name: path.split("/").pop(), size, webkitRelativePath: path });

test("agrupa por subpasta, raiz por último, ignora ocultos", () => {
  const folders = groupFiles([
    f("Root/footage/dia2/a.mp4", 100),
    f("Root/fx/b.wav", 50),
    f("Root/leia.txt", 5),
    f("Root/footage/.DS_Store"),
    f("Root/footage/x/.hidden.png"),
  ]);
  expect(folders.map((x) => x.name)).toEqual(["footage", "fx", "(raiz)"]);
  const footage = folders[0];
  expect(footage.files).toHaveLength(1);
  expect(footage.files[0]).toMatchObject({ relPath: "dia2/a.mp4", name: "a.mp4", ext: "mp4", type: "other", size: 100 });
  expect(footage.fileCount).toBe(1);
  expect(footage.totalSize).toBe(100);
  expect(folders[2].files[0].relPath).toBe("leia.txt");
});

test("entrada vazia devolve lista vazia", () => expect(groupFiles([])).toEqual([]));

test("só ocultos devolve lista vazia", () =>
  expect(groupFiles([f("Root/.DS_Store"), f("Root/fx/.x")])).toEqual([]));

test("só arquivos soltos gera apenas (raiz)", () => {
  const r = groupFiles([f("Root/a.wav"), f("Root/b.wav")]);
  expect(r.map((x) => x.name)).toEqual(["(raiz)"]);
  expect(r[0].fileCount).toBe(2);
});

test("arquivos de cada pasta em ordem alfabética de relPath", () => {
  const r = groupFiles([f("R/p/z.mp4"), f("R/p/a.mp4")]);
  expect(r[0].files.map((x) => x.relPath)).toEqual(["a.mp4", "z.mp4"]);
});
