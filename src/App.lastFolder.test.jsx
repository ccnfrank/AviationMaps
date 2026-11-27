import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { allowFolder, onOpenedFolder, pickDirectory, readDirectory, takeOpenedFolder } from "./lib/folderAccess";

// Simula o app Tauri: o caminho nativo, a liberação do escopo, a leitura da pasta e a entrega de
// pastas pelo macOS (ícone do app) são mockados. Sem entrega pendente, takeOpenedFolder devolve null.
vi.mock("./lib/folderAccess", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isTauri: () => true,
    canPickDirectory: () => true,
    allowFolder: vi.fn(async () => {}),
    pickDirectory: vi.fn(),
    readDirectory: vi.fn(),
    takeOpenedFolder: vi.fn(async () => null),
    onOpenedFolder: vi.fn(async () => () => {}),
  };
});

const KEY = "mapareader.lastFolder";
const mk = (rel) => {
  const f = new File(["x"], rel.split("/").pop(), { type: "image/png" });
  Object.defineProperty(f, "webkitRelativePath", { value: rel });
  return f;
};
const MAPS = () => [mk("carta/norte/mapa-01.png")];

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("última pasta no app Tauri", () => {
  it("ao abrir, reabre a última pasta sem o usuário escolher de novo", async () => {
    localStorage.setItem(KEY, "/Users/ana/Mapas/carta");
    readDirectory.mockResolvedValue(MAPS());
    render(<App />);
    await waitFor(() => expect(document.querySelector(".app")).toHaveClass("app--loaded"));
    expect(allowFolder).toHaveBeenCalledWith("/Users/ana/Mapas/carta");
    expect(readDirectory).toHaveBeenCalledWith("/Users/ana/Mapas/carta");
  });

  it("uma pasta entregue pelo macOS ao abrir tem prioridade sobre a última, e fica lembrada", async () => {
    localStorage.setItem(KEY, "/Users/ana/Mapas/carta");
    takeOpenedFolder.mockResolvedValueOnce("/Users/ana/Mapas/norte");
    readDirectory.mockResolvedValue(MAPS());
    render(<App />);
    await waitFor(() => expect(localStorage.getItem(KEY)).toBe("/Users/ana/Mapas/norte"));
    expect(allowFolder).toHaveBeenCalledWith("/Users/ana/Mapas/norte");
    expect(readDirectory).toHaveBeenCalledTimes(1);
    expect(readDirectory).toHaveBeenCalledWith("/Users/ana/Mapas/norte");
    expect(document.querySelector(".app")).toHaveClass("app--loaded");
  });

  it("uma pasta entregue com o app já aberto carrega na hora", async () => {
    let onOpened = null;
    onOpenedFolder.mockImplementationOnce(async (handler) => {
      onOpened = handler;
      return () => {};
    });
    readDirectory.mockResolvedValue(MAPS());
    render(<App />);
    // Espera a checagem da entrega pendente da abertura, para a próxima leitura ser a do evento.
    await waitFor(() => expect(takeOpenedFolder).toHaveBeenCalledTimes(1));
    expect(onOpened).not.toBeNull();
    takeOpenedFolder.mockResolvedValueOnce("/Users/ana/Mapas/sul");
    await act(async () => {
      await onOpened();
    });
    await waitFor(() => expect(readDirectory).toHaveBeenCalledWith("/Users/ana/Mapas/sul"));
    expect(localStorage.getItem(KEY)).toBe("/Users/ana/Mapas/sul");
  });

  it("sem pasta lembrada, abre vazio", () => {
    render(<App />);
    expect(readDirectory).not.toHaveBeenCalled();
    expect(document.querySelector(".app")).not.toHaveClass("app--loaded");
  });

  it("escolher uma pasta pelo diálogo guarda o caminho", async () => {
    pickDirectory.mockResolvedValue("/Users/ana/Mapas/sul");
    readDirectory.mockResolvedValue(MAPS());
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Load maps directory/ }));
    await waitFor(() => expect(localStorage.getItem(KEY)).toBe("/Users/ana/Mapas/sul"));
  });

  it("se a pasta lembrada não pode ser lida, esquece o caminho e avisa", async () => {
    localStorage.setItem(KEY, "/Users/ana/Mapas/sumiu");
    readDirectory.mockRejectedValue(new Error("forbidden path"));
    render(<App />);
    await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull());
    expect(await screen.findByText("This folder could not be read.")).toBeInTheDocument();
  });
});
