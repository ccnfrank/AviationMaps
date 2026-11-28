import { describe, expect, test } from "vitest";
import { folderKeyOf, listAllDirs, listDir, parentDir } from "./browseDir";
import { ROOT_NAME } from "./groupFiles";

const f = (relPath) => ({ relPath, name: relPath.split("/").pop(), size: 1 });
const files = [
  f("mapa-01.png"),
  f("dia1/mapa-a.png"),
  f("dia1/mapa-b.pdf"),
  f("dia2/sul/mapa-c.png"),
  f("dia2/mapa-d.png"),
];

describe("listDir", () => {
  test("na raiz: subpastas com contagem total e só os mapas soltos", () => {
    const { subdirs, maps } = listDir(files, "");
    expect(subdirs.map((s) => [s.name, s.path, s.count])).toEqual([
      ["dia1", "dia1", 2],
      ["dia2", "dia2", 2],
    ]);
    expect(maps.map((m) => m.relPath)).toEqual(["mapa-01.png"]);
  });

  test("numa subpasta: a próxima subpasta e os mapas diretos, sem os de níveis mais fundos", () => {
    const { subdirs, maps } = listDir(files, "dia2");
    expect(subdirs.map((s) => [s.name, s.path, s.count])).toEqual([["sul", "dia2/sul", 1]]);
    expect(maps.map((m) => m.relPath)).toEqual(["dia2/mapa-d.png"]);
  });

  test("pasta só com mapas soltos não tem subpastas", () => {
    const { subdirs, maps } = listDir([f("a.png"), f("b.png")], "");
    expect(subdirs).toEqual([]);
    expect(maps).toHaveLength(2);
  });
});

describe("parentDir", () => {
  test("sobe um nível", () => {
    expect(parentDir("dia2/sul")).toBe("dia2");
    expect(parentDir("dia2")).toBe("");
  });
});

describe("folderKeyOf", () => {
  test("a pasta é o nome dela, a subpasta é o caminho a partir da pasta carregada", () => {
    expect(folderKeyOf("dia2")).toBe("dia2");
    expect(folderKeyOf("dia2", "sul")).toBe("dia2/sul");
  });
});

describe("listAllDirs", () => {
  test("lista todas as pastas, em todos os níveis, com a contagem de mapas que ficam dentro", () => {
    const dirs = listAllDirs([
      { name: "footage", files: [f("a.png"), f("sul/b.png"), f("sul/x/c.png")] },
      { name: "fx", files: [f("d.pdf")] },
    ]);
    expect(dirs.map((d) => [d.key, d.label, d.count, d.folderIndex, d.dir])).toEqual([
      ["footage", "footage", 3, 0, ""],
      ["footage/sul", "footage / sul", 2, 0, "sul"],
      ["footage/sul/x", "footage / sul / x", 1, 0, "sul/x"],
      ["fx", "fx", 1, 1, ""],
    ]);
  });

  test("os arquivos soltos da pasta carregada não viram pasta", () => {
    const dirs = listAllDirs([{ name: ROOT_NAME, files: [f("solto.png")] }]);
    expect(dirs).toEqual([]);
  });
});
