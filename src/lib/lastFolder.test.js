import { beforeEach, describe, expect, it } from "vitest";
import { forgetLastFolder, readLastFolder, saveLastFolder } from "./lastFolder";

describe("última pasta carregada", () => {
  beforeEach(() => localStorage.clear());

  it("começa vazia", () => {
    expect(readLastFolder()).toBeNull();
  });

  it("guarda o caminho e devolve o mesmo caminho depois", () => {
    saveLastFolder("/Users/ana/Mapas/carta");
    expect(readLastFolder()).toBe("/Users/ana/Mapas/carta");
  });

  it("trocar a pasta substitui a anterior", () => {
    saveLastFolder("/a");
    saveLastFolder("/b");
    expect(readLastFolder()).toBe("/b");
  });

  it("esquecer apaga o caminho", () => {
    saveLastFolder("/a");
    forgetLastFolder();
    expect(readLastFolder()).toBeNull();
  });
});
