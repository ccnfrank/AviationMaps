import { describe, expect, test } from "vitest";
import { listDir, parentDir } from "./browseDir";

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
